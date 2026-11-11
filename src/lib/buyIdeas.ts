import { inPantry, type Diet, type Equipment, type PantryItem } from './kitchenAi';

export type BuyCategory = 'veg' | 'fruit' | 'staple' | 'protein' | 'dairy' | 'spice' | 'quick';
export const BUY_CATEGORIES: BuyCategory[] = ['veg', 'fruit', 'staple', 'protein', 'dairy', 'spice', 'quick'];

/** `store`: how it must be kept; `cook`: the appliance it needs to be useful (none = eat as it is). `meat`/`egg`/`dairy` drive the diet filter. */
type Idea = { name: string; cat: BuyCategory; store: 'shelf' | 'fridge'; cook?: keyof Equipment; meat?: boolean; egg?: boolean; dairy?: boolean };

const v = (name: string, store: Idea['store'] = 'fridge', cook?: keyof Equipment): Idea => ({ name, cat: 'veg', store, cook });
const f = (name: string, store: Idea['store'] = 'shelf'): Idea => ({ name, cat: 'fruit', store });
const s = (name: string, cook?: keyof Equipment): Idea => ({ name, cat: 'staple', store: 'shelf', cook });
const sp = (name: string): Idea => ({ name, cat: 'spice', store: 'shelf' });

const IDEAS: Idea[] = [
  // ---- vegetables (hardy ones keep on the shelf, soft and leafy ones need a fridge)
  v('Onions', 'shelf', 'stove'), v('Potatoes', 'shelf', 'stove'), v('Tomatoes'), v('Garlic', 'shelf'), v('Ginger', 'shelf'),
  v('Green chillies'), v('Coriander leaves'), v('Curry leaves'), v('Spinach (palak)', 'fridge', 'stove'), v('Cabbage', 'fridge', 'stove'),
  v('Carrots'), v('Cucumber'), v('Capsicum', 'fridge', 'stove'), v('Cauliflower', 'fridge', 'stove'), v('Broccoli', 'fridge', 'stove'),
  v('Green peas', 'fridge', 'stove'), v('Beans (french beans)', 'fridge', 'stove'), v('Brinjal (eggplant)', 'fridge', 'stove'), v('Ladies finger (okra)', 'fridge', 'stove'),
  v('Bottle gourd (lauki)', 'fridge', 'stove'), v('Pumpkin', 'shelf', 'stove'), v('Sweet potato', 'shelf', 'stove'), v('Beetroot'),
  v('Mushrooms', 'fridge', 'stove'), v('Spring onions'),
  v('Lemons', 'shelf'),
  // ---- fruits
  f('Bananas'), f('Apples', 'fridge'), f('Oranges', 'fridge'), f('Mangoes (seasonal)'), f('Papaya', 'fridge'),
  f('Guava'), f('Pomegranate'), f('Grapes', 'fridge'), f('Watermelon', 'fridge'),
  f('Berries', 'fridge'), f('Dates'), f('Raisins'),
  f('Coconut'),
  // ---- staples: grains, pulses, flours
  s('Rice', 'stove'), s('Atta (wheat flour)', 'tawa'), s('Toor dal', 'stove'), s('Moong dal', 'stove'), s('Masoor dal', 'stove'),
  s('Chana dal', 'stove'), s('Urad dal', 'stove'), s('Chickpeas (chana)', 'stove'), s('Rajma', 'stove'),
  s('Poha'), s('Rolled oats'), s('Semolina (rava)', 'stove'), s('Pasta', 'stove'),
  s('Besan (gram flour)', 'tawa'), s('Ragi flour', 'stove'), s('Quinoa', 'riceCooker'), s('Brown rice', 'riceCooker'),
  s('Idli rice and urad dal', 'idliSteamer'), s('Whole-wheat bread', 'sandwichMaker'),
  // ---- protein
  { name: 'Eggs', cat: 'protein', store: 'fridge', egg: true, cook: 'stove' },
  { name: 'Chicken breast', cat: 'protein', store: 'fridge', meat: true, cook: 'stove' },
  { name: 'Fish', cat: 'protein', store: 'fridge', meat: true, cook: 'stove' },
  { name: 'Tofu', cat: 'protein', store: 'fridge', cook: 'stove' },
  { name: 'Soya chunks', cat: 'protein', store: 'shelf', cook: 'stove' },
  { name: 'Sprouts', cat: 'protein', store: 'fridge' },
  { name: 'Roasted chana', cat: 'protein', store: 'shelf' },
  { name: 'Peanuts', cat: 'protein', store: 'shelf' },
  { name: 'Almonds', cat: 'protein', store: 'shelf' },
  { name: 'Walnuts', cat: 'protein', store: 'shelf' },
  { name: 'Peanut butter', cat: 'protein', store: 'shelf' },
  // ---- dairy
  { name: 'Milk', cat: 'dairy', store: 'fridge', dairy: true },
  { name: 'Curd (dahi)', cat: 'dairy', store: 'fridge', dairy: true },
  { name: 'Paneer', cat: 'dairy', store: 'fridge', dairy: true, cook: 'stove' },
  { name: 'Greek yogurt', cat: 'dairy', store: 'fridge', dairy: true },
  { name: 'Cheese slices', cat: 'dairy', store: 'fridge', dairy: true, cook: 'sandwichMaker' },
  { name: 'Butter or ghee', cat: 'dairy', store: 'shelf', dairy: true },
  { name: 'Buttermilk (chaas)', cat: 'dairy', store: 'fridge', dairy: true },
  { name: 'Plant milk (soy or oat)', cat: 'dairy', store: 'shelf' },
  // ---- spices and cooking basics
  sp('Turmeric powder'), sp('Red chilli powder'), sp('Coriander powder'), sp('Cumin seeds (jeera)'), sp('Mustard seeds'),
  sp('Garam masala'), sp('Black pepper'), sp('Salt'), sp('Cardamom'),
  sp('Asafoetida (hing)'),
  sp('Cooking oil'), sp('Jaggery'), sp('Honey'),
  // ---- quick to make
  { name: 'Tea leaves', cat: 'quick', store: 'shelf', cook: 'kettle' },
  { name: 'Instant coffee', cat: 'quick', store: 'shelf', cook: 'kettle' },
  { name: 'Green tea', cat: 'quick', store: 'shelf', cook: 'kettle' },
  { name: 'Instant noodles', cat: 'quick', store: 'shelf', cook: 'kettle' },
  { name: 'Idli / dosa batter', cat: 'quick', store: 'fridge', cook: 'tawa' },
  { name: 'Smoothie fruit and yogurt', cat: 'quick', store: 'fridge', cook: 'blender' },
];

export type BuyIdea = { name: string; cat: BuyCategory; why: 'fridge' | 'shelf' | 'cook'; cook?: keyof Equipment };

/**
 * Things worth buying for THIS kitchen: nothing that needs a fridge if you have none, nothing that needs an appliance you do not
 * have, nothing your diet rules out, and nothing already in your pantry or list. Free and instant (no AI).
 * `cat` narrows to one group; `limit` caps how many come back (the whole list is about 100 items).
 */
export function buyIdeas(i: { equipment: Equipment; diet: Diet; pantry: PantryItem[]; shopping: { name: string }[]; limit?: number; cat?: BuyCategory | null }): BuyIdea[] {
  const out: BuyIdea[] = [];
  const listed = i.shopping.map((x) => x.name.toLowerCase());
  for (const x of IDEAS) {
    if (i.cat && x.cat !== i.cat) continue;
    if (x.store === 'fridge' && !i.equipment.fridge) continue;
    if (x.cook && !i.equipment[x.cook]) continue;
    if (x.meat && i.diet !== 'any') continue;
    if (x.egg && (i.diet === 'veg' || i.diet === 'vegan')) continue;
    if (x.dairy && i.diet === 'vegan') continue;
    if (inPantry(x.name, i.pantry) || listed.includes(x.name.toLowerCase())) continue;
    out.push({ name: x.name, cat: x.cat, why: x.cook ? 'cook' : x.store, cook: x.cook });
  }
  return out.slice(0, i.limit ?? 100);
}

export const IDEA_COUNT = IDEAS.length;
