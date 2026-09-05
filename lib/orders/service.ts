import { Prisma, type FulfillmentStatus, type OrderStatus, type PaymentStatus, type ReturnStatus } from "@prisma/client";

import { orderListSelect, toOrderDomainContext } from "@/lib/orders/admin-data";
import {
  buildOrderAddressAuditMetadata,
  validateBulkAction,
  validateOrderAction,
  type OrderAction,
  type OrderSlaPolicy,
} from "@/lib/orders/domain";
import type { OrderOperator } from "@/lib/orders/permissions";
import { prisma } from "@/lib/prisma";
import { reconcileOrderLoyalty } from "@/lib/services/loyalty";
import { adjustInventoryInTransaction } from "@/lib/inventory";

type TransactionClient = Prisma.TransactionClient;

export type PerformOrderActionInput = {
  orderId: string;
  action: OrderAction;
  expectedVersion?: number | null;
  reason?: string;
  carrier?: string;
  trackingNumber?: string;
  estimatedDeliveryAt?: Date | null;
};

const actionTitles: Record<OrderAction, string> = {
  RESOLVE_DELIVERY_INCIDENT: "Incident de livraison relancé",
  CONFIRM_ORDER: "Commande confirmée",
  VERIFY_PAYMENT: "Paiement validé",
  START_PREPARATION: "Préparation démarrée",
  MARK_READY: "Commande prête",
  SHIP_ORDER: "Commande expédiée",
  ADD_TRACKING: "Numéro de suivi ajouté",
  PROCESS_RETURN: "Retour mis à jour",
  UPDATE_CUSTOMER_INFORMATION: "Informations client modifiées",
  MARK_DELIVERED: "Commande livrée",
  CANCEL_ORDER: "Commande annulée",
};

const asJson = (value: Record<string, unknown>) => value as Prisma.InputJsonValue;

const getPolicies = async (tx: TransactionClient): Promise<OrderSlaPolicy[]> =>
  tx.orderSlaPolicy.findMany({
    where: { isActive: true },
    select: {
      id: true,
      stage: true,
      durationHours: true,
      workingDays: true,
      applicableCarrier: true,
      applicableZone: true,
      priority: true,
    },
  });

const getActorData = (operator: OrderOperator) => ({
  actorUserId: operator.userId,
  actorEmail: operator.email,
  actorName: operator.displayName,
});

const getOpenReturnTransition = (status: ReturnStatus) => {
  if (status === "requested") return { status: "approved" as ReturnStatus };
  if (status === "approved") return { status: "received" as ReturnStatus, receivedAt: new Date() };
  if (status === "received") return { status: "inspected" as ReturnStatus, inspectedAt: new Date() };
  if (status === "inspected") return { status: "closed" as ReturnStatus, closedAt: new Date() };
  return null;
};

const buildOrderUpdate = (
  action: OrderAction,
  input: PerformOrderActionInput,
  current: {
    status: OrderStatus;
    fulfillmentStatus: FulfillmentStatus;
    deliveryStatus: string;
  }
): Prisma.OrderUpdateManyMutationInput => {
  const now = new Date();
  const base: Prisma.OrderUpdateManyMutationInput = {
    version: { increment: 1 },
    statusChangedAt: now,
  };

  if (action === "CONFIRM_ORDER") return { ...base, confirmedAt: now, status: "processing" };
  if (action === "START_PREPARATION") {
    return { ...base, fulfillmentStatus: "preparing", preparationStartedAt: now, status: "processing" };
  }
  if (action === "MARK_READY") {
    return { ...base, fulfillmentStatus: "ready", preparedAt: now, status: "processing" };
  }
  if (action === "SHIP_ORDER") {
    return {
      ...base,
      fulfillmentStatus: "shipped",
      deliveryStatus: "in_transit",
      status: "shipped",
      shippedAt: now,
      deliveryCompany: input.carrier?.trim() || undefined,
      trackingNumber: input.trackingNumber?.trim() || undefined,
      estimatedDeliveryAt: input.estimatedDeliveryAt || undefined,
    };
  }
  if (action === "ADD_TRACKING") {
    return {
      ...base,
      trackingNumber: input.trackingNumber?.trim(),
      deliveryCompany: input.carrier?.trim() || undefined,
    };
  }
  if (action === "MARK_DELIVERED") {
    return { ...base, deliveryStatus: "delivered", status: "delivered", deliveredAt: now };
  }
  if (action === "VERIFY_PAYMENT") {
    return { ...base, paymentStatus: "paid" as PaymentStatus };
  }
  if (action === "RESOLVE_DELIVERY_INCIDENT") {
    return { ...base, deliveryStatus: "in_transit", status: "shipped" };
  }
  if (action === "CANCEL_ORDER") {
    return {
      ...base,
      status: "cancelled",
      fulfillmentStatus: "cancelled",
      ...(current.deliveryStatus === "not_assigned" || current.deliveryStatus === "preparing"
        ? { deliveryStatus: "not_assigned" }
        : {}),
    };
  }

  return base;
};

const writeEventAndAudit = async (
  tx: TransactionClient,
  input: {
    orderId: string;
    action: string;
    title: string;
    description?: string | null;
    operator: OrderOperator;
    metadata?: Record<string, unknown>;
  }
) => {
  const actor = getActorData(input.operator);
  await Promise.all([
    tx.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: input.action,
        title: input.title,
        description: input.description || null,
        ...actor,
        metadata: input.metadata ? asJson(input.metadata) : undefined,
      },
    }),
    tx.adminAuditLog.create({
      data: {
        actorUserId: input.operator.userId,
        actorEmail: input.operator.email,
        action: `order.${input.action.toLowerCase()}`,
        entity: "Order",
        entityId: input.orderId,
        metadata: input.metadata ? asJson(input.metadata) : undefined,
      },
    }),
  ]);
};

export async function performOrderAction(input: PerformOrderActionInput, operator: OrderOperator) {
  const result = await prisma.$transaction(
    async (tx) => {
      const [order, policies] = await Promise.all([
        tx.order.findUnique({ where: { id: input.orderId }, select: orderListSelect }),
        getPolicies(tx),
      ]);

      if (!order) throw new Error("Commande introuvable.");

      const context = toOrderDomainContext(order);
      const validation = validateOrderAction(
        context,
        input.action,
        operator.role,
        {
          reason: input.reason,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
        },
        policies
      );

      if (!validation.allowed) throw new Error(validation.reason);

      if (input.action === "PROCESS_RETURN") {
        const orderReturn = await tx.orderReturn.findFirst({
          where: { orderId: order.id, status: { in: ["requested", "approved", "received", "inspected"] } },
          orderBy: { createdAt: "asc" },
        });
        if (!orderReturn) throw new Error("Aucun retour ouvert à traiter.");
        const transition = getOpenReturnTransition(orderReturn.status);
        if (!transition) throw new Error("Ce retour ne peut plus avancer.");
        await tx.orderReturn.update({
          where: { id: orderReturn.id },
          data: { ...transition, reviewedBy: operator.displayName },
        });
      } else {
        const expectedVersion = input.expectedVersion ?? order.version;
        const update = await tx.order.updateMany({
          where: { id: order.id, version: expectedVersion },
          data: buildOrderUpdate(input.action, input, order),
        });

        if (update.count !== 1) {
          throw new Error("Cette commande a été modifiée par un autre opérateur. Rechargez la page.");
        }

        if (
          input.action === "CANCEL_ORDER" &&
          ["to_prepare", "preparing", "ready"].includes(order.fulfillmentStatus)
        ) {
          for (const item of order.items) {
            if (!item.productId) continue;
            await adjustInventoryInTransaction(tx, {
              productId: item.productId,
              quantityDelta: item.quantity,
              reason: "ORDER_CANCELLED",
              relatedOrderId: order.id,
              idempotencyKey: `order:${order.id}:restore:${item.productId}`,
              actor: {
                userId: operator.userId,
                email: operator.email,
                name: operator.displayName,
              },
              note: `Restitution après annulation de la commande ${order.orderNumber}`,
            });
          }
        }
      }

      await writeEventAndAudit(tx, {
        orderId: order.id,
        action: input.action,
        title: actionTitles[input.action],
        description: input.reason?.trim() || null,
        operator,
        metadata: {
          previous: {
            status: order.status,
            fulfillmentStatus: order.fulfillmentStatus,
            paymentStatus: order.paymentStatus,
            deliveryStatus: order.deliveryStatus,
            carrier: order.deliveryCompany,
            trackingNumber: order.trackingNumber,
          },
          input: {
            carrier: input.carrier || null,
            trackingNumber: input.trackingNumber || null,
            reason: input.reason || null,
          },
        },
      });

      return { orderId: order.id, orderNumber: order.orderNumber, userId: order.userId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  if (["MARK_DELIVERED", "VERIFY_PAYMENT", "CANCEL_ORDER", "PROCESS_RETURN"].includes(input.action)) {
    await reconcileOrderLoyalty(result.orderId, {
      userId: operator.userId,
      email: operator.email,
      label: operator.displayName,
    });
  }

  return result;
}

export async function addOrderNote(
  orderId: string,
  content: string,
  operator: OrderOperator
) {
  const normalized = content.trim();
  if (normalized.length < 2 || normalized.length > 2_000) {
    throw new Error("La note doit contenir entre 2 et 2 000 caractères.");
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new Error("Commande introuvable.");
    await tx.orderNote.create({
      data: {
        orderId,
        content: normalized,
        createdBy: operator.displayName,
        actorUserId: operator.userId,
      },
    });
    await writeEventAndAudit(tx, {
      orderId,
      action: "NOTE_ADDED",
      title: "Note interne ajoutée",
      operator,
      metadata: { noteLength: normalized.length },
    });
  });
}

export async function recordOrderContactAttempt(
  orderId: string,
  channel: "phone" | "whatsapp" | "email",
  operator: OrderOperator
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new Error("Commande introuvable.");
    await writeEventAndAudit(tx, {
      orderId,
      action: "CONTACT_ATTEMPT",
      title: `Tentative de contact ${channel === "phone" ? "téléphonique" : channel === "whatsapp" ? "WhatsApp" : "par email"}`,
      operator,
      metadata: { channel },
    });
  });
}

export async function updateOrderDeliveryAddress(
  input: {
    orderId: string;
    name: string;
    phone: string;
    address: string;
    city: string;
    state?: string;
    zip?: string;
    reason?: string;
  },
  operator: OrderOperator
) {
  if (!input.name.trim() || !input.phone.trim() || !input.address.trim() || !input.city.trim()) {
    throw new Error("Le nom, le téléphone, l'adresse et la ville sont obligatoires.");
  }

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        fulfillmentStatus: true,
        shippingName: true,
        shippingPhone: true,
        shippingAddress: true,
        shippingCity: true,
        shippingState: true,
        shippingZip: true,
      },
    });
    if (!order) throw new Error("Commande introuvable.");

    if (order.fulfillmentStatus === "shipped") {
      if (operator.role === "ORDER_AGENT") {
        throw new Error("Seul un manager peut modifier l'adresse après expédition.");
      }
      if (!input.reason?.trim()) {
        throw new Error("Un motif est obligatoire après expédition.");
      }
    }

    const previous = {
      name: order.shippingName,
      phone: order.shippingPhone,
      address: order.shippingAddress,
      city: order.shippingCity,
      state: order.shippingState,
      zip: order.shippingZip,
    };
    const next = {
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      city: input.city.trim(),
      state: input.state?.trim() || null,
      zip: input.zip?.trim() || null,
    };

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        shippingName: next.name,
        shippingPhone: next.phone,
        shippingAddress: next.address,
        shippingCity: next.city,
        shippingState: next.state,
        shippingZip: next.zip,
        version: { increment: 1 },
      },
    });
    await writeEventAndAudit(tx, {
      orderId: input.orderId,
      action: "ADDRESS_UPDATED",
      title: "Adresse de livraison modifiée",
      description: input.reason?.trim() || null,
      operator,
      metadata: buildOrderAddressAuditMetadata(previous, next),
    });
  });
}

export async function createOrderReturn(
  orderId: string,
  reason: string,
  operator: OrderOperator
) {
  if (operator.role === "ORDER_AGENT") throw new Error("Un manager doit ouvrir le retour.");
  if (reason.trim().length < 3) throw new Error("Le motif du retour est obligatoire.");

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        deliveryStatus: true,
        items: { select: { id: true, productNameSnapshot: true, quantity: true } },
      },
    });
    if (!order) throw new Error("Commande introuvable.");
    if (order.deliveryStatus !== "delivered") throw new Error("Un retour ne peut être ouvert qu'après livraison.");

    const orderReturn = await tx.orderReturn.create({
      data: {
        orderId,
        reason: reason.trim(),
        requestedBy: operator.displayName,
        itemSnapshot: asJson({ items: order.items }),
      },
    });
    await writeEventAndAudit(tx, {
      orderId,
      action: "RETURN_REQUESTED",
      title: "Retour demandé",
      description: reason.trim(),
      operator,
      metadata: { returnId: orderReturn.id },
    });
  });
}

export async function performBulkOrderAction(
  input: {
    orderIds: string[];
    action: "START_PREPARATION" | "MARK_READY" | "SHIP_ORDER";
    carrier?: string;
  },
  operator: OrderOperator
) {
  const ids = Array.from(new Set(input.orderIds.filter(Boolean))).slice(0, 100);
  if (!ids.length) throw new Error("Sélectionnez au moins une commande.");

  return prisma.$transaction(
    async (tx) => {
      const [orders, policies] = await Promise.all([
        tx.order.findMany({ where: { id: { in: ids } }, select: orderListSelect }),
        getPolicies(tx),
      ]);
      const contexts = orders.map(toOrderDomainContext);
      const validation = validateBulkAction(
        contexts,
        input.action,
        operator.role,
        { carrier: input.carrier },
        policies
      );

      for (const context of validation.compatible) {
        const order = orders.find((candidate) => candidate.id === context.id);
        if (!order) continue;
        const update = await tx.order.updateMany({
          where: { id: order.id, version: order.version },
          data: buildOrderUpdate(input.action, {
            orderId: order.id,
            action: input.action,
            carrier: input.carrier,
          }, order),
        });
        if (update.count !== 1) {
          validation.incompatible.push({
            id: order.id,
            orderNumber: order.orderNumber,
            reason: "Modifiée en parallèle par un autre opérateur.",
          });
          continue;
        }
        await writeEventAndAudit(tx, {
          orderId: order.id,
          action: input.action,
          title: actionTitles[input.action],
          operator,
          metadata: { bulk: true, carrier: input.carrier || null },
        });
      }

      return {
        selected: ids.length,
        updated: validation.compatible.length - validation.incompatible.filter((item) => item.reason.includes("parallèle")).length,
        incompatible: validation.incompatible,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
