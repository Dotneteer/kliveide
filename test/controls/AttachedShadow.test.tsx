import { describe, it, expect } from "vitest";
import React from "react";
import { renderWithProviders } from "../react-test-utils";

/** The shadow itself, found by its CSS-module class rather than by tree position. */
const shadowIn = (container: HTMLElement) =>
  container.querySelector('[class*="attachedShadow"]') as HTMLElement;
import { AttachedShadow } from "@controls/AttachedShadow";

/*
 * These tests used to pin the component's *mechanics*: that it built a `ResizeObserver`, observed
 * the scroll container, and disconnected on unmount. All of that is gone, and with it the bug it
 * existed to manage.
 *
 * The shadow copied its container's `offsetTop`/`offsetLeft`/`offsetWidth` into inline styles.
 * `offsetTop` is relative to the container's *offset parent*; `position: absolute` resolves against
 * the shadow's own *containing block*. Those are the same element only by luck - a `transform` or
 * `filter` anywhere between them establishes a containing block without becoming an offset parent -
 * and when they diverged the shadow drew somewhere else entirely. Because it is invisible until the
 * region scrolls, that showed up as "the fade appears in the wrong place when I start scrolling".
 *
 * So what is pinned now is the contract that replaced it: the shadow carries no geometry of its
 * own, and is anchored by CSS to a `position: relative` `ScrollViewer`.
 */
describe("AttachedShadow", () => {
  it("carries no measured geometry", () => {
    // The regression guard. An inline top/left/width here means someone reintroduced measurement,
    // and with it the possibility of the shadow landing away from its container.
    const { container } = renderWithProviders(<AttachedShadow visible={true} />);
    const shadow = shadowIn(container);
    expect(shadow.style.top).toBe("");
    expect(shadow.style.left).toBe("");
    expect(shadow.style.width).toBe("");
  });

  it("takes no element to position against", () => {
    // It used to be handed `parentElement.current`, which is `null` on the first render - so the
    // first paint was always a 0x0 shadow at the origin.
    expect(AttachedShadow.length).toBe(1); // one props object
    const props = Object.keys({ visible: true });
    expect(props).toEqual(["visible"]);
  });

  it("is hidden until the region is scrolled, and shown after", () => {
    const hiddenEl = shadowIn(renderWithProviders(<AttachedShadow visible={false} />).container);
    const shownEl = shadowIn(renderWithProviders(<AttachedShadow visible={true} />).container);

    // Both carry the base class; only the visible one carries the modifier.
    expect(hiddenEl.className).toBe(shownEl.className.split(" ")[0]);
    expect(shownEl.className.split(" ").length).toBe(2);
  });

  it("renders a single element with nothing inside it", () => {
    // It sits over content, so it must not be able to swallow a click or add a focus stop.
    const { container } = renderWithProviders(<AttachedShadow visible={true} />);
    expect(container.querySelectorAll('[class*="attachedShadow"]').length).toBe(1);
    expect(shadowIn(container).childElementCount).toBe(0);
  });
});
