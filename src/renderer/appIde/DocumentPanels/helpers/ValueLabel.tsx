import styles from "./ValueLabel.module.scss";

type Props = {
  text: string;
};

/**
 * A value in a file viewer's header strip.
 *
 * One component, because there were two — byte-for-byte identical private copies in
 * `TapViewerPanel` and `DskViewerPanel`, each with its own byte-for-byte identical `.valueLabel`
 * rule. The two viewers are siblings that were written by copying one from the other, so the
 * duplication was structural rather than coincidental: whichever was fixed first, the other stayed
 * wrong. (Both carried the same `font-size: 1em` and the same legacy `--color-value`.)
 */
export const ValueLabel = ({ text }: Props) => (
  <div className={styles.valueLabel}>{text}</div>
);
