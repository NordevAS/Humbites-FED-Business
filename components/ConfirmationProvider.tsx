'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { createConfirmationGate } from '@/lib/confirmation';

type Confirmation = { title: string; message: string; confirmLabel: string };
type Confirm = (request: Confirmation) => Promise<boolean>;
type ConfirmationControls = {
  request: (request: Confirmation, owner: symbol) => Promise<boolean>;
  cancel: (owner: symbol) => void;
};
const ConfirmationContext = createContext<ConfirmationControls | null>(null);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [gate] = useState(createConfirmationGate);
  const [prompt, setPrompt] = useState<Confirmation | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const settle = useCallback(
    (approved: boolean) => {
      if (!gate.pending) return;
      setPrompt(null);
      gate.settle(approved);
    },
    [gate],
  );
  const confirm = useCallback<ConfirmationControls['request']>(
    (request, owner) => {
      // A second caller cannot replace the pending prompt and approve the wrong action.
      if (gate.pending) return Promise.resolve(false);
      origin.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setPrompt(request);
      return gate.request(owner);
    },
    [gate],
  );
  const cancel = useCallback(
    (owner: symbol) => {
      if (gate.cancel(owner)) setPrompt(null);
    },
    [gate],
  );
  useEffect(() => {
    // Leaving the workflow cancels its decision; navigation is never consent.
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      settle(false);
    }
  }, [pathname, settle]);
  useEffect(
    () => () => {
      gate.settle(false);
    },
    [gate],
  );
  return (
    <ConfirmationContext.Provider value={{ request: confirm, cancel }}>
      {children}
      <AlertDialog.Root
        open={prompt !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="confirmation-overlay" />
          <AlertDialog.Content
            className="confirmation-dialog"
            onEscapeKeyDown={() => settle(false)}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const trigger = origin.current;
              if (trigger?.isConnected && !trigger.matches(':disabled'))
                trigger.focus({ preventScroll: true });
              else {
                const fallback =
                  document.querySelector<HTMLElement>('main h1,main');
                if (fallback) {
                  fallback.tabIndex = -1;
                  fallback.focus({ preventScroll: true });
                }
              }
            }}
          >
            <span className="eyebrow">BEKREFT HANDLINGEN</span>
            <AlertDialog.Title className="confirmation-title">
              {prompt?.title}
            </AlertDialog.Title>
            <AlertDialog.Description className="confirmation-description">
              {prompt?.message}
            </AlertDialog.Description>
            <div className="confirmation-actions">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => settle(false)}
                >
                  Avbryt
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => settle(true)}
                >
                  {prompt?.confirmLabel ?? 'Bekreft'}
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation(): Confirm {
  const controls = useContext(ConfirmationContext);
  if (!controls) throw new Error('ConfirmationProvider missing');
  const { request, cancel } = controls;
  const [owner] = useState(() => Symbol('confirmation-owner'));
  useEffect(() => () => cancel(owner), [cancel, owner]);
  return useCallback((value) => request(value, owner), [request, owner]);
}
