/** Explicit server-side switch for the isolated, persisted demonstration. */
export function isShowcase(value = process.env.SHOWCASE_MODE): boolean {
  return value === 'true';
}
