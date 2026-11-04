'use client';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { useRouter } from 'next/navigation';
import { navigateLink } from '@/lib/navigation/link-click';

type AppLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
  scroll?: boolean;
};

/** App-local adapter avoids Vinext beta.5 Link's broken dynamic navigation namespace. */
const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(function AppLink(
  { href, replace, scroll, onClick, ...props },
  ref,
) {
  const router = useRouter();
  return (
    <a
      {...props}
      href={href}
      ref={ref}
      onClick={(event) => {
        onClick?.(event);
        navigateLink(event, href, router, window.location.href, {
          replace,
          scroll,
        });
      }}
    />
  );
});
export default AppLink;
