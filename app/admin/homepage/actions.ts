"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getAdminDataTag, requireAdmin } from "@/lib/admin";
import { isUploadedFile, saveOptimizedImage } from "@/lib/admin-media";
import {
  publishHomepageDraft,
  saveHomepageDraft,
  searchHomepageProducts,
} from "@/lib/homepage-workspace";

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export async function saveHomepageDraftAction(input: unknown, expectedVersion: number) {
  try {
    const identity = await requireAdmin();
    return await saveHomepageDraft({
      input,
      expectedVersion,
      actorUserId: identity.userId,
    });
  } catch (error) {
    return {
      ok: false as const,
      reason: "validation" as const,
      message: messageFromError(error, "Impossible d'enregistrer le brouillon."),
    };
  }
}

export async function publishHomepageDraftAction(expectedVersion: number) {
  try {
    const identity = await requireAdmin();
    const result = await publishHomepageDraft({
      expectedVersion,
      actor: {
        userId: identity.userId,
        email: identity.email,
        displayName: identity.displayName || identity.email || identity.userId || "Administrateur",
      },
    });

    if (result.ok) {
      revalidateTag(getAdminDataTag(), "max");
      revalidatePath("/", "layout");
      revalidatePath("/admin/homepage");
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "CONCURRENT_HOMEPAGE_UPDATE") {
      return {
        ok: false as const,
        reason: "conflict" as const,
        message: "Le brouillon a été modifié par un autre administrateur. Rechargez la page.",
      };
    }
    return {
      ok: false as const,
      reason: "validation" as const,
      message: messageFromError(error, "La publication a échoué."),
    };
  }
}

export async function uploadHomepageImageAction(formData: FormData) {
  try {
    await requireAdmin();
    const file = formData.get("image");
    const title = formData.get("title");
    if (!isUploadedFile(file)) {
      throw new Error("Sélectionnez une image valide.");
    }
    const asset = await saveOptimizedImage(
      file,
      "homepage",
      typeof title === "string" && title.trim() ? title.trim() : "homepage"
    );
    return { ok: true as const, ...asset };
  } catch (error) {
    return {
      ok: false as const,
      message: messageFromError(error, "Le téléversement a échoué."),
    };
  }
}

export async function searchHomepageProductsAction(query: string) {
  try {
    await requireAdmin();
    return { ok: true as const, products: await searchHomepageProducts(query) };
  } catch (error) {
    return {
      ok: false as const,
      message: messageFromError(error, "La recherche de produits a échoué."),
      products: [],
    };
  }
}
