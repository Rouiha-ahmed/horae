export type OrderNextAction =
  | "RESOLVE_BLOCKING_INCIDENT"
  | "RESOLVE_DELIVERY_INCIDENT"
  | "COMPLETE_CUSTOMER_INFORMATION"
  | "CONFIRM_ORDER"
  | "VERIFY_PAYMENT"
  | "START_PREPARATION"
  | "MARK_READY"
  | "SHIP_ORDER"
  | "ADD_TRACKING"
  | "PROCESS_RETURN"
  | "NONE";

export type OrderAction =
  | Exclude<OrderNextAction, "NONE" | "COMPLETE_CUSTOMER_INFORMATION" | "RESOLVE_BLOCKING_INCIDENT">
  | "UPDATE_CUSTOMER_INFORMATION"
  | "MARK_DELIVERED"
  | "CANCEL_ORDER";

export type OrderAttentionLevel = "CRITICAL" | "ACTION_TODAY" | "WATCH" | "NORMAL";
export type OrderOperatorRole = "ORDER_AGENT" | "ORDER_MANAGER" | "ADMIN";
export type OrderIssueSeverity = "critical" | "warning" | "info";
export type OrderIssueCode =
  | "MISSING_PHONE"
  | "INVALID_ADDRESS"
  | "UNKNOWN_CITY"
  | "PAYMENT_FAILED"
  | "STOCK_PROBLEM"
  | "PREPARATION_DELAY"
  | "SHIPMENT_DELAY"
  | "MISSING_TRACKING"
  | "DELIVERY_FAILED"
  | "CUSTOMER_UNREACHABLE"
  | "RETURN_ACTION_REQUIRED";

export type OrderSlaStage = "preparation" | "shipping" | "delivery";

export type OrderSlaPolicy = {
  id: string;
  stage: OrderSlaStage;
  durationHours: number;
  workingDays: boolean;
  applicableCarrier: string | null;
  applicableZone: string | null;
  priority: number;
};

export type OrderDomainItem = {
  id?: string;
  name: string;
  sku?: string | null;
  quantity: number;
  stockAvailable?: boolean;
};

export type OrderDomainReturn = {
  id: string;
  status: string;
};

export type OrderDomainContext = {
  id: string;
  orderNumber: string;
  orderDate: Date;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  confirmationRequired: boolean;
  confirmedAt: Date | null;
  preparationStartedAt: Date | null;
  preparedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  estimatedDeliveryAt: Date | null;
  deliveryCompany: string | null;
  trackingNumber: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  customerUnreachable?: boolean;
  items: OrderDomainItem[];
  returns: OrderDomainReturn[];
};

export type ComputedOrderSla = {
  stage: OrderSlaStage;
  policyId: string;
  dueAt: Date;
  isOverdue: boolean;
  elapsedMs: number;
} | null;

export type ComputedOrderIssue = {
  code: OrderIssueCode;
  severity: OrderIssueSeverity;
  message: string;
  recommendedAction: OrderNextAction;
  status: "open";
  blocking: boolean;
};

export type OrderOperationalState = {
  nextAction: OrderNextAction;
  attentionLevel: OrderAttentionLevel;
  issues: ComputedOrderIssue[];
  sla: ComputedOrderSla;
  isInWorkQueue: boolean;
  priorityScore: number;
};

export const collectedPaymentStatuses = ["paid"] as const;

export const isOrderPaymentCollected = (order: { paymentStatus: string }) =>
  collectedPaymentStatuses.includes(
    order.paymentStatus as (typeof collectedPaymentStatuses)[number]
  );

export type OrderAddressSnapshot = {
  name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export const buildOrderAddressAuditMetadata = (
  previous: OrderAddressSnapshot,
  next: OrderAddressSnapshot
) => ({ previous: { ...previous }, next: { ...next } });

const terminalFulfillmentStatuses = new Set(["cancelled"]);
const closedReturnStatuses = new Set(["closed", "rejected"]);

const normalizeText = (value: string | null | undefined) =>
  (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const getOrderZone = (city: string | null | undefined) => {
  const normalized = normalizeText(city);

  if (["rabat", "sale", "rabat-sale", "sale-rabat"].includes(normalized)) {
    return "rabat-sale";
  }

  return normalized || "other";
};

const nextWorkingHour = (value: Date) => {
  const date = new Date(value);
  date.setHours(date.getHours() + 1);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
    date.setHours(0, 0, 0, 0);
  }

  return date;
};

export const addSlaHours = (start: Date, durationHours: number, workingDays: boolean) => {
  if (!workingDays) {
    return new Date(start.getTime() + durationHours * 60 * 60 * 1000);
  }

  let current = new Date(start);
  let hoursRemaining = Math.max(0, durationHours);

  while (hoursRemaining > 0) {
    current = nextWorkingHour(current);
    hoursRemaining -= 1;
  }

  return current;
};

export const resolveOrderSlaPolicy = (
  policies: OrderSlaPolicy[],
  stage: OrderSlaStage,
  order: OrderDomainContext
) => {
  const zone = getOrderZone(order.city);
  const carrier = normalizeText(order.deliveryCompany);

  return policies
    .filter((policy) => policy.stage === stage)
    .filter(
      (policy) =>
        !policy.applicableZone || normalizeText(policy.applicableZone) === zone
    )
    .filter(
      (policy) =>
        !policy.applicableCarrier ||
        normalizeText(policy.applicableCarrier) === carrier
    )
    .sort((left, right) => {
      const leftSpecificity = Number(Boolean(left.applicableZone)) + Number(Boolean(left.applicableCarrier));
      const rightSpecificity = Number(Boolean(right.applicableZone)) + Number(Boolean(right.applicableCarrier));
      return rightSpecificity - leftSpecificity || right.priority - left.priority;
    })[0];
};

export const computeSla = (
  order: OrderDomainContext,
  policies: OrderSlaPolicy[],
  now = new Date()
): ComputedOrderSla => {
  if (
    order.status === "cancelled" ||
    order.deliveryStatus === "delivered" ||
    terminalFulfillmentStatuses.has(order.fulfillmentStatus)
  ) {
    return null;
  }

  let stage: OrderSlaStage;
  let startedAt: Date;

  if (["to_prepare", "preparing"].includes(order.fulfillmentStatus)) {
    stage = "preparation";
    startedAt = order.orderDate;
  } else if (order.fulfillmentStatus === "ready") {
    stage = "shipping";
    startedAt = order.preparedAt || order.orderDate;
  } else if (
    order.fulfillmentStatus === "shipped" &&
    !["delivered", "failed", "returned"].includes(order.deliveryStatus)
  ) {
    stage = "delivery";
    startedAt = order.shippedAt || order.orderDate;
  } else {
    return null;
  }

  const policy = resolveOrderSlaPolicy(policies, stage, order);

  if (!policy) {
    return null;
  }

  const dueAt = addSlaHours(startedAt, policy.durationHours, policy.workingDays);

  return {
    stage,
    policyId: policy.id,
    dueAt,
    isOverdue: now.getTime() > dueAt.getTime(),
    elapsedMs: Math.max(0, now.getTime() - startedAt.getTime()),
  };
};

export const computeOrderIssues = (
  order: OrderDomainContext,
  sla: ComputedOrderSla,
  options: { knownCities?: string[] } = {}
): ComputedOrderIssue[] => {
  const issues: ComputedOrderIssue[] = [];
  const push = (issue: Omit<ComputedOrderIssue, "status">) =>
    issues.push({ ...issue, status: "open" });

  if (!order.phone?.trim()) {
    push({
      code: "MISSING_PHONE",
      severity: "critical",
      message: "Téléphone client manquant",
      recommendedAction: "COMPLETE_CUSTOMER_INFORMATION",
      blocking: true,
    });
  }

  if (!order.address?.trim() || !order.city?.trim()) {
    push({
      code: "INVALID_ADDRESS",
      severity: "critical",
      message: "Adresse de livraison à compléter",
      recommendedAction: "COMPLETE_CUSTOMER_INFORMATION",
      blocking: true,
    });
  } else if (
    options.knownCities?.length &&
    !options.knownCities.map(normalizeText).includes(normalizeText(order.city))
  ) {
    push({
      code: "UNKNOWN_CITY",
      severity: "warning",
      message: "Ville non reconnue dans les zones configurées",
      recommendedAction: "COMPLETE_CUSTOMER_INFORMATION",
      blocking: true,
    });
  }

  if (order.paymentStatus === "failed") {
    push({
      code: "PAYMENT_FAILED",
      severity: "critical",
      message: "Paiement échoué",
      recommendedAction: "VERIFY_PAYMENT",
      blocking: true,
    });
  }

  if (order.items.some((item) => item.stockAvailable === false)) {
    push({
      code: "STOCK_PROBLEM",
      severity: "critical",
      message: "Disponibilité produit à résoudre",
      recommendedAction: "RESOLVE_BLOCKING_INCIDENT",
      blocking: true,
    });
  }

  if (sla?.isOverdue && sla.stage === "preparation") {
    push({
      code: "PREPARATION_DELAY",
      severity: "critical",
      message: "Préparation en retard selon le SLA",
      recommendedAction:
        order.fulfillmentStatus === "preparing" ? "MARK_READY" : "START_PREPARATION",
      blocking: false,
    });
  }

  if (sla?.isOverdue && ["shipping", "delivery"].includes(sla.stage)) {
    push({
      code: "SHIPMENT_DELAY",
      severity: "critical",
      message: sla.stage === "shipping" ? "Expédition en retard" : "Livraison en retard",
      recommendedAction: sla.stage === "shipping" ? "SHIP_ORDER" : "RESOLVE_DELIVERY_INCIDENT",
      blocking: false,
    });
  }

  if (
    order.fulfillmentStatus === "shipped" &&
    !order.trackingNumber?.trim() &&
    !["delivered", "returned"].includes(order.deliveryStatus)
  ) {
    push({
      code: "MISSING_TRACKING",
      severity: "warning",
      message: "Numéro de suivi manquant",
      recommendedAction: "ADD_TRACKING",
      blocking: false,
    });
  }

  if (["failed", "delayed"].includes(order.deliveryStatus)) {
    push({
      code: "DELIVERY_FAILED",
      severity: "critical",
      message:
        order.deliveryStatus === "failed"
          ? "Échec de livraison à traiter"
          : "Retard transporteur signalé à traiter",
      recommendedAction: "RESOLVE_DELIVERY_INCIDENT",
      blocking: true,
    });
  }

  if (order.customerUnreachable) {
    push({
      code: "CUSTOMER_UNREACHABLE",
      severity: "critical",
      message: "Client injoignable",
      recommendedAction: "COMPLETE_CUSTOMER_INFORMATION",
      blocking: true,
    });
  }

  if (order.returns.some((item) => !closedReturnStatuses.has(item.status))) {
    push({
      code: "RETURN_ACTION_REQUIRED",
      severity: "warning",
      message: "Retour à examiner",
      recommendedAction: "PROCESS_RETURN",
      blocking: false,
    });
  }

  return issues;
};

export const computeNextAction = (
  order: OrderDomainContext,
  issues: ComputedOrderIssue[]
): OrderNextAction => {
  if (order.status === "cancelled" || order.fulfillmentStatus === "cancelled") {
    return issues.some((issue) => issue.code === "RETURN_ACTION_REQUIRED")
      ? "PROCESS_RETURN"
      : "NONE";
  }

  const blockingIssue = issues.find(
    (issue) => issue.blocking && issue.code === "STOCK_PROBLEM"
  );

  if (blockingIssue) {
    return blockingIssue.recommendedAction;
  }

  if (
    ["failed", "delayed"].includes(order.deliveryStatus) ||
    issues.some((issue) => issue.code === "DELIVERY_FAILED")
  ) {
    return "RESOLVE_DELIVERY_INCIDENT";
  }

  if (issues.some((issue) => ["MISSING_PHONE", "INVALID_ADDRESS", "UNKNOWN_CITY", "CUSTOMER_UNREACHABLE"].includes(issue.code))) {
    return "COMPLETE_CUSTOMER_INFORMATION";
  }

  if (order.confirmationRequired && !order.confirmedAt) {
    return "CONFIRM_ORDER";
  }

  const codAwaitingCollection =
    order.paymentMethod === "cod" &&
    order.paymentStatus !== "paid" &&
    order.deliveryStatus === "delivered";
  const electronicPaymentNeedsVerification =
    order.paymentMethod !== "cod" &&
    ["pending", "partial", "failed"].includes(order.paymentStatus);

  if (codAwaitingCollection || electronicPaymentNeedsVerification) {
    return "VERIFY_PAYMENT";
  }

  if (order.fulfillmentStatus === "to_prepare") {
    return "START_PREPARATION";
  }

  if (order.fulfillmentStatus === "preparing") {
    return "MARK_READY";
  }

  if (order.fulfillmentStatus === "ready") {
    return "SHIP_ORDER";
  }

  if (
    order.fulfillmentStatus === "shipped" &&
    !order.trackingNumber?.trim() &&
    !["delivered", "returned"].includes(order.deliveryStatus)
  ) {
    return "ADD_TRACKING";
  }

  if (issues.some((issue) => issue.code === "RETURN_ACTION_REQUIRED")) {
    return "PROCESS_RETURN";
  }

  return "NONE";
};

export const computeAttentionLevel = (
  order: OrderDomainContext,
  nextAction: OrderNextAction,
  issues: ComputedOrderIssue[],
  sla: ComputedOrderSla
): OrderAttentionLevel => {
  if (
    issues.some((issue) => issue.severity === "critical") ||
    ["failed", "delayed"].includes(order.deliveryStatus) ||
    sla?.isOverdue
  ) {
    return "CRITICAL";
  }

  if (nextAction !== "NONE") {
    return "ACTION_TODAY";
  }

  if (["in_transit", "out_for_delivery", "delayed"].includes(order.deliveryStatus)) {
    return "WATCH";
  }

  return "NORMAL";
};

export const computeOrderOperationalState = (
  order: OrderDomainContext,
  policies: OrderSlaPolicy[],
  now = new Date()
): OrderOperationalState => {
  const sla = computeSla(order, policies, now);
  const issues = computeOrderIssues(order, sla);
  const nextAction = computeNextAction(order, issues);
  const attentionLevel = computeAttentionLevel(order, nextAction, issues, sla);
  const isInWorkQueue =
    attentionLevel === "CRITICAL" ||
    attentionLevel === "ACTION_TODAY" ||
    nextAction !== "NONE";
  const priorityScore =
    (attentionLevel === "CRITICAL" ? 1_000 : attentionLevel === "ACTION_TODAY" ? 500 : attentionLevel === "WATCH" ? 100 : 0) +
    (sla?.isOverdue ? 250 : 0) +
    issues.filter((issue) => issue.blocking).length * 100 +
    (nextAction !== "NONE" ? 25 : 0);

  return { nextAction, attentionLevel, issues, sla, isInWorkQueue, priorityScore };
};

const actionRoleLevel: Record<OrderOperatorRole, number> = {
  ORDER_AGENT: 1,
  ORDER_MANAGER: 2,
  ADMIN: 3,
};

const sensitiveActions = new Set<OrderAction>(["CANCEL_ORDER", "VERIFY_PAYMENT", "PROCESS_RETURN"]);

export const canRolePerformOrderAction = (role: OrderOperatorRole, action: OrderAction) =>
  !sensitiveActions.has(action) || actionRoleLevel[role] >= actionRoleLevel.ORDER_MANAGER;

export type OrderActionValidation = { allowed: true } | { allowed: false; reason: string };

export const validateOrderAction = (
  order: OrderDomainContext,
  action: OrderAction,
  role: OrderOperatorRole,
  options: { reason?: string; carrier?: string; trackingNumber?: string } = {},
  policies: OrderSlaPolicy[] = []
): OrderActionValidation => {
  if (!canRolePerformOrderAction(role, action)) {
    return { allowed: false, reason: "Votre rôle ne permet pas cette action sensible." };
  }

  if (sensitiveActions.has(action) && !options.reason?.trim()) {
    return { allowed: false, reason: "Un motif est obligatoire pour cette action sensible." };
  }

  const operational = computeOrderOperationalState(order, policies);

  if (action === "UPDATE_CUSTOMER_INFORMATION") {
    return { allowed: true };
  }

  if (action === "CONFIRM_ORDER") {
    return order.confirmationRequired && !order.confirmedAt && order.status !== "cancelled"
      ? { allowed: true }
      : { allowed: false, reason: "Cette commande ne nécessite plus de confirmation." };
  }

  if (action === "START_PREPARATION") {
    if (order.fulfillmentStatus !== "to_prepare") {
      return { allowed: false, reason: "Seule une commande à préparer peut démarrer en préparation." };
    }
    if (order.confirmationRequired && !order.confirmedAt) {
      return { allowed: false, reason: "La confirmation requise doit être effectuée avant la préparation." };
    }
    if (operational.issues.some((issue) => issue.blocking)) {
      return { allowed: false, reason: "Résolvez les anomalies bloquantes avant la préparation." };
    }
    return { allowed: true };
  }

  if (action === "MARK_READY") {
    return order.fulfillmentStatus === "preparing"
      ? { allowed: true }
      : { allowed: false, reason: "La préparation doit être en cours avant de marquer la commande prête." };
  }

  if (action === "SHIP_ORDER") {
    if (order.fulfillmentStatus !== "ready") {
      return { allowed: false, reason: "La commande doit être prête avant l'expédition." };
    }
    if (!(options.carrier || order.deliveryCompany)?.trim()) {
      return { allowed: false, reason: "Un transporteur est obligatoire pour expédier." };
    }
    return { allowed: true };
  }

  if (action === "ADD_TRACKING") {
    if (order.fulfillmentStatus !== "shipped") {
      return { allowed: false, reason: "Le suivi ne peut être ajouté qu'après l'expédition." };
    }
    return options.trackingNumber?.trim()
      ? { allowed: true }
      : { allowed: false, reason: "Le numéro de suivi est obligatoire." };
  }

  if (action === "MARK_DELIVERED") {
    return order.fulfillmentStatus === "shipped" && ["in_transit", "out_for_delivery", "delayed"].includes(order.deliveryStatus)
      ? { allowed: true }
      : { allowed: false, reason: "Seule une commande expédiée peut être marquée livrée." };
  }

  if (action === "VERIFY_PAYMENT") {
    if (["paid", "refunded"].includes(order.paymentStatus)) {
      return { allowed: false, reason: "Le paiement est déjà finalisé." };
    }
    if (order.paymentMethod === "cod" && order.deliveryStatus !== "delivered") {
      return { allowed: false, reason: "Le COD ne peut être encaissé qu'après la livraison client." };
    }
    return { allowed: true };
  }

  if (action === "RESOLVE_DELIVERY_INCIDENT") {
    return ["failed", "delayed"].includes(order.deliveryStatus)
      ? { allowed: true }
      : { allowed: false, reason: "Aucun incident de livraison n'est ouvert." };
  }

  if (action === "PROCESS_RETURN") {
    return order.returns.some((item) => !closedReturnStatuses.has(item.status))
      ? { allowed: true }
      : { allowed: false, reason: "Aucun retour ouvert n'est à traiter." };
  }

  if (action === "CANCEL_ORDER") {
    return order.status !== "cancelled" && order.deliveryStatus !== "delivered"
      ? { allowed: true }
      : { allowed: false, reason: "Une commande livrée ou déjà annulée ne peut pas être annulée." };
  }

  return { allowed: false, reason: "Action inconnue ou non disponible." };
};

export const validateBulkAction = (
  orders: OrderDomainContext[],
  action: Extract<OrderAction, "START_PREPARATION" | "MARK_READY" | "SHIP_ORDER">,
  role: OrderOperatorRole,
  options: { carrier?: string } = {},
  policies: OrderSlaPolicy[] = []
) => {
  const compatible: OrderDomainContext[] = [];
  const incompatible: Array<{ id: string; orderNumber: string; reason: string }> = [];

  for (const order of orders) {
    const validation = validateOrderAction(order, action, role, options, policies);
    if (validation.allowed) compatible.push(order);
    else incompatible.push({ id: order.id, orderNumber: order.orderNumber, reason: validation.reason });
  }

  return { compatible, incompatible };
};

export const nextActionLabels: Record<OrderNextAction, { title: string; button: string }> = {
  RESOLVE_BLOCKING_INCIDENT: { title: "Résoudre l'anomalie bloquante", button: "Traiter l'anomalie" },
  RESOLVE_DELIVERY_INCIDENT: { title: "Traiter l'incident de livraison", button: "Traiter l'incident" },
  COMPLETE_CUSTOMER_INFORMATION: { title: "Compléter les informations client", button: "Corriger les informations" },
  CONFIRM_ORDER: { title: "Confirmer cette commande", button: "Confirmer" },
  VERIFY_PAYMENT: { title: "Vérifier ou encaisser le paiement", button: "Valider le paiement" },
  START_PREPARATION: { title: "Préparer cette commande", button: "Commencer" },
  MARK_READY: { title: "Terminer la préparation", button: "Marquer prête" },
  SHIP_ORDER: { title: "Expédier cette commande", button: "Expédier" },
  ADD_TRACKING: { title: "Ajouter le suivi transporteur", button: "Ajouter le tracking" },
  PROCESS_RETURN: { title: "Examiner le retour", button: "Traiter le retour" },
  NONE: { title: "Aucune action opérationnelle", button: "Aucune action" },
};
