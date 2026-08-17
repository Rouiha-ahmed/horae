import CategoryManager, {
  type CategoryManagerData,
} from "@/components/admin/categories/CategoryManager";
import { requireAdmin } from "@/lib/admin";
import { getAdminCategoriesData } from "@/lib/categories";

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const data = await getAdminCategoriesData();
  const clientData: CategoryManagerData = {
    ...data,
    categories: data.categories.map((category) => ({
      ...category,
      archivedAt: category.archivedAt?.toISOString() || null,
      updatedAt: category.updatedAt.toISOString(),
    })),
  };

  return <CategoryManager data={clientData} />;
}
