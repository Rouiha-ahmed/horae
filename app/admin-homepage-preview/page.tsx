import HomepagePreviewDocument from "@/components/admin/homepage/HomepagePreviewDocument";
import { requireAdmin } from "@/lib/admin";
import { getHomepageEditorData } from "@/lib/homepage-workspace";
import { getStorefrontShellData } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function AdminHomepagePreviewPage() {
  await requireAdmin();
  const [editor, shell] = await Promise.all([
    getHomepageEditorData(),
    getStorefrontShellData(),
  ]);

  return (
    <HomepagePreviewDocument
      initialSnapshot={editor.snapshot}
      initialSections={editor.previewSections}
      baseShell={shell}
    />
  );
}
