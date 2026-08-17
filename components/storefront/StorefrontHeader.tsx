import Link from "next/link";

import Container from "@/components/Container";
import HeaderDesktopNav from "@/components/HeaderDesktopNav";
import HeaderMenu from "@/components/HeaderMenu";
import Logo from "@/components/Logo";
import MobileMenu from "@/components/MobileMenu";
import SearchBar from "@/components/SearchBar";
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
    <p className="line-clamp-1 text-center text-[11px] font-medium text-white/95 md:text-xs">
      {settings.announcementText}
    </p>
  );

  return (
    <div className="sticky top-0 z-50">
      {showAnnouncement ? (
        <div className="border-b border-shop_light_green/20 bg-shop_dark_green px-4 py-1.5">
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

      <header className="border-b border-shop_light_green/20 bg-white/95 shadow-[0_14px_24px_-22px_rgba(22,46,110,0.45)] backdrop-blur-xl">
        <Container className="py-2.5 text-lightColor md:py-3.5">
          <div className="grid items-center gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:gap-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <MobileMenu
                links={shell.headerLinks}
                categories={shell.navigationCategories}
                socialLinks={shell.socialLinks}
                pathnameOverride={pathnameOverride}
              />
              <Logo />
            </div>

            <div className="hidden lg:block">
              <SearchBar mode="desktop" alwaysOpenDesktop />
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <HeaderDesktopNav />
            </div>
          </div>
        </Container>

        <div className="hidden border-t border-shop_light_green/15 bg-[#3870C8] lg:block">
          <Container className="py-2">
            <HeaderMenu
              links={shell.headerLinks}
              categories={shell.navigationCategories}
              pathnameOverride={pathnameOverride}
            />
          </Container>
        </div>
      </header>
    </div>
  );
}
