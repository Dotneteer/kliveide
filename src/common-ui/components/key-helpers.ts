/**
 * Handles scrolling keys
 * @param element HTML element to scroll
 * @param key Key pressed
 */
export function calculateScrollPositionByKey(
  element: HTMLElement,
  key: string,
  shiftKey: boolean,
  itemHeight = 20,
  integralHeight = false
): number {
  switch (key) {
    case "Home":
      return getPos(0);
    case "ArrowDown":
      return getPos(element.scrollTop + itemHeight);
    case "ArrowUp":
      return getPos(element.scrollTop - itemHeight);
    case "PageDown":
      return getPos(
        element.scrollTop + element.offsetHeight * (shiftKey ? 5 : 1)
      );
    case "PageUp":
      return getPos(
        element.scrollTop - element.offsetHeight * (shiftKey ? 5 : 1)
      );
    case "End":
      return getPos((element.scrollTop = element.scrollHeight));
  }

  function getPos(position: number): number {
    return Math.max(
      0,
      integralHeight ? Math.round(position / itemHeight) * itemHeight : position
    );
  }
}
