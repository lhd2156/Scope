const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isElementHidden(element: HTMLElement): boolean {
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  const styles = window.getComputedStyle(element);
  return styles.display === 'none' || styles.visibility === 'hidden';
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.tabIndex < 0 || isElementHidden(element)) {
      return false;
    }

    return element.getAttribute('aria-disabled') !== 'true';
  });
}

export function focusFirstElement(container: HTMLElement | null): boolean {
  const [firstElement] = getFocusableElements(container);

  if (!firstElement) {
    return false;
  }

  firstElement.focus();
  return true;
}

export function focusLastElement(container: HTMLElement | null): boolean {
  const focusableElements = getFocusableElements(container);
  const lastElement = focusableElements[focusableElements.length - 1];

  if (!lastElement) {
    return false;
  }

  lastElement.focus();
  return true;
}

export function moveFocus(container: HTMLElement | null, direction: 1 | -1): boolean {
  const focusableElements = getFocusableElements(container);

  if (!focusableElements.length) {
    return false;
  }

  const activeElement = typeof document === 'undefined' ? null : document.activeElement;
  const currentIndex = focusableElements.findIndex((element) => element === activeElement);
  const nextIndex = currentIndex === -1
    ? direction === 1 ? 0 : focusableElements.length - 1
    : (currentIndex + direction + focusableElements.length) % focusableElements.length;

  focusableElements[nextIndex]?.focus();
  return true;
}
