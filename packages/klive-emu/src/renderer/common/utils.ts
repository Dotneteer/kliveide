/**
 * Delay for the specified amount of milliseconds
 * @param milliseconds Amount of milliseconds to delay
 */
export function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (milliseconds < 0) {
      milliseconds = 0;
    }
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

/**
 * Delays execution while the next animation frame
 */
export function animationTick(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

/**
 * Handles scrolling keys
 * @param element HTML element to scroll
 * @param key Key pressed
 */
export function handleScrollKeys(
  element: HTMLElement,
  key: string,
  ctrlKey: boolean,
  itemHeight = 20
): void {
  switch (key) {
    case "Home":
      element.scrollTop = 0;
      break;
    case "ArrowDown":
      element.scrollTop += itemHeight;
      break;
    case "ArrowUp":
      element.scrollTop -= itemHeight;
      break;
    case "PageDown":
      element.scrollTop += element.offsetHeight * (ctrlKey ? 5 : 1);
      break;
    case "PageUp":
      element.scrollTop -= element.offsetHeight * (ctrlKey ? 5 : 1);
      break;
    case "End":
      element.scrollTop = element.scrollHeight;
      break;
  }
}
