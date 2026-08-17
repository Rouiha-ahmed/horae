import HomepageVisualEditor from "@/components/admin/homepage/HomepageVisualEditor";
import { requireAdmin } from "@/lib/admin";
import { getHomepageEditorData } from "@/lib/homepage-workspace";

export const dynamic = "force-dynamic";

export default async function AdminHomepagePage() {
  await requireAdmin();
  const data = await getHomepageEditorData();

  return <HomepageVisualEditor data={data} />;
}
