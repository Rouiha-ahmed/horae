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
    <footer className="border-t border-white/10 bg-[#02060b] text-[#edf7ff]">
      <Container>
        <FooterTop
          phone={settings.footerContactPhone}
          hours={settings.footerContactHours}
          email={settings.footerContactEmail}
        />

        <div className="grid grid-cols-1 gap-10 py-14 md:grid-cols-2 md:gap-12 md:py-20 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <SubTitle className="mt-6 font-editorial text-xl font-medium uppercase tracking-[-0.035em] text-white">{settings.footerAboutTitle}</SubTitle>
            <SubText className="mt-3 max-w-xs leading-7 text-white/48">{settings.footerAboutDescription}</SubText>
            <SocialMedia
              links={shell.socialLinks}
              className="mt-6 text-white/55"
              iconClassName="h-9 w-9 rounded-full border-white/15 hover:border-shop_light_green hover:bg-shop_light_green hover:text-[#02101b]"
              tooltipClassName="bg-shop_light_bg text-shop_dark_green"
            />
          </div>

          <div>
            <SubTitle className="horae-kicker text-shop_light_green">{settings.footerQuickLinksTitle}</SubTitle>
            <ul className="mt-6 space-y-3 text-sm">
              {shell.footerQuickLinks.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                    className="text-white/52 transition-colors hover:text-white"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SubTitle className="horae-kicker text-shop_light_green">{settings.footerCategoriesTitle}</SubTitle>
            <ul className="mt-6 space-y-3 text-sm">
              {shell.footerCategories.map((item) => (
                <li key={item._id}>
                  <Link
                    href={item.slug?.current ? `/category/${item.slug.current}` : "/shop"}
                    className="capitalize text-white/52 transition-colors hover:text-white"
                  >
                    {item.title || "Categorie"}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <SubTitle className="horae-kicker text-shop_light_green">{settings.footerLegalLinksTitle}</SubTitle>
            <ul className="space-y-3 text-sm">
              {shell.footerLegalLinks.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                    className="text-white/52 transition-colors hover:text-white"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="border-l border-shop_light_green/60 px-4 py-1">
              <p className="horae-kicker text-shop_light_green">
                Newsletter
              </p>
              <p className="mt-2 text-sm leading-6 text-white/48">{settings.newsletterDescription}</p>
              <Link
                href="/#newsletter"
                className="mt-4 inline-flex text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:text-shop_light_green"
              >
                {settings.newsletterButtonLabel}
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 py-6 text-[10px] uppercase tracking-[0.14em] text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {settings.footerCopyrightText}</span>
          <span>Le temps du soin, signé HORAE</span>
        </div>
      </Container>
    </footer>
  );
}
