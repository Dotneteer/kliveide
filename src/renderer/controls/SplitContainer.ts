import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";

const splitterMovedInternal = new LiteEvent<Node>();

/**
 * This event is raised when a spitter has been moved.
 */
export const splitterMoved: ILiteEvent<Node> = splitterMovedInternal;

/**
 * Signs that the splitter has been moved
 */
export function raiseSplitterMoved(node: Node): void {
  splitterMovedInternal.fire(node);
}

/**
 * Removes children that are not available for splitting.
 * @param container Container element
 * @param children Child elements within the container
 * @param includeFn Optional filter function to include desired elements
 */
export function filterChildren(
  container: Node,
  children: Node[] | NodeList,
  includeFn?: (el: Node) => boolean
): Node[] {
  let childArray = Array.from(children);
  childArray = childArray.filter(
    (el: HTMLElement) => el.parentNode === container
  );
  const include =
    includeFn ||
    ((el: HTMLElement) =>
      el.style &&
      el.style.display !== undefined &&
      el.style.display !== "none");
  return childArray.filter(el => include(el));
}

/**
 * Calculates the initial sizes of panels within the split container
 * @param containerSize Size of the container
 * @param clientOffsetName Name of the client offset property
 * @param minSize Minimum size of panels
 * @param children Child nodes of the container to handle as panels
 * @param isInitial Indicates that this is the initial calculation
 *
 * Each panel (div) can specify its "data-initial-size" attribute to set
 * the desired intial size in pixels.
 */
export function calculateInitialSizes(
  direction: string,
  hostElement: HTMLElement,
  minSize: number,
  children: NodeList,
  isInitial: boolean
): number[] {
  // --- Set up direction-dependent property names
  let clientSize: string;
  let clientDim: string;
  let crossDim: string;

  if (direction === "horizontal") {
    clientSize = "clientWidth";
    clientDim = "height";
    crossDim = "width";
  } else {
    clientSize = "clientHeight";
    clientDim = "width";
    crossDim = "height";
  }

  // --- Set up child dimensions
  const containerSize = (hostElement as any)[clientSize];
  for (let i = 0; i < children.length; i++) {
    (children[i] as any).style[clientDim] = "100%";
    (children[i] as any).style[crossDim] =
      children.length === 1 ? "100%" : undefined;
  }

  if (children.length === 1) {
    return [100];
  }

  // --- Get explicitly set initial sizes
  const initialSizes = Array.from(children).map(e =>
    isInitial
      ? (e as HTMLElement).getAttribute("data-initial-size")
      : (e as HTMLElement as any)[clientSize]
  );
  const percentages: number[] = [];

  // --- Calculate the expectable sum size
  let implicit = children.length;
  let sumSize = 0;
  for (let i = 0; i < initialSizes.length; i++) {
    var initialSize = initialSizes[i];
    let size = minSize;
    if (initialSize !== null) {
      const parsedSize = parseInt(initialSize);
      if (!isNaN(parsedSize)) {
        percentages[i] = size = parsedSize;
        implicit--;
      }
    } else {
      percentages[i] = -1;
    }
    sumSize += size;
  }

  // --- Calculate ratio (if the sum size is too long)
  const ratio = sumSize > containerSize ? containerSize / sumSize : 1;
  let sumPercentage = 0;

  // --- Calculate percentages for explicitly sized columns
  for (let i = 0; i < initialSizes.length; i++) {
    if (percentages[i] < 0) continue;
    percentages[i] = 100 * (percentages[i] / ratio / containerSize);
    sumPercentage += percentages[i];
  }
  // --- Calculate the percentages for unsized columns
  for (let i = 0; i < percentages.length; i++) {
    if (percentages[i] >= 0) continue;
    percentages[i] = (100 - sumPercentage) / implicit;
  }

  // --- Done.
  return percentages;
}

/**
 * Removes existing gutters
 * @param container Host element of the split container
 */
export function removeGutters(container: HTMLElement): void {
  let gutters = Array.from(container.querySelectorAll(".gutter"));
  gutters = gutters.filter((el: HTMLElement) => el.parentNode === container);
  for (let i = 0; i < gutters.length; i++) {
    container.removeChild(gutters[i]);
  }
}
