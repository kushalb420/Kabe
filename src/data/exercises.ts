export type Muscle = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Cardio' | 'Full body';
export type Exercise = { id: string; name: string; muscle: Muscle; equipment: string; custom?: boolean };

const e = (id: string, name: string, muscle: Muscle, equipment: string): Exercise => ({ id, name, muscle, equipment });

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Full body'];

export const EXERCISES: Exercise[] = [
  // Chest
  e('bench-press', 'Barbell Bench Press', 'Chest', 'Barbell'),
  e('incline-db-press', 'Incline Dumbbell Press', 'Chest', 'Dumbbell'),
  e('db-bench-press', 'Dumbbell Bench Press', 'Chest', 'Dumbbell'),
  e('pushup', 'Push-up', 'Chest', 'Bodyweight'),
  e('chest-fly', 'Cable / Machine Fly', 'Chest', 'Machine'),
  e('dips', 'Dips', 'Chest', 'Bodyweight'),
  // Back
  e('deadlift', 'Deadlift', 'Back', 'Barbell'),
  e('pullup', 'Pull-up', 'Back', 'Bodyweight'),
  e('lat-pulldown', 'Lat Pulldown', 'Back', 'Machine'),
  e('barbell-row', 'Barbell Row', 'Back', 'Barbell'),
  e('db-row', 'One-arm Dumbbell Row', 'Back', 'Dumbbell'),
  e('seated-row', 'Seated Cable Row', 'Back', 'Machine'),
  e('back-extension', 'Back Extension', 'Back', 'Bodyweight'),
  // Legs
  e('squat', 'Barbell Back Squat', 'Legs', 'Barbell'),
  e('front-squat', 'Front Squat', 'Legs', 'Barbell'),
  e('leg-press', 'Leg Press', 'Legs', 'Machine'),
  e('rdl', 'Romanian Deadlift', 'Legs', 'Barbell'),
  e('lunge', 'Walking Lunge', 'Legs', 'Dumbbell'),
  e('goblet-squat', 'Goblet Squat', 'Legs', 'Dumbbell'),
  e('leg-curl', 'Leg Curl', 'Legs', 'Machine'),
  e('leg-extension', 'Leg Extension', 'Legs', 'Machine'),
  e('calf-raise', 'Standing Calf Raise', 'Legs', 'Machine'),
  e('hip-thrust', 'Hip Thrust', 'Legs', 'Barbell'),
  e('bodyweight-squat', 'Bodyweight Squat', 'Legs', 'Bodyweight'),
  // Shoulders
  e('ohp', 'Overhead Press', 'Shoulders', 'Barbell'),
  e('db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell'),
  e('lateral-raise', 'Lateral Raise', 'Shoulders', 'Dumbbell'),
  e('face-pull', 'Face Pull', 'Shoulders', 'Cable'),
  e('rear-delt-fly', 'Rear Delt Fly', 'Shoulders', 'Dumbbell'),
  // Arms
  e('barbell-curl', 'Barbell Curl', 'Arms', 'Barbell'),
  e('db-curl', 'Dumbbell Curl', 'Arms', 'Dumbbell'),
  e('hammer-curl', 'Hammer Curl', 'Arms', 'Dumbbell'),
  e('tricep-pushdown', 'Triceps Pushdown', 'Arms', 'Cable'),
  e('skullcrusher', 'Skull Crusher', 'Arms', 'Barbell'),
  e('overhead-tricep', 'Overhead Triceps Extension', 'Arms', 'Dumbbell'),
  // Core
  e('plank', 'Plank (reps = seconds)', 'Core', 'Bodyweight'),
  e('crunch', 'Crunch', 'Core', 'Bodyweight'),
  e('hanging-leg-raise', 'Hanging Leg Raise', 'Core', 'Bodyweight'),
  e('russian-twist', 'Russian Twist', 'Core', 'Bodyweight'),
  // Cardio / full body
  e('burpee', 'Burpee', 'Full body', 'Bodyweight'),
  e('kettlebell-swing', 'Kettlebell Swing', 'Full body', 'Kettlebell'),
  e('jump-rope', 'Jump Rope (reps = minutes)', 'Cardio', 'Bodyweight'),
];
