import { prisma } from "@/lib/prisma";
import { mapAddress } from "@/lib/data/mappers";

export type AppUserIdentity = {
  clerkUserId: string;
  fullName: string;
  email: string;
};

export type CreateAddressInput = {
  name: string;
  address: string;
  city: string;
  phone: string;
  state: string;
  zip: string;
  default: boolean;
};

const buildLoyaltyCardNumber = (clerkUserId: string) =>
  `LOY-${clerkUserId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;

export const upsertAppUser = async (identity: AppUserIdentity) =>
  prisma.user.upsert({
    where: {
      clerkUserId: identity.clerkUserId,
    },
    update: {
      fullName: identity.fullName,
      email: identity.email,
    },
    create: {
      clerkUserId: identity.clerkUserId,
      fullName: identity.fullName,
      email: identity.email,
      loyaltyCardNumber: buildLoyaltyCardNumber(identity.clerkUserId),
      loyaltyPoints: 0,
      loyaltyTier: "bronze",
      activitySegment: "NEW",
      installmentsEligible: false,
    },
  });

export const getCheckoutContextForUser = async (identity: AppUserIdentity) => {
  const user = await upsertAppUser(identity);

  return {
    canUseInstallments: Boolean(user.installmentsEligible),
    loyalty: {
      cardNumber: user.loyaltyCardNumber,
      points: user.loyaltyPoints,
      tier: user.loyaltyTier,
    },
  };
};

export const getAddressesForUser = async (identity: AppUserIdentity) => {
  const user = await upsertAppUser(identity);
  const addresses = await prisma.address.findMany({
    where: {
      userId: user.id,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return addresses.map((address) =>
    mapAddress(address, {
      email: user.email,
      clerkUserId: user.clerkUserId,
    })
  );
};

export const createAddressForUser = async (
  identity: AppUserIdentity,
  input: CreateAddressInput
) => {
  const user = await upsertAppUser(identity);

  const address = await prisma.$transaction(async (tx) => {
    if (input.default) {
      await tx.address.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    const existingCount = await tx.address.count({
      where: {
        userId: user.id,
      },
    });

    return tx.address.create({
      data: {
        userId: user.id,
        name: input.name,
        address: input.address,
        city: input.city,
        phone: input.phone,
        state: input.state,
        zip: input.zip,
        isDefault: existingCount === 0 ? true : input.default,
      },
    });
  });

  return mapAddress(address, {
    email: user.email,
    clerkUserId: user.clerkUserId,
  });
};
