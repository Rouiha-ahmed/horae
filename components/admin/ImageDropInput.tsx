"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Image from "next/image";
import { ImagePlus, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImageDropInputProps = {
  id: string;
  name: string;
  label: string;
  helper?: string;
  accept?: string;
  multiple?: boolean;
  existingImageUrls?: string[];
  maxFiles?: number;
  maxSizeMb?: number;
  formatLabel?: string;
};

const defaultAccept = "image/png,image/jpeg,image/webp,image/avif";

const buildPreviewList = (files: File[]) =>
  files.map((file) => ({
    name: file.name,
    url: URL.createObjectURL(file),
  }));

const ImageDropInput = ({
  id,
  name,
  label,
  helper,
  accept = defaultAccept,
  multiple = false,
  existingImageUrls = [],
  maxFiles,
  maxSizeMb = 5,
  formatLabel = "JPG, PNG, WebP ou AVIF",
}: ImageDropInputProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState("");

  const previews = useMemo(() => buildPreviewList(files), [files]);

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [previews]
  );

  const syncFiles = (nextFiles: File[]) => {
    const acceptedTypes = accept.split(",").map((value) => value.trim());
    const invalidType = nextFiles.find(
      (file) =>
        !acceptedTypes.includes(file.type) &&
        !acceptedTypes.some(
          (acceptedType) =>
            acceptedType.endsWith("/*") && file.type.startsWith(acceptedType.slice(0, -1))
        )
    );

    if (invalidType) {
      setValidationError(`${invalidType.name} n'est pas dans un format accepte.`);
      return;
    }

    const oversizedFile = nextFiles.find((file) => file.size > maxSizeMb * 1024 * 1024);

    if (oversizedFile) {
      setValidationError(`${oversizedFile.name} depasse la limite de ${maxSizeMb} Mo.`);
      return;
    }

    setValidationError("");
    const limitedFiles =
      typeof maxFiles === "number" ? nextFiles.slice(0, maxFiles) : nextFiles;
    const finalFiles = multiple ? limitedFiles : limitedFiles.slice(0, 1);
    const transfer = new DataTransfer();

    finalFiles.forEach((file) => transfer.items.add(file));

    if (inputRef.current) {
      inputRef.current.files = transfer.files;
    }

    setFiles(finalFiles);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    syncFiles(Array.from(event.target.files || []));
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    syncFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }

    setFiles([]);
    setValidationError("");
  };

  const gallery = previews.length
    ? previews
    : existingImageUrls.map((url, index) => ({
        name: `image-${index + 1}`,
        url,
      }));

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-semibold text-slate-900">
          {label}
        </label>
        {helper ? <p className="text-xs leading-5 text-slate-500">{helper}</p> : null}
      </div>

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={handleChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "group flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed px-4 py-6 text-center transition-all",
          isDragging
            ? "border-shop_btn_dark_green bg-shop_light_green/10 shadow-[0_18px_40px_-30px_rgba(16,38,84,0.65)]"
            : "border-slate-300 bg-slate-50/70 hover:border-shop_btn_dark_green/40 hover:bg-white"
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-shop_btn_dark_green shadow-sm transition-transform group-hover:-translate-y-0.5">
          {gallery.length ? <ImagePlus className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            Glissez vos images ici ou cliquez pour les choisir
          </p>
          <p className="text-xs text-slate-500">
            {formatLabel}, {maxSizeMb} Mo max par image
            {maxFiles ? `, jusqu'a ${maxFiles} fichier(s)` : ""}
          </p>
        </div>
      </button>

      {validationError ? (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {validationError}
        </p>
      ) : null}

      {gallery.length ? (
        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.32)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-700">
              {previews.length
                ? `${previews.length} image(s) prete(s) a l'envoi`
                : `${existingImageUrls.length} image(s) actuellement affichee(s)`}
            </p>
            {previews.length ? (
              <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
                <X className="h-4 w-4" />
                Vider
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {gallery.map((preview) => (
              <div
                key={preview.url}
                className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50"
              >
                <div className="relative aspect-[4/3] bg-white">
                  <Image
                    src={preview.url}
                    alt={preview.name}
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 14rem, (min-width: 640px) 12rem, 100vw"
                    className="object-contain p-3"
                  />
                </div>
                <div className="border-t border-slate-200 px-3 py-2">
                  <p className="truncate text-xs text-slate-500">{preview.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ImageDropInput;
