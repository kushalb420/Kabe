// English is the source of truth. Every other language must provide EVERY key (enforced by the compiler),
// and each translation must keep the same {placeholders}.
import { partsEn } from './parts';

const base = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',

  'tab.today': 'Today',
  'tab.diary': 'Meals',
  'tab.train': 'Workouts',
  'tab.progress': 'Health',
  'tab.coach': 'Coach',
  'tab.me': 'Me',

  'meal.breakfast': 'Breakfast',
  'meal.lunch': 'Lunch',
  'meal.dinner': 'Dinner',
  'meal.snack': 'Snacks',

  'macro.protein': 'Protein',
  'macro.carbs': 'Carbohydrates',
  'macro.fat': 'Total fat',
  'macro.fiber': 'Fiber',
  'macro.sugar': 'Free sugar',
  'macro.kcal': 'Calories',
  'macro.satFat': 'Saturated fat',
  'macro.sodium': 'Sodium',
  'macro.water': 'Water',

  'today.greet.morning': 'Good morning',
  'today.greet.afternoon': 'Good afternoon',
  'today.greet.evening': 'Good evening',
  'today.subtitle': "Here's your day at a glance",
  'today.eaten': 'Eaten',
  'today.goal': 'Goal',
  'today.macros': 'Macros',
  'today.streak.one': '1 day logged in a row',
  'today.streak.other': '{n} days logged in a row',
  'today.level': 'Level {level} · {title} · {points} pts',
  'today.newBadge.one': 'New badge: {names}',
  'today.newBadge.other': 'New badges: {names}',
  'today.kitchen': 'Kitchen',
  'today.kitchenSub': "Meal ideas from your pantry, saved recipes and a buy list",
  'today.waterHabits': 'Water & habits',
  'today.habitsDone': '{done}/{total} habits & supplements done today',
  'today.habitsEmpty': 'Track supplements and daily habits →',
  'today.logFood': 'Log food',

  'nudge.streakRisk': "You're on a {n}-day logging streak 🔥 — log something today to keep it going.",
  'nudge.badgeClose': '{left} more to unlock “{name}”.',
  'nudge.challengeOne': "Just one more to finish this week's challenge: {title}.",
  'nudge.streakOk.one': '1 day logged in a row. Nice — consistency beats perfection.',
  'nudge.streakOk.other': '{n} days logged in a row. Nice — consistency beats perfection.',
  'nudge.start': 'Small steps count — log your next meal to start a streak.',

  'level.1': 'Starter',
  'level.2': 'Mover',
  'level.3': 'Consistent',
  'level.4': 'Dedicated',
  'level.5': 'Strong',
  'level.6': 'Athlete',
  'level.7': 'Champion',
  'level.8': 'Elite',
  'level.9': 'Master',
  'level.10': 'Legend',

  'diary.title': 'Your meals',
  'diary.dayTotal': 'Total for the day',
  'diary.today': 'Today',
  'diary.nothing': 'Nothing logged yet',
  'diary.tip': 'Tip: tap an item to edit or delete it. Tap the bookmark to save a meal.',

  'addFood.title': 'Add food',
  'addFood.savedMeals': "Saved meals (tap to open)",
  'addFood.savedHint': "Tap a meal to see what is in it. Long-press to delete it.",
  'addFood.favourites': "Saved foods",
  'addFood.addToDiary': 'Add to diary',
  'addFood.deleteSaved': 'Delete saved meal?',

  'me.title': 'Me',
  'me.subtitle': 'Your profile and daily targets',
  'me.language': 'Language',
  'me.languageNote': 'Applies to the whole app. Food names, exercise names and some technical messages stay in English.',
} as const;

// the per-screen groups in ./parts are merged in here
export const en = { ...base, ...partsEn };

export type Key = keyof typeof en;
