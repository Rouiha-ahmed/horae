import Link from "next/link";

import Container from "@/components/Container";
import HeaderDesktopNav from "@/components/HeaderDesktopNav";
import HeaderMenu from "@/components/HeaderMenu";
import Logo from "@/components/Logo";
import MobileMenu from "@/components/MobileMenu";
import type { StorefrontShellData } from "@/lib/storefront";

export default function StorefrontHeader({
  shell,
  pathnameOverride,
}: {
  shell: StorefrontShellData;
  pathnameOverride?: string;
}) {
  const settings = shell.settings;
  const showAnnouncement = settings.announcementEnabled && settings.announcementText.trim();
  const announcementContent = (
    <p className="line-clamp-1 text-center text-[9px] font-medium uppercase tracking-[0.22em] text-sky-100/75 md:text-[10px]">
      {settings.announcementText}
    </p>
  );

  return (
    <div className="sticky top-0 z-50 px-2 pt-2 sm:px-3">
      {showAnnouncement ? (
        <div className="mx-auto max-w-[1536px] rounded-t-[22px] border border-b-0 border-white/10 bg-[#08253b]/90 px-4 py-1.5 backdrop-blur-xl">
          {settings.announcementHref ? (
            <Link
              href={settings.announcementHref}
              className="mx-auto block max-w-[1300px] px-2 transition-opacity hover:opacity-90"
            >
              {announcementContent}
            </Link>
          ) : (
            <div className="mx-auto max-w-[1300px] px-2">{announcementContent}</div>
          )}
        </div>
      ) : null}

      <header className="mx-auto max-w-[1536px] rounded-[22px] border border-white/10 bg-[#020a12]/78 text-[#edf7ff] shadow-[0_24px_70px_-34px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        <Container className="py-3.5 md:py-4">
          <div className="flex items-center justify-between gap-2 lg:grid lg:grid-cols-[190px_minmax(0,1fr)_auto] lg:gap-7">
            <div className="flex min-w-0 items-center gap-2.5">
              <MobileMenu
                links={shell.headerLinks}
                categories={shell.navigationCategories}
                socialLinks={shell.socialLinks}
                pathnameOverride={pathnameOverride}
              />
              <Logo />
            </div>

            <div className="hidden min-w-0 lg:block">
              <HeaderMenu
                links={shell.headerLinks}
                categories={shell.navigationCategories}
                pathnameOverride={pathnameOverride}
              />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2.5">
              <HeaderDesktopNav />
            </div>
          </div>
        </Container>

      </header>
    </div>
  );
}
