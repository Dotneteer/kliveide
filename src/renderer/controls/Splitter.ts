// Original source: https://github.com/nathancahill/split

// ============================================================================
// --- Common helper types

type GutterAlign = "start" | "center" | "end";
type GutterDirection = "horizontal" | "vertical";
type Dimension = "width" | "height";
type ClientAxis = "clientX" | "clientY";
type PositionStart = "left" | "top";
type PositionEnd = "right" | "bottom";
type ClientSize = "clientWidth" | "clientHeight";
type ClientOffset = "offsetLeft" | "offsetTop";

/**
 * Represents the setup options of Split.js
 */
interface SplitOptions {
  /**
   * An array of initial sizes of the elements, specified as percentage values.
   */
  sizes?: number[];

  /**
   * An array of minimum sizes of the elements, specified as pixel values.
   * Default: 100
   */
  minSize?: number | number[];

  /**
   * When the split is created, if expandToMin is true, the minSize for each
   * element overrides the percentage value from the sizes option.
   */
  expandToMin?: boolean;

  /**
   * Gutter size in pixels.
   */
  gutterSize?: number;

  /**
   * Determines how the gutter aligns between the two elements. 'start' shrinks
   * the first element to fit the gutter, 'end' shrinks the second element to
   * fit the gutter and 'center' shrinks both elements by the same amount so the
   * gutter sits between. Default: center
   */
  gutterAlign?: GutterAlign;

  /**
   * Snap to minimum size at this offset in pixels. Set to 0 to disable to snap
   * effect. Default: 30
   */
  snapOffset?: number;

  /**
   * Drag this number of pixels at a time. Defaults to 1 for smooth dragging,
   * but can be set to a pixel value to give more control over the resulting
   * sizes.
   */
  dragInterval?: number;

  /**
   * Direction to split in. Default: 'horizontal'
   */
  direction?: GutterDirection;

  /**
   * Cursor to show on the gutter (also applied to the body on dragging to
   * prevent flickering). Defaults to 'col-resize'for direction: 'horizontal'
   * and 'row-resize' for direction: 'vertical'.
   */
  cursor?: string;

  /**
   * Signs that the gutter is floating
   */
  floatingGutter?: boolean;

  /**
   * Optional function called to create each gutter element.
   */
  gutter?: (
    index: number,
    direction: GutterDirection,
    pairElement: HTMLElement
  ) => HTMLElement;

  /**
   * Optional function called setting the CSS style of the elements.
   */
  elementStyle?: (
    dimension: Dimension,
    elementSize: number,
    gutterSize: number,
    index: number
  ) => Object;

  /**
   * Optional function called when setting the CSS style of the gutters.
   */
  gutterStyle?: (
    dimension: Dimension,
    gutterSize: number,
    index: number
  ) => Object;

  /**
   * Callback on drag event
   */
  onDrag?: (sizes: number[]) => Object;

  /**
   * Callback on drag start event
   */
  onDragStart?: (sizes: number[]) => Object;

  /**
   * Callback on drag end event
   */
  onDragEnd?: (sizes: number[]) => Object;
}

/**
 * Represents an element with a style
 */
interface StyledElement extends Element {
  style: any;
}

/**
 * Represents an element in a pair
 */
interface ElementInfo {
  i: number;
  element: StyledElement;
  minSize: any;
  size: any;
}

/**
 * Represents a pair.
 * Split.js thinks about each pair of elements as an independant pair.
 * Dragging the gutter between two elements only changes the dimensions of
 * elements in that pair.
 */
interface Pair {
  // --- Left or top element
  a: HTMLElement;
  // --- Right or bottom
  b: HTMLElement;
  // --- Minimum size foe element "a"
  aMin: number;
  // --- Minimum size for element "b"
  bMin: number;
  // --- Is drag operation in progress?
  dragging: boolean;
  // --- Parent element of "a" and "b"
  parent: HTMLElement;
  // --- Direction of the gutter
  direction: GutterDirection;
}

// --- Save a couple long function names that are used frequently.
const HORIZONTAL: GutterDirection = "horizontal";
const NOOP = () => false;

/**
 * This function allows elements and string selectors to be used
 * interchangeably. In either case an element is returned.
 * @param elementOrSelector Element or selector information
 */
function elementOrSelector(elementOrSelector: string | Element): Element {
  if (typeof elementOrSelector === "string") {
    const element = document.querySelector(elementOrSelector) as HTMLElement;
    if (!element) {
      throw new Error(
        `Selector ${elementOrSelector} did not match a DOM element`
      );
    }
    return element;
  }
  return elementOrSelector;
}

/**
 * Gets a property from the properties object, with a default fallback
 * @param options Options object
 * @param propName Property name to get
 * @param def Default property value
 */
function getOption(
  options: SplitOptions,
  propName: keyof SplitOptions,
  def?: any
) {
  const value = options[propName];
  return value === undefined ? def : value;
}

/**
 * Calculates the gutter's size
 * @param gutterSize Requested gutter size
 * @param isFirst First gutter?
 * @param isLast Last gutter?
 * @param gutterAlign Align of the futter
 */
function getGutterSize(
  gutterSize: number,
  isFirst: boolean,
  isLast: boolean,
  gutterAlign: GutterAlign
) {
  if (isFirst) {
    if (gutterAlign === "end") {
      return 0;
    }
    if (gutterAlign === "center") {
      return gutterSize / 2;
    }
  } else if (isLast) {
    if (gutterAlign === "start") {
      return 0;
    }
    if (gutterAlign === "center") {
      return gutterSize / 2;
    }
  }
}

/**
 * Creates the default gutter element
 * @param _i Unused gutter index
 * @param gutterDirection Direction of the gutter
 */
function getDefaultGutterElement(_i: number, gutterDirection: GutterDirection) {
  const gut = document.createElement("div");
  gut.className = `gutter gutter-${gutterDirection}`;
  return gut;
}

/**
 * Calculates the dimension perpendicular to the input
 * @param dim Input dimension
 */
function crossDimension(dim: Dimension): Dimension {
  return dim === "height" ? "width" : "height";
}

// The main function to initialize a split. Split.js thinks about each pair
// of elements as an independant pair. Dragging the gutter between two elements
// only changes the dimensions of elements in that pair. This is key to understanding
// how the following functions operate, since each function is bound to a pair.
//
// A pair object is shaped like this:
//
// {
//     a: DOM element,
//     b: DOM element,
//     aMin: Number,
//     bMin: Number,
//     dragging: Boolean,
//     parent: DOM element,
//     direction: 'horizontal' | 'vertical'
// }
//
// The basic sequence:
//
// 1. Set defaults to something sane. `options` doesn't have to be passed at all.
// 2. Initialize a bunch of strings based on the direction we're splitting.
//    A lot of the behavior in the rest of the library is paramatized down to
//    rely on CSS strings and classes.
// 3. Define the dragging helper functions, and a few helpers to go with them.
// 4. Loop through the elements while pairing them off. Every pair gets an
//    `pair` object and a gutter.
// 5. Actually size the pair elements, insert gutters and attach event listeners.
function Split(
  idsOption: (string | HTMLElement)[],
  options: SplitOptions = {}
) {
  let ids = idsOption;
  let dimension: Dimension;
  let clientAxis: ClientAxis;
  let position: PositionStart;
  let positionEnd: PositionEnd;
  let clientSize: ClientSize;
  let clientOffset: ClientOffset;
  let parentSize: ClientSize;
  let elements: ElementInfo[];

  // --- Allow HTMLCollection to be used as an argument when supported
  if (Array.from) {
    ids = Array.from(ids);
  }

  // --- All DOM elements in the split should have a common parent. We can
  // --- grab the first elements parent and hope users read the docs because
  // --- the behavior will be whacky otherwise.
  const firstElement = elementOrSelector(ids[0]);
  const parent = (firstElement as HTMLElement).parentNode as Element;
  const parentStyle = getComputedStyle ? getComputedStyle(parent) : null;
  const parentFlexDirection = parentStyle ? parentStyle.flexDirection : null;

  // --- Set default options.sizes to equal percentages of the parent element.
  let sizes = getOption(options, "sizes") || ids.map(() => 100 / ids.length);

  // --- Standardize minSize to an array if it isn't already. This allows
  // --- minSize to be passed as a number.
  const minSize = getOption(options, "minSize", 100);
  const minSizes = Array.isArray(minSize) ? minSize : ids.map(() => minSize);

  // --- Get other options
  const expandToMin = getOption(options, "expandToMin", false);
  const gutterSize = getOption(options, "gutterSize", 10);
  const gutterAlign = getOption(options, "gutterAlign", "center");
  const snapOffset = getOption(options, "snapOffset", 30);
  const dragInterval = getOption(options, "dragInterval", 1);
  const direction = getOption(options, "direction", HORIZONTAL);
  const cursor = getOption(
    options,
    "cursor",
    direction === HORIZONTAL ? "ew-resize" : "ns-resize"
  );
  const gutter = getOption(options, "gutter", getDefaultGutterElement);
  const elementStyle = getOption(
    options,
    "elementStyle",
    // --- Returns the style attributum value for the default element size
    (dim: string, size: string | number) => ({
      [dim]: typeof size !== "string" ? `${size}%` : size
    })
  );

  // --- 2. Initialize a bunch of strings based on the direction we're
  // --- splitting. A lot of the behavior in the rest of the library is
  // --- paramatized down to rely on CSS strings and classes.
  if (direction === HORIZONTAL) {
    dimension = "width";
    clientAxis = "clientX";
    position = "left";
    positionEnd = "right";
    clientSize = "clientWidth";
    parentSize = "clientHeight";
    clientOffset = "offsetLeft";
  } else if (direction === "vertical") {
    dimension = "height";
    clientAxis = "clientY";
    position = "top";
    positionEnd = "bottom";
    clientSize = "clientHeight";
    parentSize = "clientWidth";
    clientOffset = "offsetTop";
  }

  const floatingGutter = getOption(options, "floatingGutter", true);
  const gutterStyle = getOption(options, "gutterStyle", (dim: Dimension, gutterSize: number) => ({
    [dim]: `${gutterSize}px`,
    position: floatingGutter ? "absolute" : undefined,
    "z-index": floatingGutter ? 20 : undefined,
    [crossDimension(dim)]: `${parent[parentSize]}px`,
    cursor
  }));

  // 3. Define the dragging helper functions, and a few helpers to go with them.
  // Each helper is bound to a pair object that contains its metadata. This
  // also makes it easy to store references to listeners that that will be
  // added and removed.
  //
  // Even though there are no other functions contained in them, aliasing
  // this to self saves 50 bytes or so since it's used so frequently.
  //
  // The pair object saves metadata like dragging state, position and
  // event listener references.

  // adjust sizes to ensure percentage is within min size and gutter.
  sizes = trimToMin(sizes);

  // 5. Create pair and element objects. Each pair has an index reference to
  // elements `a` and `b` of the pair (first and second elements).
  // Loop through the elements while pairing them off. Every pair gets a
  // `pair` object and a gutter.
  //
  // Basic logic:
  //
  // - Starting with the second element `i > 0`, create `pair` objects with
  //   `a = i - 1` and `b = i`
  // - Set gutter sizes based on the _pair_ being first/last. The first and last
  //   pair have gutterSize / 2, since they only have one half gutter, and not two.
  // - Create gutter elements and add event listeners.
  // - Set the size of the elements, minus the gutter sizes.
  //
  // -----------------------------------------------------------------------
  // |     i=0     |         i=1         |        i=2       |      i=3     |
  // |             |                     |                  |              |
  // |           pair 0                pair 1             pair 2           |
  // |             |                     |                  |              |
  // -----------------------------------------------------------------------
  const pairs: any[] = [];
  elements = ids.map((id, i) => {
    // Create the element object.
    const element = {
      element: elementOrSelector(id) as StyledElement,
      size: sizes[i],
      minSize: minSizes[i],
      i
    };

    let pair: any;

    if (i > 0) {
      // Create the pair object with its metadata.
      pair = {
        a: i - 1,
        b: i,
        dragging: false,
        direction,
        parent
      };

      pair.aGutterSize = getGutterSize(
        gutterSize,
        i - 1 === 0,
        false,
        gutterAlign
      );
      pair.bGutterSize = getGutterSize(
        gutterSize,
        false,
        i === ids.length - 1,
        gutterAlign
      );

      // if the parent has a reverse flex-direction, switch the pair elements.
      if (
        parentFlexDirection === "row-reverse" ||
        parentFlexDirection === "column-reverse"
      ) {
        const temp = pair.a;
        pair.a = pair.b;
        pair.b = temp;
      }
    }

    // Determine the size of the current element. IE8 is supported by
    // staticly assigning sizes without draggable gutters. Assigns a string
    // to `size`.
    if (i > 0) {
      const gutterElement = gutter(i, direction, element.element);
      setGutterSize(gutterElement, gutterSize, i);

      // Save bound event listener for removal later
      pair.gutterStartDragging = (arg: any) => startDragging(pair, arg); //startDragging.bind(pair);

      // Attach bound event listener
      gutterElement.addEventListener("mousedown", pair.gutterStartDragging);
      gutterElement.addEventListener("touchstart", pair.gutterStartDragging);

      parent.insertBefore(gutterElement, element.element as Node);

      pair.gutter = gutterElement;
    }

    setElementSize(
      element.element,
      element.size,
      getGutterSize(gutterSize, i === 0, i === ids.length - 1, gutterAlign),
      i
    );

    // After the first iteration, and we have a pair object, append it to the
    // list of pairs.
    if (i > 0) {
      pairs.push(pair);
    }

    return element;
  });

  elements.forEach(element => {
    const computedSize = element.element.getBoundingClientRect()[dimension];

    if (computedSize < element.minSize) {
      if (expandToMin) {
        adjustToMin(element);
      } else {
        // eslint-disable-next-line no-param-reassign
        element.minSize = computedSize;
      }
    }
  });

  // --- Calculate the positions of floating gutters
  if (floatingGutter) {
    let rolledSize = (elements[0].element as any)[clientOffset];
    for (let i = 0; i < pairs.length; i++) {
      rolledSize += elements[i].element[clientSize];
      updateGutterStyle(pairs[i].gutter, {
        [position]: `${rolledSize}px`
      });
    }
  }

  function setElementSize(
    el: StyledElement,
    size: number,
    gutSize: number,
    i: number
  ) {
    // Split.js allows setting sizes via numbers (ideally), or if you must,
    // by string, like '300px'. This is less than ideal, because it breaks
    // the fluid layout that `calc(% - px)` provides. You're on your own if you do that,
    // make sure you calculate the gutter size by hand.
    const style = elementStyle(dimension, size, gutSize, i);

    Object.keys(style).forEach(prop => {
      // eslint-disable-next-line no-param-reassign
      el.style[prop] = style[prop];
    });
  }

  function updateGutterStyle(gutterElement: StyledElement, style: any): void {
    Object.keys(style).forEach(prop => {
      // eslint-disable-next-line no-param-reassign
      gutterElement.style[prop] = style[prop];
    });
  }

  /**
   * Sets the size of the gutter element
   * @param gutterElement Gutter element
   * @param gutSize Gutter size
   * @param i Gutter element index
   */
  function setGutterSize(
    gutterElement: StyledElement,
    gutSize: number,
    i: number
  ) {
    const style = gutterStyle(dimension, gutSize, i);
    updateGutterStyle(gutterElement, style);
  }

  function getSizes(): number[] {
    return elements.map(element => element.size);
  }

  // Supports touch events, but not multitouch, so only the first
  // finger `touches[0]` is counted.
  function getMousePosition(e: any) {
    if ("touches" in e) return e.touches[0][clientAxis];
    return e[clientAxis];
  }

  // Actually adjust the size of elements `a` and `b` to `offset` while dragging.
  // calc is used to allow calc(percentage + gutterpx) on the whole split instance,
  // which allows the viewport to be resized without additional logic.
  // Element a's size is the same as offset. b's size is total size - a size.
  // Both sizes are calculated from the initial parent percentage,
  // then the gutter size is subtracted.
  function adjust(context: any, offset: any) {
    const a = elements[context.a];
    const b = elements[context.b];
    const percentage = a.size + b.size;

    a.size = (offset / context.size) * percentage;
    b.size = percentage - (offset / context.size) * percentage;

    setElementSize(a.element, a.size, context.aGutterSize, a.i);
    setElementSize(b.element, b.size, context.bGutterSize, b.i);
  }

  // drag, where all the magic happens. The logic is really quite simple:
  //
  // 1. Ignore if the pair is not dragging.
  // 2. Get the offset of the event.
  // 3. Snap offset to min if within snappable range (within min + snapOffset).
  // 4. Actually adjust each element in the pair to offset.
  //
  // ---------------------------------------------------------------------
  // |    | <- a.minSize               ||              b.minSize -> |    |
  // |    |  | <- this.snapOffset      ||     this.snapOffset -> |  |    |
  // |    |  |                         ||                        |  |    |
  // |    |  |                         ||                        |  |    |
  // ---------------------------------------------------------------------
  // | <- this.start                                        this.size -> |
  function drag(context: any, e: Event) {
    let offset;
    const a = elements[context.a];
    const b = elements[context.b];

    if (!context.dragging) return;

    // Get the offset of the event from the first side of the
    // pair `this.start`. Then offset by the initial position of the
    // mouse compared to the gutter size.
    offset =
      getMousePosition(e) -
      context.start +
      (context.aGutterSize - context.dragOffset);

    if (dragInterval > 1) {
      offset = Math.round(offset / dragInterval) * dragInterval;
    }

    // If within snapOffset of min or max, set offset to min or max.
    // snapOffset buffers a.minSize and b.minSize, so logic is opposite for both.
    // Include the appropriate gutter sizes to prevent overflows.
    if (offset <= a.minSize + snapOffset + context.aGutterSize) {
      offset = a.minSize + context.aGutterSize;
    } else if (
      offset >=
      context.size - (b.minSize + snapOffset + context.bGutterSize)
    ) {
      offset = context.size - (b.minSize + context.bGutterSize);
    }

    // Actually adjust the size.
    adjust(context, offset);

    // Call the drag callback continously. Don't do anything too intensive
    // in this callback.
    getOption(options, "onDrag", NOOP)();
  }

  // Cache some important sizes when drag starts, so we don't have to do that
  // continously:
  //
  // `size`: The total size of the pair. First + second + first gutter + second gutter.
  // `start`: The leading side of the first element.
  //
  // ------------------------------------------------
  // |      aGutterSize -> |||                      |
  // |                     |||                      |
  // |                     |||                      |
  // |                     ||| <- bGutterSize       |
  // ------------------------------------------------
  // | <- start                             size -> |
  function calculateSizes(context: any) {
    // Figure out the parent size minus padding.
    const a = elements[context.a].element;
    const b = elements[context.b].element;

    const aBounds = a.getBoundingClientRect();
    const bBounds = b.getBoundingClientRect();

    context.size =
      aBounds[dimension] +
      bBounds[dimension] +
      context.aGutterSize +
      context.bGutterSize;
    context.start = aBounds[position];
    context.end = aBounds[positionEnd];
  }

  function innerSize(element: any) {
    // Return nothing if getComputedStyle is not supported (< IE9)
    // Or if parent element has no layout yet
    if (!getComputedStyle) return null;

    const computedStyle = getComputedStyle(element);

    if (!computedStyle) return null;

    let size = element[clientSize];

    if (size === 0) return null;

    if (direction === HORIZONTAL) {
      size -=
        parseFloat(computedStyle.paddingLeft) +
        parseFloat(computedStyle.paddingRight);
    } else {
      size -=
        parseFloat(computedStyle.paddingTop) +
        parseFloat(computedStyle.paddingBottom);
    }

    return size;
  }

  // When specifying percentage sizes that are less than the computed
  // size of the element minus the gutter, the lesser percentages must be increased
  // (and decreased from the other elements) to make space for the pixels
  // subtracted by the gutters.
  function trimToMin(sizesToTrim: any) {
    // Try to get inner size of parent element.
    // If it's no supported, return original sizes.
    const parentSize = innerSize(parent);
    if (parentSize === null) {
      return sizesToTrim;
    }

    if (minSizes.reduce((a, b) => a + b, 0) > parentSize) {
      return sizesToTrim;
    }

    // Keep track of the excess pixels, the amount of pixels over the desired percentage
    // Also keep track of the elements with pixels to spare, to decrease after if needed
    let excessPixels = 0;
    const toSpare: any[] = [];

    const pixelSizes = sizesToTrim.map((size: any, i: number) => {
      // Convert requested percentages to pixel sizes
      const pixelSize = (parentSize * size) / 100;
      const elementGutterSize = getGutterSize(
        gutterSize,
        i === 0,
        i === sizesToTrim.length - 1,
        gutterAlign
      );
      const elementMinSize = minSizes[i] + elementGutterSize;

      // If element is too smal, increase excess pixels by the difference
      // and mark that it has no pixels to spare
      if (pixelSize < elementMinSize) {
        excessPixels += elementMinSize - pixelSize;
        toSpare.push(0);
        return elementMinSize;
      }

      // Otherwise, mark the pixels it has to spare and return it's original size
      toSpare.push(pixelSize - elementMinSize);
      return pixelSize;
    });

    // If nothing was adjusted, return the original sizes
    if (excessPixels === 0) {
      return sizesToTrim;
    }

    return pixelSizes.map((pixelSize: any, i: number) => {
      let newPixelSize = pixelSize;

      // While there's still pixels to take, and there's enough pixels to spare,
      // take as many as possible up to the total excess pixels
      if (excessPixels > 0 && toSpare[i] - excessPixels > 0) {
        const takenPixels = Math.min(excessPixels, toSpare[i] - excessPixels);

        // Subtract the amount taken for the next iteration
        excessPixels -= takenPixels;
        newPixelSize = pixelSize - takenPixels;
      }

      // Return the pixel size adjusted as a percentage
      return (newPixelSize / parentSize) * 100;
    });
  }

  // stopDragging is very similar to startDragging in reverse.
  function stopDragging(context: any) {
    const self = context;
    const a = elements[self.a].element;
    const b = elements[self.b].element;

    // --- Set floating gutter position
    if (floatingGutter) {
      const newPosition = (a as any)[clientOffset] + a[clientSize];
      updateGutterStyle(pairs[self.a].gutter, {
        [position]: `${newPosition}px`,
        [crossDimension(dimension)]: `${parent[parentSize]}px`
      });
    }

    if (self.dragging) {
      getOption(options, "onDragEnd", NOOP)(getSizes());
    }

    self.dragging = false;

    // Remove the stored event listeners. This is why we store them.
    window.removeEventListener("mouseup", self.stop);
    window.removeEventListener("touchend", self.stop);
    window.removeEventListener("touchcancel", self.stop);
    window.removeEventListener("mousemove", self.move);
    window.removeEventListener("touchmove", self.move);

    // Clear bound function references
    self.stop = null;
    self.move = null;

    a.removeEventListener("selectstart", NOOP);
    a.removeEventListener("dragstart", NOOP);
    b.removeEventListener("selectstart", NOOP);
    b.removeEventListener("dragstart", NOOP);

    a.style.userSelect = "";
    a.style.webkitUserSelect = "";
    a.style.MozUserSelect = "";
    a.style.pointerEvents = "";

    b.style.userSelect = "";
    b.style.webkitUserSelect = "";
    b.style.MozUserSelect = "";
    b.style.pointerEvents = "";

    self.gutter.style.cursor = cursor;
    self.parent.style.cursor = "";
    document.body.style.cursor = "";
  }

  // startDragging calls `calculateSizes` to store the inital size in the pair object.
  // It also adds event listeners for mouse/touch events,
  // and prevents selection while dragging so avoid the selecting text.
  function startDragging(context: any, e: MouseEvent) {
    // Right-clicking can't start dragging.
    if ("button" in e && e.button !== 0) {
      return;
    }

    // Alias frequently used variables to save space. 200 bytes.
    const self = context;
    const a = elements[self.a].element;
    const b = elements[self.b].element;

    // Call the onDragStart callback.
    if (!self.dragging) {
      getOption(options, "onDragStart", NOOP)(getSizes());
    }

    // Don't actually drag the element. We emulate that in the drag function.
    e.preventDefault();

    // Set the dragging property of the pair object.
    self.dragging = true;

    // Create two event listeners bound to the same pair object and store
    // them in the pair object.
    self.move = (arg: any) => drag(self, arg); // drag.bind(self);
    self.stop = () => stopDragging(self); //stopDragging.bind(self);

    // All the binding. `window` gets the stop events in case we drag out of the elements.
    window.addEventListener("mouseup", self.stop);
    window.addEventListener("touchend", self.stop);
    window.addEventListener("touchcancel", self.stop);
    window.addEventListener("mousemove", self.move);
    window.addEventListener("touchmove", self.move);

    // Disable selection. Disable!
    a.addEventListener("selectstart", NOOP);
    a.addEventListener("dragstart", NOOP);
    b.addEventListener("selectstart", NOOP);
    b.addEventListener("dragstart", NOOP);

    a.style.userSelect = "none";
    a.style.webkitUserSelect = "none";
    a.style.MozUserSelect = "none";
    a.style.pointerEvents = "none";

    b.style.userSelect = "none";
    b.style.webkitUserSelect = "none";
    b.style.MozUserSelect = "none";
    b.style.pointerEvents = "none";

    // Set the cursor at multiple levels
    self.gutter.style.cursor = cursor;
    self.parent.style.cursor = cursor;
    document.body.style.cursor = cursor;

    // Cache the initial sizes of the pair.
    calculateSizes(self);

    // Determine the position of the mouse compared to the gutter
    self.dragOffset = getMousePosition(e) - self.end;
  }

  function adjustToMin(element: any) {
    const isLast = element.i === pairs.length;
    const pair = isLast ? pairs[element.i - 1] : pairs[element.i];

    calculateSizes(pair);

    const size = isLast
      ? pair.size - element.minSize - pair.bGutterSize
      : element.minSize + pair.aGutterSize;

    adjust(pair, size);
  }

  function setSizes(newSizes: any) {
    const trimmed = trimToMin(newSizes);
    trimmed.forEach((newSize: any, i: number) => {
      if (i > 0) {
        const pair = pairs[i - 1];

        const a = elements[pair.a];
        const b = elements[pair.b];

        a.size = trimmed[i - 1];
        b.size = newSize;

        setElementSize(a.element, a.size, pair.aGutterSize, a.i);
        setElementSize(b.element, b.size, pair.bGutterSize, b.i);
      }
    });
  }

  function destroy(preserveStyles: any, preserveGutter: any) {
    pairs.forEach(pair => {
      if (preserveGutter !== true) {
        pair.parent.removeChild(pair.gutter);
      } else {
        pair.gutter.removeEventListener("mousedown", pair.gutterStartDragging);
        pair.gutter.removeEventListener("touchstart", pair.gutterStartDragging);
      }

      if (preserveStyles !== true) {
        const style = elementStyle(dimension, pair.a.size, pair.aGutterSize);

        Object.keys(style).forEach(prop => {
          elements[pair.a].element.style[prop] = "";
          elements[pair.b].element.style[prop] = "";
        });
      }
    });
  }

  return {
    setSizes,
    getSizes,
    collapse(i: any) {
      adjustToMin(elements[i]);
    },
    destroy,
    parent,
    pairs
  };
}

export default Split;
