"use client";

import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import HomepageRenderer from "@/components/home/HomepageRenderer";
import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import type { HomepageDynamicSection } from "@/lib/homepage-sections";
import {
  buildHomepageDraftData,
  HOMEPAGE_PREVIEW_MESSAGE,
  type HomepagePreviewPayload,
} from "@/lib/homepage-preview";
import type { HomepageWorkspaceSnapshot } from "@/lib/homepage-workspace";
import type { StorefrontShellData } from "@/lib/storefront";

type PreviewState = {
  snapshot: HomepageWorkspaceSnapshot;
  sections: HomepageDynamicSection[];
  selectedZone: string;
};

export default function HomepagePreviewDocument({
  initialSnapshot,
  initialSections,
  baseShell,
}: {
  initialSnapshot: HomepageWorkspaceSnapshot;
  initialSections: HomepageDynamicSection[];
  baseShell: StorefrontShellData;
}) {
  const [preview, setPreview] = useState<PreviewState>({
    snapshot: initialSnapshot,
    sections: initialSections,
    selectedZone: "",
  });

  useEffect(() => {
    const receivePreview = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || !event.data || typeof event.data !== "object") {
        return;
      }

      const message = event.data as { type?: string; payload?: HomepagePreviewPayload };
      if (message.type !== HOMEPAGE_PREVIEW_MESSAGE || !message.payload) return;

      setPreview(message.payload);
    };

    window.addEventListener("message", receivePreview);
    window.parent.postMessage({ type: "zayna:homepage-preview:ready" }, window.location.origin);
    return () => window.removeEventListener("message", receivePreview);
  }, []);

  const data = useMemo(
    () => buildHomepageDraftData(preview.snapshot, preview.sections, baseShell),
    [baseShell, preview.sections, preview.snapshot]
  );

  useEffect(() => {
    document.querySelectorAll("[data-admin-preview-selected]").forEach((element) => {
      element.removeAttribute("data-admin-preview-selected");
    });

    if (!preview.selectedZone) return;

    const selectedSection = data.dynamicSections.find(
      (section) => section.id === preview.selectedZone
    );
    let element = selectedSection
      ? document.getElementById(selectedSection.key)
      : null;

    if (!element && preview.selectedZone === "announcement") {
      const header = document.querySelector<HTMLElement>("header");
      element = header?.previousElementSibling instanceof HTMLElement
        ? header.previousElementSibling
        : header;
    }

    if (!element && (preview.selectedZone === "footer" || preview.selectedZone === "social")) {
      element = document.querySelector<HTMLElement>("footer");
    }

    if (!element) return;
    element.setAttribute("data-admin-preview-selected", "true");
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [data.dynamicSections, preview.selectedZone]);

  const containPreviewNavigation = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const link = target.closest("a");
    const unsafeButton = target.closest("article button, form button");
    if (link || unsafeButton) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <div
      className="min-h-screen bg-white"
      onClickCapture={containPreviewNavigation}
      onSubmitCapture={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <style>{`
        [data-admin-preview-selected] {
          outline: 3px solid rgba(37, 99, 235, 0.9) !important;
          outline-offset: 3px;
          scroll-margin-block: 9rem;
        }
      `}</style>
      <StorefrontHeader shell={data} pathnameOverride="/" />
      <main>
        <HomepageRenderer data={data} />
      </main>
      <StorefrontFooter shell={data} />
    </div>
  );
}
