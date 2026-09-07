export const PER_DAY_ONLY_CATEGORY = 'HOSTING_HOUSE';

export function isPerDayOnlyCategory(category?: string | null): boolean {
  return category === PER_DAY_ONLY_CATEGORY;
}
