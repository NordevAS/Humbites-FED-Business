export type AppMode = 'demo' | 'live';
/** Demo data is opt-in. A missing or invalid mode never silently enables it. */
export function getMode(value = process.env.HUMBITES_MODE): AppMode {
  return value === 'demo' ? 'demo' : 'live';
}
