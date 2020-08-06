/**
 * Tests if the mouse is over the specified element.
 * @param ev Mouse event arguments
 * @param element Element to test
 */
export function isMouseOverElement(
  ev: MouseEvent,
  element: HTMLElement
): boolean {
  let currentElement = document.elementFromPoint(ev.clientX, ev.clientY);
  while (currentElement) {
    if (currentElement === element) {
      return true;
    }
    currentElement = currentElement.parentElement;
  }
  return false;
}
