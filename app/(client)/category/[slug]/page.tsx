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
    <div className="horae-page pb-24">
      {/* Page hero */}
      <div className="mx-3 mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_16%_0%,rgba(55,176,237,0.42),transparent_38%),linear-gradient(118deg,#0a456d,#02070d_68%)] text-[#edf7ff]">
        <Container>
          <div className="flex min-h-[300px] flex-col justify-end py-12 md:min-h-[380px] md:py-16">
            <p className="horae-kicker text-shop_light_green">
              Catalogue
            </p>
            <h1 className="horae-display mt-5 capitalize text-[#edf7ff]">
              {currentCategory.title}
            </h1>
            <p className="mt-7 text-sm text-white/45">
              Retrouvez tous les produits de cette categorie.
            </p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="py-14 md:py-20">
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
