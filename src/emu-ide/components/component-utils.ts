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
  itemHeight = 20,
  integralHeight = false
): void {
  switch (key) {
    case "Home":
      setPos(0);
      break;
    case "ArrowDown":
      setPos(element.scrollTop + itemHeight);
      break;
    case "ArrowUp":
      setPos(element.scrollTop - itemHeight);
      break;
    case "PageDown":
      setPos(element.scrollTop + element.offsetHeight * (ctrlKey ? 5 : 1));
      break;
    case "PageUp":
      setPos(element.scrollTop - element.offsetHeight * (ctrlKey ? 5 : 1));
      break;
    case "End":
      setPos(element.scrollTop = element.scrollHeight);
      break;
  }

  function setPos(position: number): void {
    element.scrollTop = integralHeight
      ? Math.round(position / itemHeight) * itemHeight
      : position;
  }
}
