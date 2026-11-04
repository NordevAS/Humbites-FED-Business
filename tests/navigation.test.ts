import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateLink } from '../lib/navigation/link-click';

function fixture(attributes: Record<string, string> = {}) {
  const calls: { method: string; href: string; scroll?: boolean }[] = [];
  const event = {
    defaultPrevented: false,
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    currentTarget: {
      getAttribute: (name: string) => attributes[name] ?? null,
      hasAttribute: (name: string) => name in attributes,
    },
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  const router = {
    push(href: string, options?: { scroll?: boolean }) {
      calls.push({ method: 'push', href, scroll: options?.scroll });
    },
    replace(href: string, options?: { scroll?: boolean }) {
      calls.push({ method: 'replace', href, scroll: options?.scroll });
    },
  };
  return { event, router, calls };
}
const origin = 'https://humbites.example/foodtruck/sol-salsa';
test('ordinary and keyboard-generated anchor clicks invoke the static router with query and private fragment intact', () => {
  const { event, router, calls } = fixture();
  navigateLink(event, '/eier?truck=1#details', router, origin);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, [
    { method: 'push', href: '/eier?truck=1#details', scroll: undefined },
  ]);
});
test('modified, alternate-button, new-tab, download and prevented clicks retain native behavior', () => {
  for (const modification of [
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
    { defaultPrevented: true },
  ]) {
    const { event, router, calls } = fixture();
    Object.assign(event, modification);
    navigateLink(event, '/eier', router, origin);
    assert.deepEqual(calls, []);
  }
  const nativeAttributes: Record<string, string>[] = [
    { target: '_blank' },
    { target: 'named-window' },
    { download: '' },
  ];
  for (const attributes of nativeAttributes) {
    const { event, router, calls } = fixture(attributes);
    navigateLink(event, '/eier', router, origin);
    assert.deepEqual(calls, []);
    assert.equal(event.defaultPrevented, false);
  }
});
test('external and non-HTTP links remain native; relative query/hash and replace/scroll are preserved', () => {
  for (const href of [
    'https://outside.example/path',
    'mailto:hello@example.test',
    'tel:40000000',
  ]) {
    const { event, router, calls } = fixture();
    navigateLink(event, href, router, origin);
    assert.deepEqual(calls, []);
    assert.equal(event.defaultPrevented, false);
  }
  const { event, router, calls } = fixture({ target: '_self' });
  navigateLink(event, '?truck=2#access=fixture', router, origin, {
    replace: true,
    scroll: false,
  });
  assert.deepEqual(calls, [
    {
      method: 'replace',
      href: '/foodtruck/sol-salsa?truck=2#access=fixture',
      scroll: false,
    },
  ]);
});
