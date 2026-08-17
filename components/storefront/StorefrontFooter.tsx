import Link from "next/link";

import Container from "@/components/Container";
import FooterTop from "@/components/FooterTop";
import Logo from "@/components/Logo";
import SocialMedia from "@/components/SocialMedia";
import { SubText, SubTitle } from "@/components/ui/text";
import type { StorefrontShellData } from "@/lib/storefront";

export default function StorefrontFooter({ shell }: { shell: StorefrontShellData }) {
  const settings = shell.settings;

  return (
    <footer className="border-t border-shop_light_green/20 bg-white">
      <Container>
        <FooterTop
          phone={settings.footerContactPhone}
          hours={settings.footerContactHours}
          email={settings.footerContactEmail}
        />

        <div className="grid grid-cols-1 gap-8 py-10 md:grid-cols-2 md:gap-10 md:py-12 lg:grid-cols-4">
          <div>
            <Logo />
            <SubTitle className="mt-4 text-[15px] font-bold">{settings.footerAboutTitle}</SubTitle>
            <SubText className="mt-2">{settings.footerAboutDescription}</SubText>
            <SocialMedia
              links={shell.socialLinks}
              className="mt-4 text-darkColor/60"
              iconClassName="h-9 w-9 rounded-lg border-shop_light_green/30 hover:border-shop_light_green hover:text-shop_dark_green"
              tooltipClassName="bg-darkColor text-white"
            />
          </div>

          <div>
            <SubTitle className="text-[15px] font-bold">{settings.footerQuickLinksTitle}</SubTitle>
            <ul className="mt-4 space-y-2.5 text-sm">
              {shell.footerQuickLinks.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                    className="font-medium text-gray-700 transition-colors hover:text-shop_dark_green"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SubTitle className="text-[15px] font-bold">{settings.footerCategoriesTitle}</SubTitle>
            <ul className="mt-4 space-y-2.5 text-sm">
              {shell.footerCategories.map((item) => (
                <li key={item._id}>
                  <Link
                    href={item.slug?.current ? `/category/${item.slug.current}` : "/shop"}
                    className="font-medium capitalize text-gray-700 transition-colors hover:text-shop_dark_green"
                  >
                    {item.title || "Categorie"}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <SubTitle className="text-[15px] font-bold">{settings.footerLegalLinksTitle}</SubTitle>
            <ul className="space-y-2.5 text-sm">
              {shell.footerLegalLinks.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                    className="font-medium text-gray-700 transition-colors hover:text-shop_dark_green"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-shop_light_green/20 bg-shop_light_bg/45 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-shop_dark_green">
                Newsletter
              </p>
              <p className="mt-1 text-sm text-lightColor">{settings.newsletterDescription}</p>
              <Link
                href="/#newsletter"
                className="mt-3 inline-flex text-sm font-semibold text-shop_dark_green transition-colors hover:text-shop_btn_dark_green"
              >
                {settings.newsletterButtonLabel}
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-shop_light_green/20 py-5 text-center text-xs text-gray-600 md:text-sm">
          (c) {new Date().getFullYear()} {settings.footerCopyrightText}
        </div>
      </Container>
    </footer>
  );
}
