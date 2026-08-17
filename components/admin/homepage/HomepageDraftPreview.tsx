"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Monitor, Smartphone, Tablet } from "lucide-react";

import type { HomepageDynamicSection } from "@/lib/homepage-sections";
import {
  HOMEPAGE_PREVIEW_MESSAGE,
  type HomepagePreviewPayload,
} from "@/lib/homepage-preview";
import type { HomepageWorkspaceSnapshot } from "@/lib/homepage-workspace";
import { cn } from "@/lib/utils";

export type HomepagePreviewViewport = "desktop" | "tablet" | "mobile";

const viewportWidths: Record<HomepagePreviewViewport, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

export function HomepageViewportSwitch({
  value,
  onChange,
}: {
  value: HomepagePreviewViewport;
  onChange: (value: HomepagePreviewViewport) => void;
}) {
  const options = [
    { value: "desktop" as const, label: "Desktop", icon: Monitor },
    { value: "tablet" as const, label: "Tablette", icon: Tablet },
    { value: "mobile" as const, label: "Mobile", icon: Smartphone },
  ];

  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition",
              value === option.value
                ? "bg-white text-[#102a63] shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function HomepageDraftPreview({
  snapshot,
  sections,
  selectedZone,
  viewport,
  className,
}: {
  snapshot: HomepageWorkspaceSnapshot;
  sections: HomepageDynamicSection[];
  selectedZone: string;
  viewport: HomepagePreviewViewport;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dimensions, setDimensions] = useState({ scale: 1, height: 680 });
  const targetWidth = viewportWidths[viewport];

  const postPreview = useCallback(() => {
    const payload: HomepagePreviewPayload = { snapshot, sections, selectedZone };
    iframeRef.current?.contentWindow?.postMessage(
      { type: HOMEPAGE_PREVIEW_MESSAGE, payload },
      window.location.origin
    );
  }, [sections, selectedZone, snapshot]);

  useEffect(() => {
    postPreview();
  }, [postPreview]);

  useEffect(() => {
    const receiveReady = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== "object" ||
        (event.data as { type?: string }).type !== "zayna:homepage-preview:ready"
      ) {
        return;
      }
      postPreview();
    };

    window.addEventListener("message", receiveReady);
    return () => window.removeEventListener("message", receiveReady);
  }, [postPreview]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const availableWidth = Math.max(1, rect.width - 24);
      const availableHeight = Math.max(1, rect.height - 24);
      const scale = Math.min(1, availableWidth / targetWidth);
      setDimensions({ scale, height: availableHeight });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [targetWidth]);

  const renderedWidth = targetWidth * dimensions.scale;
  const iframeHeight = dimensions.height / dimensions.scale;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full min-h-0 overflow-hidden bg-slate-200/70 p-3",
        className
      )}
    >
      <div
        className="mx-auto overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_24px_70px_-42px_rgba(15,35,78,0.65)]"
        style={{ width: renderedWidth, height: dimensions.height }}
      >
        <iframe
          ref={iframeRef}
          src="/admin-homepage-preview"
          title={`Aperçu ${viewport} de la homepage en brouillon`}
          onLoad={postPreview}
          className="block border-0 bg-white"
          style={{
            width: targetWidth,
            height: iframeHeight,
            transform: `scale(${dimensions.scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}
