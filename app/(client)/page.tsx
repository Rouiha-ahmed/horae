import HomepageRenderer from "@/components/home/HomepageRenderer";
import { getStorefrontHomeData } from "@/lib/storefront";

export const revalidate = 300;

export default async function HomePage() {
  const data = await getStorefrontHomeData();

  return <HomepageRenderer data={data} />;
}
