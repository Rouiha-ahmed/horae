"use client";
import { cn } from "@/lib/utils";
import { buildCategoryTree, organizeHeaderLinks } from "@/lib/navigation-menu";
import type { StorefrontLink } from "@/lib/storefront";
import type { Category } from "@/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import React from "react";

interface HeaderMenuProps {
  links: StorefrontLink[];
  categories: Category[];
  className?: string;
  isSearchActive?: boolean;
  pathnameOverride?: string;
}

const HeaderMenu = ({
  links,
  categories,
  className,
  isSearchActive = false,
  pathnameOverride,
}: HeaderMenuProps) => {
  const currentPathname = usePathname();
  const pathname = pathnameOverride || currentPathname;
  const { primaryLinks, secondaryLinks } = organizeHeaderLinks(links);
  const { topLevelCategories, childrenByParent } = buildCategoryTree(categories);

  const isHrefActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const renderLink = (item: StorefrontLink) => {
    const isActive = isHrefActive(item.href);

    return (
      <Link
        key={item.id}
        href={item.href}
        target={item.openInNewTab ? "_blank" : undefined}
        rel={item.openInNewTab ? "noopener noreferrer" : undefined}
        className={cn(
          "group relative whitespace-nowrap px-2 py-2 text-[9px] font-medium uppercase tracking-[0.18em] transition-all duration-300 ease-out xl:px-3",
          isActive ? "text-shop_light_green" : "text-white/52 hover:text-white"
        )}
      >
        <span>{item.title}</span>
        <span
          className={cn(
            "absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-shop_light_green transition-all duration-300 ease-out group-hover:w-[46%]",
            isActive && "w-[58%]"
          )}
        />
      </Link>
    );
  };

  return (
    <nav
      className={cn(
        "font-menu flex w-full min-w-0 items-center justify-center gap-1 text-white transition-all duration-300 ease-out xl:gap-2",
        isSearchActive && "gap-1",
        className
      )}
      aria-label="Navigation principale"
    >
      {primaryLinks.map(renderLink)}

      {topLevelCategories.map((category) => {
        const href = `/category/${category.slug.current}`;
        const children = childrenByParent.get(category._id) ?? [];
        const hasChildren = children.length > 0;
        const isActive =
          isHrefActive(href) ||
          children.some((child) => isHrefActive(`/category/${child.slug.current}`));
        const categoryTitle = category.title || "Catégorie";

        if (!hasChildren) {
          return (
            <Link
              key={category._id}
              href={href}
              className={cn(
                "group relative whitespace-nowrap px-2 py-2 text-[9px] font-medium uppercase tracking-[0.18em] transition-all duration-300 ease-out xl:px-3",
                isActive ? "text-shop_light_green" : "text-white/58 hover:text-white"
              )}
            >
              <span>{categoryTitle}</span>
              <span
                className={cn(
                  "absolute bottom-0 left-1/2 h-px w-0 -translate-x-1/2 bg-shop_light_green transition-all duration-300 ease-out group-hover:w-[46%]",
                  isActive && "w-[58%]"
                )}
              />
            </Link>
          );
        }

        return (
          <div key={category._id} className="group relative">
            <Link
              href={href}
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap px-2 py-2 text-[9px] font-medium uppercase tracking-[0.18em] transition-all duration-300 ease-out xl:px-3",
                isActive ? "text-shop_light_green" : "text-white/58 hover:text-white"
              )}
            >
              {categoryTitle}
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>

            <div className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-40 w-[20rem] translate-y-1 rounded-2xl border border-white/10 bg-[#071522]/95 p-3 opacity-0 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                <Link
                  href={href}
                  className={cn(
                    "block px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/60 transition-colors hover:bg-white/[0.06] hover:text-shop_light_green",
                    isHrefActive(href) && "bg-white/[0.06] text-shop_light_green"
                  )}
                >
                  Voir tout {categoryTitle}
                </Link>
                  <div className="my-1 h-px bg-white/10" />
                {children.map((child) => {
                  const childHref = `/category/${child.slug.current}`;
                  return (
                    <Link
                      key={child._id}
                      href={childHref}
                      className={cn(
                        "block px-3 py-2 text-xs text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white",
                        isHrefActive(childHref) && "bg-white/[0.06] text-shop_light_green"
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

      {secondaryLinks.map(renderLink)}
    </nav>
  );
};

export default HeaderMenu;
