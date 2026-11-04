type Click = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  currentTarget: {
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
  };
  preventDefault(): void;
};
type Router = {
  push(href: string, options?: { scroll?: boolean }): void;
  replace(href: string, options?: { scroll?: boolean }): void;
};

/** Preserve native anchor gestures; route ordinary same-origin clicks through the static router API. */
export function navigateLink(
  event: Click,
  href: string,
  router: Router,
  currentUrl: string,
  options: { replace?: boolean; scroll?: boolean } = {},
): void {
  const target = event.currentTarget.getAttribute('target');
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (target && target !== '_self') ||
    event.currentTarget.hasAttribute('download')
  )
    return;
  const destination = new URL(href, currentUrl);
  const current = new URL(currentUrl);
  if (
    !['http:', 'https:'].includes(destination.protocol) ||
    destination.origin !== current.origin
  )
    return;
  event.preventDefault();
  const path = destination.pathname + destination.search + destination.hash;
  if (options.replace) router.replace(path, { scroll: options.scroll });
  else router.push(path, { scroll: options.scroll });
}
