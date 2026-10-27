import { useEffect, useRef } from 'react';

export const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([aria-disabled="true"]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([aria-disabled="true"]):not([tabindex="-1"])',
  'select:not([disabled]):not([aria-disabled="true"]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([aria-disabled="true"]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled]):not([aria-disabled="true"])',
].join(', ');

export interface FocusTrapOptions {
  enabled?: boolean;
  initialFocusSelector?: string;
  restoreFocusOnDeactivate?: boolean;
}

/**
 * Pure deterministic calculation for the next focus index inside a focus trap.
 * Ensures Tab and Shift+Tab wrap strictly within [0, totalCount - 1].
 */
export function computeNextFocusIndex(
  currentIndex: number,
  totalCount: number,
  isShiftTab: boolean
): number {
  if (totalCount <= 0) {
    return -1;
  }
  if (currentIndex < 0 || currentIndex >= totalCount) {
    return isShiftTab ? totalCount - 1 : 0;
  }
  if (isShiftTab) {
    return currentIndex === 0 ? totalCount - 1 : currentIndex - 1;
  }
  return currentIndex === totalCount - 1 ? 0 : currentIndex + 1;
}

/**
 * Queries all visible, enabled, keyboard-focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  );
  return candidates.filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
      return false;
    }
    if (el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

const activeTrapStack: HTMLElement[] = [];

/**
 * Imperative focus-trap utility that keeps keyboard Tab / Shift+Tab navigation
 * and focus strictly contained within the target container.
 * Supports nested traps (e.g. a modal opened inside the frosted login card).
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
) {
  const {
    initialFocusSelector,
    restoreFocusOnDeactivate = true,
  } = options;

  const previouslyFocused =
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  activeTrapStack.push(container);
  const isTopMostTrap = () =>
    activeTrapStack[activeTrapStack.length - 1] === container;

  const focusInitialElement = () => {
    if (initialFocusSelector) {
      const explicitTarget = container.querySelector<HTMLElement>(initialFocusSelector);
      if (explicitTarget && !explicitTarget.hasAttribute('disabled')) {
        explicitTarget.focus();
        return;
      }
    }
    const focusables = getFocusableElements(container);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isTopMostTrap() || event.key !== 'Tab') {
      return;
    }

    const focusables = getFocusableElements(container);
    if (focusables.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const activeEl =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = activeEl ? focusables.indexOf(activeEl) : -1;

    // Strictly trap Tab and Shift+Tab cycling within the container's focusable list
    const nextIndex = computeNextFocusIndex(
      currentIndex,
      focusables.length,
      event.shiftKey
    );

    if (nextIndex !== -1) {
      event.preventDefault();
      focusables[nextIndex].focus();
    }
  };

  const handleFocusIn = (event: FocusEvent) => {
    if (!isTopMostTrap()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (!container.contains(target)) {
      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('focusin', handleFocusIn, true);
  focusInitialElement();

  return () => {
    const idx = activeTrapStack.lastIndexOf(container);
    if (idx !== -1) {
      activeTrapStack.splice(idx, 1);
    }
    document.removeEventListener('keydown', handleKeyDown, true);
    document.removeEventListener('focusin', handleFocusIn, true);
    if (
      restoreFocusOnDeactivate &&
      previouslyFocused &&
      document.body.contains(previouslyFocused)
    ) {
      previouslyFocused.focus();
    }
  };
}

/**
 * React hook wrapping `createFocusTrap` for declarative focus containment.
 */
export function useFocusTrap<T extends HTMLElement>(
  options: FocusTrapOptions = {}
) {
  const {
    enabled = true,
    initialFocusSelector,
    restoreFocusOnDeactivate = true,
  } = options;
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) {
      return;
    }
    return createFocusTrap(containerRef.current, {
      initialFocusSelector,
      restoreFocusOnDeactivate,
    });
  }, [enabled, initialFocusSelector, restoreFocusOnDeactivate]);

  return containerRef;
}
