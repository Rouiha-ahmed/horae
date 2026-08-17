import StorefrontHeader from "@/components/storefront/StorefrontHeader";
import { getStorefrontShellData } from "@/lib/storefront";

export default async function Header() {
  const shell = await getStorefrontShellData();
  return <StorefrontHeader shell={shell} />;
}
