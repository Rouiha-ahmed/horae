"use server";

import { LoyaltyRewardType, LoyaltyTier, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { scanCustomerQualityIssues } from "@/lib/services/admin-customers";
import {
  adjustCustomerPoints,
  redeemReward,
  refreshAllCustomerClassifications,
  expireDueLoyaltyPoints,
  type LoyaltyActor,
  writeAuditLog,
} from "@/lib/services/loyalty";

export type CustomerActionState = {
  success: boolean;
  message?: string;
  error?: string;
};

const readText = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const readInt = (formData: FormData, key: string, min: number, max: number) => {
  const value = Number.parseInt(readText(formData, key), 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Valeur invalide pour ${key}.`);
  }
  return value;
};

const readNumber = (formData: FormData, key: string, min: number, max: number) => {
  const value = Number(readText(formData, key));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Valeur invalide pour ${key}.`);
  }
  return value;
};

const getActor = async (): Promise<LoyaltyActor> => {
  const identity = await requireAdmin();
  return { userId: identity.userId, email: identity.email, label: identity.displayName };
};

const refreshCustomers = (userId?: string) => {
  revalidatePath("/admin/clients");
  revalidatePath("/admin/clients/list");
  revalidatePath("/admin/clients/settings");
  revalidatePath("/admin/clients/quality");
  if (userId) revalidatePath(`/admin/clients/${userId}`);
  revalidatePath("/loyalty");
  revalidatePath("/orders");
};

const asError = (error: unknown) =>
  error instanceof Error ? error.message : "Une erreur inattendue est survenue.";

export async function adjustPointsAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const userId = readText(formData, "userId");
    const direction = readText(formData, "direction");
    const rawAmount = readInt(formData, "amount", 1, 1_000_000);
    const reason = readText(formData, "reason");
    const amount = direction === "remove" ? -rawAmount : rawAmount;
    await adjustCustomerPoints({ userId, amount, reason, actor });
    refreshCustomers(userId);
    return { success: true, message: "Le mouvement de points a été enregistré." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

export async function addCustomerNoteAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const userId = readText(formData, "userId");
    const content = readText(formData, "content");
    if (content.length < 3 || content.length > 2_000) {
      throw new Error("La note doit contenir entre 3 et 2 000 caractères.");
    }
    await prisma.$transaction(async (tx) => {
      const note = await tx.customerNote.create({
        data: { userId, content, createdBy: actor.email || actor.label || actor.userId || "admin" },
      });
      await writeAuditLog(tx, {
        actor,
        action: "customer.note_added",
        entity: "CustomerNote",
        entityId: note.id,
        metadata: { userId },
      });
    });
    refreshCustomers(userId);
    return { success: true, message: "Note interne ajoutée." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

export async function toggleLoyaltySuspensionAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const userId = readText(formData, "userId");
    const suspend = readText(formData, "suspend") === "true";
    const reason = readText(formData, "reason");
    if (suspend && reason.length < 3) throw new Error("Un motif de suspension est obligatoire.");
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          loyaltySuspendedAt: suspend ? new Date() : null,
          loyaltySuspensionReason: suspend ? reason : null,
        },
      });
      await writeAuditLog(tx, {
        actor,
        action: suspend ? "loyalty.suspended" : "loyalty.reactivated",
        entity: "User",
        entityId: userId,
        metadata: { reason: suspend ? reason : null },
      });
    });
    refreshCustomers(userId);
    return { success: true, message: suspend ? "Programme suspendu." : "Programme réactivé." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

export async function redeemRewardAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const userId = readText(formData, "userId");
    await redeemReward({
      userId,
      rewardId: readText(formData, "rewardId"),
      idempotencyKey: readText(formData, "idempotencyKey"),
      actor,
    });
    refreshCustomers(userId);
    return { success: true, message: "Récompense émise et points débités." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

export async function assignCustomerTagsAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const userIds = readText(formData, "userIds").split(",").map((id) => id.trim()).filter(Boolean);
    const tagName = readText(formData, "tagName");
    if (!userIds.length) throw new Error("Sélectionnez au moins un client.");
    if (tagName.length < 2 || tagName.length > 40) throw new Error("Le tag doit contenir 2 à 40 caractères.");
    await prisma.$transaction(async (tx) => {
      const tag = await tx.customerTag.upsert({
        where: { name: tagName },
        create: { name: tagName },
        update: {},
      });
      await tx.customerTagAssignment.createMany({
        data: userIds.map((userId) => ({ userId, tagId: tag.id, assignedBy: actorLabel(actor) })),
        skipDuplicates: true,
      });
      await writeAuditLog(tx, {
        actor,
        action: "customer.tags_assigned",
        entity: "CustomerTag",
        entityId: tag.id,
        metadata: { userIds, tagName },
      });
    });
    refreshCustomers();
    return { success: true, message: `Tag attribué à ${userIds.length} client(s).` };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

function actorLabel(actor: LoyaltyActor) {
  return actor.email || actor.label || actor.userId || "admin";
}

export async function updateLoyaltySettingsAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    if (readText(formData, "confirmMajor") !== "yes") {
      throw new Error("Confirmez l’impact des changements majeurs avant l’enregistrement.");
    }
    const tiers = ["bronze", "silver", "gold"] as LoyaltyTier[];
    const rules = tiers.map((tier) => ({
      tier,
      pointsPer100Mad: readInt(formData, `${tier}PointsPer100Mad`, 1, 1_000),
      revenueThreshold: readNumber(formData, `${tier}RevenueThreshold`, 0, 100_000_000),
      qualificationMonths: readInt(formData, `${tier}QualificationMonths`, 1, 120),
    }));
    if (!(rules[0].revenueThreshold <= rules[1].revenueThreshold && rules[1].revenueThreshold <= rules[2].revenueThreshold)) {
      throw new Error("Les seuils Bronze, Argent et Gold doivent être croissants.");
    }
    const alertDays = readText(formData, "expirationAlertDays")
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= 365)
      .sort((a, b) => b - a);
    if (!alertDays.length) throw new Error("Ajoutez au moins un délai d’alerte valide.");

    await prisma.$transaction(async (tx) => {
      const before = await tx.loyaltyProgramSettings.findUnique({ where: { id: "default" } });
      await tx.loyaltyProgramSettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          statusValidityMonths: readInt(formData, "statusValidityMonths", 1, 120),
          pointExpirationMonths: readInt(formData, "pointExpirationMonths", 1, 120),
          expirationAlertDays: alertDays,
          separateStatusAndPoints: formData.get("separateStatusAndPoints") === "on",
          newCustomerDays: readInt(formData, "newCustomerDays", 1, 365),
          activeCustomerDays: readInt(formData, "activeCustomerDays", 1, 730),
          inactiveCustomerDays: readInt(formData, "inactiveCustomerDays", 30, 3_650),
          loyalMinimumOrders: readInt(formData, "loyalMinimumOrders", 1, 1_000),
          loyalMinimumRevenue: readNumber(formData, "loyalMinimumRevenue", 0, 100_000_000),
          reengagementCycleMultiplier: readNumber(formData, "reengagementCycleMultiplier", 1, 10),
          minimumOrdersForCycle: readInt(formData, "minimumOrdersForCycle", 2, 100),
        },
        update: {
          statusValidityMonths: readInt(formData, "statusValidityMonths", 1, 120),
          pointExpirationMonths: readInt(formData, "pointExpirationMonths", 1, 120),
          expirationAlertDays: alertDays,
          separateStatusAndPoints: formData.get("separateStatusAndPoints") === "on",
          newCustomerDays: readInt(formData, "newCustomerDays", 1, 365),
          activeCustomerDays: readInt(formData, "activeCustomerDays", 1, 730),
          inactiveCustomerDays: readInt(formData, "inactiveCustomerDays", 30, 3_650),
          loyalMinimumOrders: readInt(formData, "loyalMinimumOrders", 1, 1_000),
          loyalMinimumRevenue: readNumber(formData, "loyalMinimumRevenue", 0, 100_000_000),
          reengagementCycleMultiplier: readNumber(formData, "reengagementCycleMultiplier", 1, 10),
          minimumOrdersForCycle: readInt(formData, "minimumOrdersForCycle", 2, 100),
        },
      });
      for (const rule of rules) {
        await tx.loyaltyTierRule.upsert({
          where: { tier: rule.tier },
          create: rule,
          update: rule,
        });
      }
      await writeAuditLog(tx, {
        actor,
        action: "loyalty.settings_updated",
        entity: "LoyaltyProgramSettings",
        entityId: "default",
        metadata: {
          before: before ? JSON.parse(JSON.stringify(before)) : null,
          tiers: rules,
        },
      });
    });
    await refreshAllCustomerClassifications(actor);
    refreshCustomers();
    return { success: true, message: "Paramètres de fidélité enregistrés." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

const rewardTypes = new Set<LoyaltyRewardType>([
  "fixed_discount",
  "free_delivery",
  "percentage_discount",
  "gift",
  "custom",
]);

export async function saveRewardAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const id = readText(formData, "id");
    const name = readText(formData, "name");
    const type = readText(formData, "type") as LoyaltyRewardType;
    if (name.length < 2 || name.length > 100) throw new Error("Nom de récompense invalide.");
    if (!rewardTypes.has(type)) throw new Error("Type de récompense invalide.");
    const pointsCost = readInt(formData, "pointsCost", 1, 1_000_000);
    const monetaryRaw = readText(formData, "monetaryValue");
    const percentageRaw = readText(formData, "percentageValue");
    const data = {
      name,
      description: readText(formData, "description") || null,
      type,
      pointsCost,
      monetaryValue: monetaryRaw ? new Prisma.Decimal(readNumber(formData, "monetaryValue", 0, 10_000_000)) : null,
      percentageValue: percentageRaw ? readInt(formData, "percentageValue", 1, 100) : null,
      isActive: formData.get("isActive") === "on",
    };
    await prisma.$transaction(async (tx) => {
      const reward = id
        ? await tx.loyaltyReward.update({ where: { id }, data })
        : await tx.loyaltyReward.create({ data });
      await writeAuditLog(tx, {
        actor,
        action: id ? "loyalty.reward_updated" : "loyalty.reward_created",
        entity: "LoyaltyReward",
        entityId: reward.id,
        metadata: { name, pointsCost, type },
      });
    });
    refreshCustomers();
    return { success: true, message: id ? "Récompense mise à jour." : "Récompense créée." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}

export async function archiveRewardAction(formData: FormData) {
  const actor = await getActor();
  const id = readText(formData, "id");
  await prisma.$transaction(async (tx) => {
    await tx.loyaltyReward.update({ where: { id }, data: { isActive: false, archivedAt: new Date() } });
    await writeAuditLog(tx, {
      actor,
      action: "loyalty.reward_archived",
      entity: "LoyaltyReward",
      entityId: id,
    });
  });
  refreshCustomers();
}

export async function scanQualityIssuesAction() {
  const actor = await getActor();
  await scanCustomerQualityIssues(actor);
  refreshCustomers();
}

export async function expireLoyaltyPointsAction() {
  const actor = await getActor();
  await expireDueLoyaltyPoints(actor);
  refreshCustomers();
}

export async function reviewQualityIssueAction(formData: FormData) {
  const actor = await getActor();
  const id = readText(formData, "id");
  const status = readText(formData, "status");
  if (!new Set(["reviewed", "resolved", "ignored"]).has(status)) throw new Error("Statut invalide.");
  await prisma.$transaction(async (tx) => {
    await tx.customerQualityIssue.update({
      where: { id },
      data: {
        status: status as "reviewed" | "resolved" | "ignored",
        reviewedAt: new Date(),
        reviewedBy: actorLabel(actor),
        ...(status === "resolved" ? { resolvedAt: new Date() } : {}),
      },
    });
    await writeAuditLog(tx, {
      actor,
      action: `customers.quality_${status}`,
      entity: "CustomerQualityIssue",
      entityId: id,
    });
  });
  refreshCustomers();
}

export async function requestCustomerPrivacyAction(
  _previous: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  try {
    const actor = await getActor();
    const userId = readText(formData, "userId");
    const type = readText(formData, "type");
    if (!new Set(["export", "anonymize", "delete"]).has(type)) throw new Error("Type de demande invalide.");
    const request = await prisma.customerPrivacyRequest.create({
      data: {
        userId,
        type: type as "export" | "anonymize" | "delete",
        reason: readText(formData, "reason") || null,
        requestedBy: actorLabel(actor),
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: type === "anonymize" || type === "delete" ? { anonymizationRequestedAt: new Date() } : {},
    });
    await writeAuditLog(prisma, {
      actor,
      action: "customer.privacy_requested",
      entity: "CustomerPrivacyRequest",
      entityId: request.id,
      metadata: { userId, type },
    });
    refreshCustomers(userId);
    return { success: true, message: "Demande enregistrée pour revue. Aucune donnée n’a été supprimée." };
  } catch (error) {
    return { success: false, error: asError(error) };
  }
}
