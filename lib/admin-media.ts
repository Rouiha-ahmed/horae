import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export type UploadDirectory = "brands" | "products" | "categories" | "homepage";

const IMAGE_ROOT = path.join(process.cwd(), "public", "static-assets");
const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_BRAND_LOGO_BYTES = 2 * 1024 * 1024;
const BRAND_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BRAND_LOGO_FORMATS = new Set(["png", "jpeg", "webp"]);

const IMAGE_RULES: Record<
  UploadDirectory,
  { maxWidth: number; maxHeight: number; thumbnailWidth: number }
> = {
  brands: {
    maxWidth: 900,
    maxHeight: 900,
    thumbnailWidth: 240,
  },
  categories: {
    maxWidth: 1200,
    maxHeight: 1200,
    thumbnailWidth: 320,
  },
  products: {
    maxWidth: 1600,
    maxHeight: 1600,
    thumbnailWidth: 420,
  },
  homepage: {
    maxWidth: 1920,
    maxHeight: 1280,
    thumbnailWidth: 640,
  },
};

export const isUploadedFile = (value: FormDataEntryValue | null): value is File =>
  typeof File !== "undefined" && value instanceof File && value.size > 0;

export const saveOptimizedImage = async (
  file: File,
  directory: UploadDirectory,
  baseName: string
) => {
  const maxBytes = directory === "brands" ? MAX_BRAND_LOGO_BYTES : MAX_IMAGE_UPLOAD_BYTES;

  if (file.size > maxBytes) {
    throw new Error(
      directory === "brands"
        ? "Le logo doit faire moins de 2 Mo."
        : "Chaque image doit faire moins de 5 Mo."
    );
  }

  if (
    !file.type.startsWith("image/") ||
    (directory === "brands" && !BRAND_LOGO_MIME_TYPES.has(file.type))
  ) {
    throw new Error(
      directory === "brands"
        ? "Le logo doit etre au format PNG, JPG ou WebP."
        : "Le fichier selectionne doit etre une image."
    );
  }

  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;

  try {
    metadata = await sharp(sourceBuffer).metadata();
  } catch {
    throw new Error("Le fichier image est invalide ou endommage.");
  }

  if (!metadata.width || !metadata.height) {
    throw new Error("Les dimensions de l'image ne peuvent pas etre verifiees.");
  }

  if (directory === "brands" && (!metadata.format || !BRAND_LOGO_FORMATS.has(metadata.format))) {
    throw new Error("Le contenu du logo ne correspond pas a un format PNG, JPG ou WebP valide.");
  }

  if (directory === "brands" && (metadata.width < 32 || metadata.height < 16)) {
    throw new Error("Le logo est trop petit. Utilisez une image d'au moins 32 x 16 px.");
  }

  if (metadata.width * metadata.height > 40_000_000) {
    throw new Error("Les dimensions de l'image sont trop importantes.");
  }

  const safeBaseName = baseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || directory;
  const fileStem = `${safeBaseName}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const rule = IMAGE_RULES[directory];
  const targetDirectory = path.join(IMAGE_ROOT, directory);
  const thumbnailsDirectory = path.join(targetDirectory, "thumbs");
  const optimizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: rule.maxWidth,
      height: rule.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 5,
    })
    .toBuffer();
  const thumbnailBuffer = await sharp(optimizedBuffer)
    .resize({
      width: rule.thumbnailWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: 74,
      effort: 4,
    })
    .toBuffer();

  await mkdir(targetDirectory, { recursive: true });
  await mkdir(thumbnailsDirectory, { recursive: true });

  const fileName = `${fileStem}.webp`;
  await Promise.all([
    writeFile(path.join(targetDirectory, fileName), optimizedBuffer),
    writeFile(path.join(thumbnailsDirectory, fileName), thumbnailBuffer),
  ]);

  return {
    url: `/static-assets/${directory}/${fileName}`,
    thumbnailUrl: `/static-assets/${directory}/thumbs/${fileName}`,
  };
};

const toStoredAssetPaths = (url: string) => {
  if (!url.startsWith("/static-assets/")) {
    return [];
  }

  const relativePath = url.slice("/static-assets/".length);
  const [directory, ...rest] = relativePath.split("/");
  const fileName = rest.join("/");

  if (!directory || !fileName || fileName.startsWith("thumbs/")) {
    return [];
  }

  const originalPath = path.join(IMAGE_ROOT, directory, fileName);
  const thumbnailPath = path.join(IMAGE_ROOT, directory, "thumbs", path.basename(fileName));

  if (!originalPath.startsWith(IMAGE_ROOT) || !thumbnailPath.startsWith(IMAGE_ROOT)) {
    return [];
  }

  return [originalPath, thumbnailPath];
};

export const deleteStoredAsset = async (url: string | null | undefined) => {
  if (!url) {
    return;
  }

  const targetPaths = toStoredAssetPaths(url);

  await Promise.all(
    targetPaths.map((targetPath) =>
      unlink(targetPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") {
          throw error;
        }
      })
    )
  );
};

export const deleteStoredAssets = async (urls: Array<string | null | undefined>) => {
  await Promise.all(urls.map((url) => deleteStoredAsset(url)));
};
