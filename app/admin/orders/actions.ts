"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminDataTag } from "@/lib/admin";
import type { OrderAction } from "@/lib/orders/domain";
import { requireOrderOperator } from "@/lib/orders/permissions";
import {
  addOrderNote,
  createOrderReturn,
  performBulkOrderAction,
  performOrderAction,
  recordOrderContactAttempt,
  updateOrderDeliveryAddress,
} from "@/lib/orders/service";

export type OrderMutationState = {
  success: boolean;
  message: string;
  revision: number;
  bulk?: {
    selected: number;
    updated: number;
    incompatible: Array<{ id: string; orderNumber: string; reason: string }>;
  };
};

const failure = (message: string, revision: number): OrderMutationState => ({
  success: false,
  message,
  revision,
});

const refreshOrders = (orderId?: string) => {
  revalidateTag(getAdminDataTag(), "max");
  revalidatePath("/admin/orders");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin", "layout");
  revalidatePath("/orders");
};

const readText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const allowedActions = new Set<OrderAction>([
  "RESOLVE_DELIVERY_INCIDENT",
  "CONFIRM_ORDER",
  "VERIFY_PAYMENT",
  "START_PREPARATION",
  "MARK_READY",
  "SHIP_ORDER",
  "ADD_TRACKING",
  "PROCESS_RETURN",
  "UPDATE_CUSTOMER_INFORMATION",
  "MARK_DELIVERED",
  "CANCEL_ORDER",
]);

export async function performOrderActionState(
  previousState: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  const revision = previousState.revision + 1;

  try {
    const operator = await requireOrderOperator();
    const orderId = readText(formData, "orderId");
    const action = readText(formData, "action") as OrderAction;
    if (!orderId) return failure("Commande introuvable.", revision);
    if (!allowedActions.has(action)) return failure("Action opérationnelle invalide.", revision);

    const expectedVersionRaw = readText(formData, "expectedVersion");
    const expectedVersion = expectedVersionRaw ? Number.parseInt(expectedVersionRaw, 10) : null;
    const estimatedDeliveryRaw = readText(formData, "estimatedDeliveryAt");
    const estimatedDeliveryAt = estimatedDeliveryRaw
      ? new Date(`${estimatedDeliveryRaw}T12:00:00`)
      : null;

    await performOrderAction(
      {
        orderId,
        action,
        expectedVersion: Number.isFinite(expectedVersion) ? expectedVersion : null,
        reason: readText(formData, "reason"),
        carrier: readText(formData, "carrier"),
        trackingNumber: readText(formData, "trackingNumber"),
        estimatedDeliveryAt:
          estimatedDeliveryAt && !Number.isNaN(estimatedDeliveryAt.getTime())
            ? estimatedDeliveryAt
            : null,
      },
      operator
    );

    refreshOrders(orderId);
    return { success: true, message: "Commande mise à jour.", revision };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Impossible de mettre à jour la commande.", revision);
  }
}

export async function bulkOrderActionState(
  previousState: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  const revision = previousState.revision + 1;

  try {
    const operator = await requireOrderOperator();
    const action = readText(formData, "action") as
      | "START_PREPARATION"
      | "MARK_READY"
      | "SHIP_ORDER";
    if (!["START_PREPARATION", "MARK_READY", "SHIP_ORDER"].includes(action)) {
      return failure("Action groupée invalide.", revision);
    }
    const orderIds = formData
      .getAll("orderIds")
      .filter((value): value is string => typeof value === "string");
    const result = await performBulkOrderAction(
      { orderIds, action, carrier: readText(formData, "carrier") },
      operator
    );
    refreshOrders();

    return {
      success: result.updated > 0,
      message: `${result.updated} commande(s) mise(s) à jour sur ${result.selected}.`,
      revision,
      bulk: result,
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Action groupée impossible.", revision);
  }
}

export async function addOrderNoteState(
  previousState: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  const revision = previousState.revision + 1;
  try {
    const operator = await requireOrderOperator();
    const orderId = readText(formData, "orderId");
    await addOrderNote(orderId, readText(formData, "content"), operator);
    refreshOrders(orderId);
    return { success: true, message: "Note interne ajoutée.", revision };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Impossible d'ajouter la note.", revision);
  }
}

export async function updateOrderAddressState(
  previousState: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  const revision = previousState.revision + 1;
  try {
    const operator = await requireOrderOperator();
    const orderId = readText(formData, "orderId");
    await updateOrderDeliveryAddress(
      {
        orderId,
        name: readText(formData, "name"),
        phone: readText(formData, "phone"),
        address: readText(formData, "address"),
        city: readText(formData, "city"),
        state: readText(formData, "state"),
        zip: readText(formData, "zip"),
        reason: readText(formData, "reason"),
      },
      operator
    );
    refreshOrders(orderId);
    return { success: true, message: "Adresse mise à jour et historisée.", revision };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Impossible de modifier l'adresse.", revision);
  }
}

export async function recordOrderContactState(
  previousState: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  const revision = previousState.revision + 1;
  try {
    const operator = await requireOrderOperator();
    const orderId = readText(formData, "orderId");
    const channel = readText(formData, "channel");
    if (!["phone", "whatsapp", "email"].includes(channel)) {
      return failure("Canal de contact invalide.", revision);
    }
    await recordOrderContactAttempt(orderId, channel as "phone" | "whatsapp" | "email", operator);
    refreshOrders(orderId);
    return { success: true, message: "Tentative de contact enregistrée.", revision };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Impossible de tracer le contact.", revision);
  }
}

export async function createOrderReturnState(
  previousState: OrderMutationState,
  formData: FormData
): Promise<OrderMutationState> {
  const revision = previousState.revision + 1;
  try {
    const operator = await requireOrderOperator();
    const orderId = readText(formData, "orderId");
    await createOrderReturn(orderId, readText(formData, "reason"), operator);
    refreshOrders(orderId);
    return { success: true, message: "Retour ouvert. Aucun remboursement n'a été déclenché.", revision };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Impossible d'ouvrir le retour.", revision);
  }
}
