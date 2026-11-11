// Starter food list. Values are APPROXIMATE per 100 g (typical USDA FoodData Central /
// Indian Food Composition Tables figures, rounded). Real foods vary by brand and recipe.
// Phase 2 replaces/extends this with live USDA FoodData Central + Open Food Facts lookups.
export type Food = {
  id: string;
  name: string;
  category: string;
  kcal: number; // per 100 g
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number; // optional: undefined = unknown (never guessed)
  sugar?: number; // free sugar, g per 100 g
  satFat?: number; // saturated fat, g per 100 g
  sodium?: number; // mg per 100 g
  servingG: number; // default serving in grams
  servingLabel: string;
  custom?: boolean;
  source?: 'usda' | 'off' | 'web' | 'ai'; // bundled USDA data, Open Food Facts, web pages, or an AI estimate
  /** web-sourced values: the pages the numbers were read from */
  web?: { urls: string[] };
  /** AI estimate: not from any database or page — shown to the user as an estimate */
  estimate?: boolean;
  /** Set when values are the median of several packaged products rather than one reference entry. */
  typical?: { n: number; kcalMin: number; kcalMax: number };
};

const f = (
  id: string,
  name: string,
  category: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  servingG: number,
  servingLabel: string,
): Food => ({ id, name, category, kcal, protein, carbs, fat, fiber, servingG, servingLabel });

export const FOODS: Food[] = [
  // Indian staples
  f('roti', 'Roti / Chapati (whole wheat)', 'Indian', 297, 9.8, 46, 7.5, 5, 40, '1 roti'),
  f('rice-white', 'White rice, cooked', 'Indian', 130, 2.7, 28, 0.3, 0.4, 150, '1 katori'),
  f('rice-brown', 'Brown rice, cooked', 'Grains', 123, 2.7, 25.6, 1, 1.6, 150, '1 katori'),
  f('toor-dal', 'Toor dal, cooked', 'Indian', 105, 6.5, 17, 1.5, 4, 150, '1 katori'),
  f('moong-dal', 'Moong dal, cooked', 'Indian', 105, 7, 19, 0.4, 7.6, 150, '1 katori'),
  f('rajma', 'Rajma (kidney beans), cooked', 'Indian', 127, 8.7, 22.8, 0.5, 6.4, 150, '1 katori'),
  f('chana', 'Chickpeas, cooked', 'Indian', 164, 8.9, 27.4, 2.6, 7.6, 150, '1 katori'),
  f('paneer', 'Paneer', 'Indian', 296, 18, 3, 22, 0, 50, '50 g'),
  f('idli', 'Idli', 'Indian', 148, 4.2, 30, 0.4, 1, 40, '1 idli'),
  f('dosa', 'Plain dosa', 'Indian', 168, 3.9, 29, 3.7, 1, 85, '1 dosa'),
  f('sambar', 'Sambar', 'Indian', 50, 2.5, 7, 1.5, 2, 150, '1 katori'),
  f('poha', 'Poha', 'Indian', 130, 2.5, 25, 2.5, 1, 150, '1 plate'),
  f('curd', 'Curd / plain yogurt (whole milk)', 'Dairy', 61, 3.5, 4.7, 3.3, 0, 100, '1 katori'),
  f('ghee', 'Ghee', 'Fats', 876, 0.3, 0, 99.5, 0, 5, '1 tsp'),
  // Protein
  f('egg', 'Egg, boiled', 'Protein', 155, 12.6, 1.1, 10.6, 0, 50, '1 egg'),
  f('chicken-breast', 'Chicken breast, cooked', 'Protein', 165, 31, 0, 3.6, 0, 120, '1 piece'),
  f('salmon', 'Salmon, cooked', 'Protein', 206, 22, 0, 12.4, 0, 100, '1 fillet'),
  f('tuna', 'Tuna, canned in water', 'Protein', 116, 25.5, 0, 0.8, 0, 100, '1 can (drained)'),
  f('tofu', 'Tofu, firm', 'Protein', 144, 17.3, 2.8, 8.7, 2.3, 100, '100 g'),
  f('whey', 'Whey protein powder (typical)', 'Protein', 400, 80, 8, 6, 0, 30, '1 scoop'),
  // Dairy
  f('milk', 'Milk, whole', 'Dairy', 61, 3.2, 4.8, 3.3, 0, 240, '1 glass'),
  f('cheddar', 'Cheddar cheese', 'Dairy', 403, 24.9, 1.3, 33.1, 0, 30, '1 slice'),
  // Grains
  f('oats', 'Oats, dry', 'Grains', 389, 16.9, 66.3, 6.9, 10.6, 40, '1/2 cup'),
  f('bread-wheat', 'Whole wheat bread', 'Grains', 247, 13, 41, 3.4, 7, 30, '1 slice'),
  f('bread-white', 'White bread', 'Grains', 265, 9, 49, 3.2, 2.7, 30, '1 slice'),
  f('pasta', 'Pasta, cooked', 'Grains', 158, 5.8, 30.9, 0.9, 1.8, 150, '1 cup'),
  f('quinoa', 'Quinoa, cooked', 'Grains', 120, 4.4, 21.3, 1.9, 2.8, 150, '1 cup'),
  // Fruit
  f('banana', 'Banana', 'Fruit', 89, 1.1, 22.8, 0.3, 2.6, 118, '1 medium'),
  f('apple', 'Apple', 'Fruit', 52, 0.3, 13.8, 0.2, 2.4, 180, '1 medium'),
  f('orange', 'Orange', 'Fruit', 47, 0.9, 11.8, 0.1, 2.4, 130, '1 medium'),
  f('mango', 'Mango', 'Fruit', 60, 0.8, 15, 0.4, 1.6, 200, '1 cup'),
  f('avocado', 'Avocado', 'Fruit', 160, 2, 8.5, 14.7, 6.7, 100, '1/2 fruit'),
  // Veg
  f('potato', 'Potato, boiled', 'Vegetables', 87, 1.9, 20.1, 0.1, 1.8, 150, '1 medium'),
  f('sweet-potato', 'Sweet potato, baked', 'Vegetables', 90, 2, 20.7, 0.2, 3.3, 150, '1 medium'),
  f('broccoli', 'Broccoli', 'Vegetables', 34, 2.8, 6.6, 0.4, 2.6, 90, '1 cup'),
  f('spinach', 'Spinach', 'Vegetables', 23, 2.9, 3.6, 0.4, 2.2, 60, '1 cup'),
  f('tomato', 'Tomato', 'Vegetables', 18, 0.9, 3.9, 0.2, 1.2, 120, '1 medium'),
  f('cucumber', 'Cucumber', 'Vegetables', 15, 0.7, 3.6, 0.1, 0.5, 100, '1/2 cucumber'),
  f('onion', 'Onion', 'Vegetables', 40, 1.1, 9.3, 0.1, 1.7, 100, '1 medium'),
  // Nuts & fats
  f('peanuts', 'Peanuts', 'Nuts', 567, 25.8, 16.1, 49.2, 8.5, 30, 'a handful'),
  f('almonds', 'Almonds', 'Nuts', 579, 21.2, 21.6, 49.9, 12.5, 28, 'a handful'),
  f('peanut-butter', 'Peanut butter', 'Nuts', 588, 25, 20, 50, 6, 16, '1 tbsp'),
  f('sugar', 'Sugar', 'Other', 387, 0, 100, 0, 0, 4, '1 tsp'),
];
