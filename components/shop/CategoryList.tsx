import { Category } from "@/types";
import { getCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

interface Props {
  categories: Category[];
  selectedCategories: string[];
  onToggle: (slug: string) => void;
  onReset: () => void;
}

const CategoryList = ({ categories, selectedCategories, onToggle, onReset }: Props) => {
  return (
    <div className="w-full p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="horae-kicker text-shop_light_green">
          Categories
        </p>
        {selectedCategories.length > 0 && (
          <button
            onClick={onReset}
            className="text-[11px] font-medium text-shop_btn_dark_green underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Tout effacer
          </button>
        )}
      </div>

      <div className="space-y-1">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.title || "");
          const slug = category.slug?.current as string;
          const isChecked = selectedCategories.includes(slug);

          return (
            <button
              key={category._id}
              type="button"
              onClick={() => onToggle(slug)}
              className={cn(
                "flex w-full items-center gap-2.5 border-b border-white/8 px-0 py-2.5 text-left text-xs capitalize transition-all duration-150",
                isChecked
                  ? "text-shop_btn_dark_green font-semibold"
                  : "text-lightColor hover:text-shop_dark_green font-medium"
              )}
            >
              {/* Custom checkbox */}
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                  isChecked
                    ? "border-shop_btn_dark_green bg-shop_btn_dark_green"
                    : "border-white/20 bg-white/[0.03]"
                )}
              >
                {isChecked && (
                  <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2">
                    <polyline points="1,4 4,7 9,1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <Icon className={cn("h-3.5 w-3.5 shrink-0", isChecked ? "text-shop_light_green" : "text-slate-400")} />
              <span className="truncate">{category.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryList;
