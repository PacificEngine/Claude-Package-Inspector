const DAY_NOTES: readonly string[] = [
  'Welcome aboard. Keep the stamps steady and the boxes dry.',
  'Neat work. The ZIP codes are watching you now.',
  'Something is off around here. Trust the scale.',
  'Mind the contents. Not everything in a box wants to be shipped.',
  'Below sea level, the Moon... the addresses get stranger. Stay sharp.',
  'Listen closely. Boxes have opinions, and some of them hum.',
  'Inspector General. The whole depot is in your hands.',
];

const FAILED_NOTE = 'Three strikes. Go home and rest. We will try again tomorrow.';
const PERFECT_NOTE = 'Flawless. Not one mistake. Take a bow.';

export function bossNote(day: number, accuracyPercent: number, failed: boolean): string {
  if (failed) return FAILED_NOTE;
  const base = DAY_NOTES[Math.min(Math.max(day, 1), DAY_NOTES.length) - 1];
  return accuracyPercent >= 100 ? `${PERFECT_NOTE} ${base}` : base;
}
