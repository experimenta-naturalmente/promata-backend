import { Category, Prisma } from 'generated/prisma';

export const PER_DAY_ONLY_CATEGORY = Category.HOSTING_HOUSE;

export function isPerDayOnlyCategory(category?: string | null): boolean {
  return category === Category.HOSTING_HOUSE;
}

export function toPublicExperienceFilterCategory(
  category: Category,
): Category | Prisma.EnumCategoryFilter<'Experience'> {
  if (category === Category.HOSTING) {
    return { in: [Category.HOSTING, Category.HOSTING_HOUSE] };
  }

  return category;
}
