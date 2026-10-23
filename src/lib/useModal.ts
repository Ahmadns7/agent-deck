import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal behavior for a dialog element: focuses the first control on open, keeps Tab and
 * Shift+Tab inside the dialog, closes on Escape, and restores focus to the opener on close.
 */
export function useModal(onClose: () => void): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null!);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    const first = root?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? root)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === head || !root.contains(active))) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && (active === tail || !root.contains(active))) {
        event.preventDefault();
        head.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  return ref;
}
