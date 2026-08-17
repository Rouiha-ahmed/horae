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
        "rounded-xl px-3 py-2 capitalize text-[15px] text-lightColor transition-all duration-300 ease-out hover:bg-shop_light_bg hover:text-shop_dark_green",
        isHrefActive(item.href) && "bg-shop_light_bg text-shop_dark_green"
      )}
    >
      {item.title}
    </Link>
  );

  return (
    <div
      className={cn(
        "fixed inset-0 left-0 z-50 w-full bg-shop_dark_green/10 backdrop-blur-[1.5px] transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
      )}
    >
      <div
        ref={sidebarRef}
        className="flex h-screen min-w-72 max-w-96 flex-col gap-6 border-r border-r-shop_light_green/30 bg-white/95 p-8 text-darkColor shadow-2xl"
      >
        <div className="flex items-center justify-between gap-5">
          <Logo />
          <button
            onClick={closeSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-shop_light_green/35 text-lightColor hover:border-shop_light_green hover:text-shop_dark_green hoverEffect"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="font-menu flex flex-col space-y-1.5 font-extrabold tracking-wide">
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
                    "rounded-xl px-3 py-2 text-[15px] text-lightColor transition-all duration-300 ease-out hover:bg-shop_light_bg hover:text-shop_dark_green",
                    isActive && "bg-shop_light_bg text-shop_dark_green"
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
        <div className="mt-auto border-t border-shop_light_green/20 pt-5">
          <SocialMedia
            links={socialLinks}
            iconClassName="border-shop_light_green/40 text-lightColor hover:bg-shop_dark_green hover:border-shop_dark_green"
            tooltipClassName="bg-shop_dark_green text-white"
          />
        </div>
      </div>
    </div>
  );
};

export default SideMenu;
