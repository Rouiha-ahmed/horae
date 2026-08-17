import CategoryProducts from "@/components/CategoryProducts";
import Container from "@/components/Container";
import { notFound } from "next/navigation";
import {
  getAllCategorySlugs,
  getCategories,
  getProductsByCategorySlug,
} from "@/lib/queries";
export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}

const CategoryPage = async ({
  params,
}: {
  params: Promise<{ slug: string }>;
}) => {
  const { slug } = await params;
  const [categories, initialProducts] = await Promise.all([
    getCategories(),
    getProductsByCategorySlug(slug),
  ]);

  const currentCategory = categories.find((c) => c.slug?.current === slug);
  if (!currentCategory) notFound();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f0f7f9_0%,#f8fafb_100%)]">
      {/* Page hero */}
      <div className="border-b border-shop_light_green/15 bg-white">
        <Container>
          <div className="py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-shop_light_green">
              Catalogue
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-shop_dark_green md:text-3xl capitalize">
              {currentCategory.title}
            </h1>
            <p className="mt-1 text-sm text-lightColor">
              Retrouvez tous les produits de cette categorie.
            </p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-8">
          <CategoryProducts
            categories={categories}
            slug={slug}
            initialProducts={initialProducts}
          />
        </div>
      </Container>
    </div>
  );
};

export default CategoryPage;
