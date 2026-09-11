import { ReactNode } from "react";
import classnames from "classnames";
import styles from "./SideBarBadge.module.scss";

/**
 * How loudly a badge speaks.
 *
 * `neutral` is a fact (how many watch expressions exist), `accent` is something noteworthy,
 * `warning` and `error` are states the user should act on. Defaulting to `neutral` matters: if
 * every badge shouted, the ones that matter would stop being visible.
 */
export type SideBarBadgeTone = "neutral" | "accent" | "warning" | "error";

type Props = {
  /**
   * A count. Rendered as-is, except that `0` renders **nothing at all** — see below.
   *
   * Pass either this or `children`, not both; `children` wins if both are given.
   */
  count?: number;
  /** Arbitrary badge content, for badges that are not counts ("muted", "3/8", "paused"). */
  children?: ReactNode;
  tone?: SideBarBadgeTone;
  /** Native tooltip. Worth supplying: a bare number is rarely self-explanatory. */
  title?: string;
};

/**
 * The small pill at the right of a sidebar panel header.
 *
 * **Renders `null` when there is nothing to say** — no children, or a `count` that is zero,
 * negative, `undefined` or `NaN`. That is the whole reason this component exists rather than a
 * plain `<span>` in each panel: a badge reading "0" is worse than no badge, because it draws the
 * eye to a panel at exactly the moment the panel has nothing in it. Making the empty case the
 * component's own responsibility means no future badge can forget to handle it.
 */
export const SideBarBadge = ({ count, children, tone = "neutral", title }: Props) => {
  const content = children ?? (Number.isFinite(count) && count > 0 ? count : undefined);
  if (content === undefined || content === null || content === false || content === "") {
    return null;
  }
  return (
    <span className={classnames(styles.badge, styles[tone])} title={title}>
      {content}
    </span>
  );
};
