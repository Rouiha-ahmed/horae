import StorefrontFooter from "@/components/storefront/StorefrontFooter";
import { getStorefrontShellData } from "@/lib/storefront";

export default async function Footer() {
  const shell = await getStorefrontShellData();
  return <StorefrontFooter shell={shell} />;
}
