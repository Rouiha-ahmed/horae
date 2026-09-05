import React, { FC, useState } from "react";
import Logo from "./Logo";
import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SocialMedia from "./SocialMedia";
import { useOutsideClick } from "@/hooks";
import { cn } from "@/lib/utils";
import type { StorefrontLink, StorefrontSocialLink } from "@/lib/storefront";
import type { Category } from "@/types";
import { buildCategoryTree, organizeHeaderLinks } from "@/lib/navigation-menu";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  links: StorefrontLink[];
  categories: Category[];
  socialLinks: StorefrontSocialLink[];
  pathnameOverride?: string;
}

const SideMenu: FC<SidebarProps> = ({
  isOpen,
  onClose,
  links,
  categories,
  socialLinks,
  pathnameOverride,
}) => {
  const currentPathname = usePathname();
  const pathname = pathnameOverride || currentPathname;
  const { primaryLinks, secondaryLinks } = organizeHeaderLinks(links);
  const { topLevelCategories, childrenByParent } = buildCategoryTree(categories);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  const isHrefActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const closeSidebar = () => {
    setOpenCategories({});
    onClose();
  };
  const sidebarRef = useOutsideClick<HTMLDivElement>(closeSidebar);

  const renderNavLink = (item: StorefrontLink) => (
    <Link
      href={item.href}
      key={item.id}
      onClick={closeSidebar}
      target={item.openInNewTab ? "_blank" : undefined}
      rel={item.openInNewTab ? "noopener noreferrer" : undefined}
      className={cn(
        "border-b border-white/8 px-1 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-all duration-300 ease-out hover:border-shop_light_green/50 hover:text-white",
        isHrefActive(item.href) && "border-shop_light_green text-shop_light_green"
      )}
    >
      {item.title}
    </Link>
  );

  return (
    <div
      className={cn(
        "fixed inset-0 left-0 z-50 w-full bg-black/60 backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
        isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
      )}
    >
      <div
        ref={sidebarRef}
        className="flex h-screen min-w-72 max-w-96 flex-col gap-8 rounded-r-[28px] border-r border-r-shop_light_green/25 bg-[#030b13] p-7 text-[#edf7ff] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-5">
          <Logo />
          <button
            onClick={closeSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/65 hover:border-shop_light_green hover:text-shop_light_green hoverEffect"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="font-menu flex flex-col">
          {primaryLinks.map(renderNavLink)}

          {topLevelCategories.map((category) => {
            const href = `/category/${category.slug.current}`;
            const children = childrenByParent.get(category._id) ?? [];
            const hasChildren = children.length > 0;
            const isActive =
              isHrefActive(href) ||
              children.some((child) => isHrefActive(`/category/${child.slug.current}`));
            const isExpanded = openCategories[category._id] ?? isActive;
            const title = category.title || "Catégorie";

            if (!hasChildren) {
              return (
                <Link
                  key={category._id}
                  href={href}
                  onClick={closeSidebar}
                  className={cn(
                    "border-b border-white/8 px-1 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65 transition-all duration-300 ease-out hover:border-shop_light_green/50 hover:text-white",
                    isActive && "border-shop_light_green text-shop_light_green"
                  )}
                >
                  {title}
                </Link>
              );
            }

            return (
              <div key={category._id} className="rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    setOpenCategories((current) => ({
                      ...current,
                      [category._id]: !isExpanded,
                    }))
                  }
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[15px] text-lightColor transition-all duration-300 ease-out hover:bg-shop_light_bg hover:text-shop_dark_green",
                    isActive && "bg-shop_light_bg text-shop_dark_green"
                  )}
                  aria-expanded={isExpanded}
                  aria-controls={`side-menu-category-${category._id}`}
                >
                  <span>{title}</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                <div
                  id={`side-menu-category-${category._id}`}
                  className={cn(
                    "grid overflow-hidden transition-[grid-template-rows,margin] duration-300 ease-out",
                    isExpanded ? "mt-1 grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden rounded-lg bg-shop_light_bg/55 px-2 py-1">
                    <Link
                      href={href}
                      onClick={closeSidebar}
                      className={cn(
                        "block rounded-lg px-2.5 py-2 text-[13px] font-semibold text-lightColor transition-colors hover:bg-white hover:text-shop_dark_green",
                        isHrefActive(href) && "bg-white text-shop_dark_green"
                      )}
                    >
                      Voir tout {title}
                    </Link>
                    {children.map((child) => {
                      const childHref = `/category/${child.slug.current}`;
                      return (
                        <Link
                          key={child._id}
                          href={childHref}
                          onClick={closeSidebar}
                          className={cn(
                            "block rounded-lg px-2.5 py-1.5 text-sm font-medium text-lightColor transition-colors hover:bg-white hover:text-shop_dark_green",
                            isHrefActive(childHref) && "bg-white text-shop_dark_green"
                          )}
                        >
                          {child.title || "Sous-catégorie"}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          {secondaryLinks.map(renderNavLink)}
        </div>
        <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10">
          <Link
            href="/wishlist"
            onClick={closeSidebar}
            className="bg-[#071522] px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60 hover:text-shop_light_green"
          >
            Favoris
          </Link>
          <Link
            href="/cart"
            onClick={closeSidebar}
            className="bg-[#071522] px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60 hover:text-shop_light_green"
          >
            Panier
          </Link>
        </div>
        <div className="mt-auto border-t border-shop_light_green/20 pt-5">
          <SocialMedia
            links={socialLinks}
            iconClassName="border-white/15 text-white/55 hover:bg-shop_light_green hover:text-black"
            tooltipClassName="bg-shop_light_bg text-shop_dark_green"
          />
        </div>
      </div>
    </div>
  );
};

export default SideMenu;
