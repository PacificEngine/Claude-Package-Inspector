export type PackageAction =
  | 'open'
  | 'rotate'
  | 'shake'
  | 'scale'
  | 'uv'
  | 'pebble'
  | 'stethoscope'
  | 'repair';

export const PACKAGE_ACTIONS: readonly PackageAction[] = [
  'open',
  'rotate',
  'shake',
  'scale',
  'uv',
  'pebble',
  'stethoscope',
  'repair',
];

export const ANIMATION_MS: Record<PackageAction, number> = {
  open: 600,
  rotate: 900,
  shake: 600,
  scale: 900,
  uv: 800,
  pebble: 1200,
  stethoscope: 900,
  repair: 500,
};

// 0 at the start, 1 once finished. Reduced motion skips straight to the end pose.
export function animationProgress(
  action: PackageAction,
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) return 1;
  return Math.min(1, Math.max(0, elapsedMs / ANIMATION_MS[action]));
}
