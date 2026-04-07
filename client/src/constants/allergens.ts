export interface Allergen {
  code: string;
  name: string;
  icon: string;
}

export const ALLERGENS: Allergen[] = [
  { code: 'gluten', name: 'Gluten', icon: '🌾' },
  { code: 'crustaceans', name: 'Crustaceans', icon: '🦐' },
  { code: 'eggs', name: 'Eggs', icon: '🥚' },
  { code: 'fish', name: 'Fish', icon: '🐟' },
  { code: 'peanuts', name: 'Peanuts', icon: '🥜' },
  { code: 'soybeans', name: 'Soybeans', icon: '🫘' },
  { code: 'milk', name: 'Milk', icon: '🥛' },
  { code: 'tree_nuts', name: 'Tree Nuts', icon: '🌰' },
  { code: 'celery', name: 'Celery', icon: '🥬' },
  { code: 'mustard', name: 'Mustard', icon: '🟡' },
  { code: 'sesame', name: 'Sesame', icon: '⚪' },
  { code: 'sulphites', name: 'Sulphites', icon: '🍷' },
  { code: 'lupin', name: 'Lupin', icon: '🌸' },
  { code: 'molluscs', name: 'Molluscs', icon: '🐚' },
];

export const ALLERGEN_MAP = Object.fromEntries(
  ALLERGENS.map(a => [a.code, a])
) as Record<string, Allergen>;
