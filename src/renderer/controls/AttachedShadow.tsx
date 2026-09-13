import styles from "./AttachedShadow.module.scss";
import classnames from "classnames";

type Props = {
  visible: boolean;
};

/**
 * The overflow shadow a scrollable region casts at its own top edge.
 *
 * **It is positioned by CSS, not by measurement.**
 *
 * It used to take the scroll container as a prop and copy that element's `offsetTop`, `offsetLeft`
 * and `offsetWidth` into inline styles, refreshed by a `ResizeObserver`. Four things were wrong
 * with that, and the first is the one that put the shadow in the wrong place:
 *
 * - **`offsetTop` and `position: absolute` are measured against different elements.** `offsetTop`
 *   is relative to the container's *offset parent* - the nearest ancestor with a `position` - while
 *   the shadow resolves against its own *containing block*, which is also established by
 *   `transform`, `filter`, `contain` and friends. Those are the same element only by luck, and
 *   nothing enforced it. When they diverge the shadow lands somewhere else entirely, and because it
 *   is invisible until the region is scrolled, it appears *the moment you start scrolling*.
 * - **It tracked size, not position.** A container that moved without changing size - a pane above
 *   it growing, a splitter dragged - left the shadow behind at its old coordinates.
 * - **It received `parentElement.current`**, which is `null` on the first render, so the first
 *   paint always had a 0x0 shadow at the origin.
 * - It cost a `ResizeObserver` per scrollable region for something CSS does for free.
 *
 * Rendered as the last child of a `position: relative` scroll container, `top/left/right: 0` *is*
 * the top edge - always, with nothing to observe and nothing to go stale.
 */
export const AttachedShadow = ({ visible }: Props) => (
  <div className={classnames(styles.attachedShadow, { [styles.show]: visible })} />
);
