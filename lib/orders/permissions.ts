import { requireAdmin, type AdminIdentity } from "@/lib/admin";
import type { OrderOperatorRole } from "@/lib/orders/domain";

const envSet = (name: string) =>
  new Set(
    (process.env[name] || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

export type OrderOperator = {
  userId: string;
  email: string | null;
  displayName: string;
  role: OrderOperatorRole;
};

export const resolveOrderOperatorRole = (identity: AdminIdentity): OrderOperatorRole => {
  const userId = identity.userId?.toLowerCase() || "";
  const email = identity.email?.toLowerCase() || "";
  const agents = envSet("ORDER_AGENT_USER_IDS");
  const agentEmails = envSet("ORDER_AGENT_EMAILS");
  const managers = envSet("ORDER_MANAGER_USER_IDS");
  const managerEmails = envSet("ORDER_MANAGER_EMAILS");

  if (managers.has(userId) || managerEmails.has(email)) return "ORDER_MANAGER";
  if (agents.has(userId) || agentEmails.has(email)) return "ORDER_AGENT";
  return "ADMIN";
};

export const requireOrderOperator = async (): Promise<OrderOperator> => {
  const identity = await requireAdmin();

  return {
    userId: identity.userId as string,
    email: identity.email,
    displayName: identity.displayName || identity.email || identity.userId || "Admin",
    role: resolveOrderOperatorRole(identity),
  };
};
