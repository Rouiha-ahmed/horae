import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrderAddressAuditMetadata,
  computeOrderOperationalState,
  isOrderPaymentCollected,
  validateBulkAction,
  validateOrderAction,
  type OrderDomainContext,
  type OrderSlaPolicy,
} from "../lib/orders/domain";

const now = new Date("2026-08-12T12:00:00.000Z");

const policies: OrderSlaPolicy[] = [
  {
    id: "preparation",
    stage: "preparation",
    durationHours: 24,
    workingDays: false,
    applicableCarrier: null,
    applicableZone: null,
    priority: 0,
  },
  {
    id: "shipping",
    stage: "shipping",
    durationHours: 24,
    workingDays: false,
    applicableCarrier: null,
    applicableZone: null,
    priority: 0,
  },
  {
    id: "delivery-rabat-sale",
    stage: "delivery",
    durationHours: 24,
    workingDays: false,
    applicableCarrier: null,
    applicableZone: "rabat-sale",
    priority: 10,
  },
  {
    id: "delivery-other",
    stage: "delivery",
    durationHours: 72,
    workingDays: false,
    applicableCarrier: null,
    applicableZone: null,
    priority: 0,
  },
];

const orderContext = (
  overrides: Partial<OrderDomainContext> = {}
): OrderDomainContext => ({
  id: "order-1",
  orderNumber: "ZY1048",
  orderDate: new Date("2026-08-12T08:00:00.000Z"),
  status: "pending",
  paymentStatus: "pending",
  paymentMethod: "cod",
  fulfillmentStatus: "to_prepare",
  deliveryStatus: "not_assigned",
  confirmationRequired: false,
  confirmedAt: null,
  preparationStartedAt: null,
  preparedAt: null,
  shippedAt: null,
  deliveredAt: null,
  estimatedDeliveryAt: null,
  deliveryCompany: null,
  trackingNumber: null,
  phone: "+212612345678",
  address: "12 avenue Mohammed V",
  city: "Rabat",
  items: [{ id: "item-1", name: "Gel nettoyant", quantity: 1 }],
  returns: [],
  ...overrides,
});

test("A. COD non encaissé n'empêche pas le démarrage de la préparation", () => {
  const order = orderContext();
  const operational = computeOrderOperationalState(order, policies, now);
  assert.equal(operational.nextAction, "START_PREPARATION");
  assert.deepEqual(
    validateOrderAction(order, "START_PREPARATION", "ORDER_AGENT", {}, policies),
    { allowed: true }
  );
});

test("B. une confirmation requise précède la préparation", () => {
  const order = orderContext({ confirmationRequired: true });
  assert.equal(
    computeOrderOperationalState(order, policies, now).nextAction,
    "CONFIRM_ORDER"
  );
});

test("C. un échec ou retard de livraison devient critique", () => {
  for (const deliveryStatus of ["failed", "delayed"]) {
    const order = orderContext({
      status: "shipped",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      deliveryStatus,
      shippedAt: new Date("2026-08-12T10:00:00.000Z"),
      deliveryCompany: "Amana",
      trackingNumber: "TRACK-1",
    });
    const operational = computeOrderOperationalState(order, policies, now);
    assert.equal(operational.nextAction, "RESOLVE_DELIVERY_INCIDENT");
    assert.equal(operational.attentionLevel, "CRITICAL");
  }
});

test("D. une préparation hors SLA rejoint la file critique", () => {
  const order = orderContext({
    orderDate: new Date("2026-08-10T08:00:00.000Z"),
  });
  const operational = computeOrderOperationalState(order, policies, now);
  assert.equal(operational.sla?.isOverdue, true);
  assert.equal(operational.attentionLevel, "CRITICAL");
  assert.equal(operational.isInWorkQueue, true);
});

test("E. le téléphone manquant bloque et propose une correction", () => {
  const order = orderContext({ phone: null });
  const operational = computeOrderOperationalState(order, policies, now);
  assert.equal(operational.nextAction, "COMPLETE_CUSTOMER_INFORMATION");
  assert.equal(operational.issues[0]?.code, "MISSING_PHONE");
  assert.equal(
    validateOrderAction(order, "START_PREPARATION", "ADMIN", {}, policies).allowed,
    false
  );
});

test("F. une commande livrée n'a jamais Annuler comme étape suivante", () => {
  const order = orderContext({
    status: "delivered",
    paymentStatus: "paid",
    fulfillmentStatus: "shipped",
    deliveryStatus: "delivered",
    shippedAt: new Date("2026-08-11T10:00:00.000Z"),
    deliveredAt: new Date("2026-08-12T10:00:00.000Z"),
  });
  const operational = computeOrderOperationalState(order, policies, now);
  assert.equal(operational.nextAction, "NONE");
  assert.equal(
    validateOrderAction(order, "CANCEL_ORDER", "ADMIN", { reason: "test" }, policies)
      .allowed,
    false
  );
});

test("G. seul un paiement réellement encaissé entre dans le CA", () => {
  assert.equal(isOrderPaymentCollected({ paymentStatus: "paid" }), true);
  assert.equal(isOrderPaymentCollected({ paymentStatus: "pending" }), false);
  assert.equal(isOrderPaymentCollected({ paymentStatus: "failed" }), false);
  assert.equal(isOrderPaymentCollected({ paymentStatus: "refunded" }), false);
});

test("H. les transitions invalides et permissions sensibles sont refusées côté domaine", () => {
  const delivered = orderContext({
    status: "delivered",
    paymentStatus: "paid",
    fulfillmentStatus: "shipped",
    deliveryStatus: "delivered",
  });
  assert.equal(
    validateOrderAction(delivered, "START_PREPARATION", "ADMIN", {}, policies).allowed,
    false
  );
  assert.equal(
    validateOrderAction(
      orderContext(),
      "CANCEL_ORDER",
      "ORDER_AGENT",
      { reason: "Demandé" },
      policies
    ).allowed,
    false
  );
});

test("I. une adresse modifiée conserve exactement les anciennes et nouvelles valeurs", () => {
  const previous = {
    name: "Afnane",
    phone: "+212600000001",
    address: "10 ancienne rue",
    city: "Rabat",
    state: null,
    zip: null,
  };
  const next = {
    ...previous,
    address: "20 nouvelle avenue",
    city: "Salé",
  };
  assert.deepEqual(buildOrderAddressAuditMetadata(previous, next), {
    previous,
    next,
  });
});

test("J. le bulk distingue les commandes compatibles sans les ignorer silencieusement", () => {
  const compatible = orderContext({ id: "compatible", orderNumber: "ZY-1" });
  const incompatible = orderContext({
    id: "incompatible",
    orderNumber: "ZY-2",
    fulfillmentStatus: "shipped",
    deliveryStatus: "in_transit",
  });
  const validation = validateBulkAction(
    [compatible, incompatible],
    "START_PREPARATION",
    "ORDER_AGENT",
    {},
    policies
  );
  assert.deepEqual(validation.compatible.map((order) => order.id), ["compatible"]);
  assert.equal(validation.incompatible.length, 1);
  assert.match(validation.incompatible[0].reason, /à préparer/);
});

test("les SLA de livraison sélectionnent la zone Rabat-Salé puis le fallback", () => {
  const rabat = computeOrderOperationalState(
    orderContext({
      status: "shipped",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      deliveryStatus: "in_transit",
      trackingNumber: "R-1",
      shippedAt: new Date("2026-08-11T10:00:00.000Z"),
      city: "Salé",
    }),
    policies,
    now
  );
  const casablanca = computeOrderOperationalState(
    orderContext({
      status: "shipped",
      paymentStatus: "paid",
      fulfillmentStatus: "shipped",
      deliveryStatus: "in_transit",
      trackingNumber: "C-1",
      shippedAt: new Date("2026-08-11T10:00:00.000Z"),
      city: "Casablanca",
    }),
    policies,
    now
  );
  assert.equal(rabat.sla?.policyId, "delivery-rabat-sale");
  assert.equal(rabat.sla?.isOverdue, true);
  assert.equal(casablanca.sla?.policyId, "delivery-other");
  assert.equal(casablanca.sla?.isOverdue, false);
});
