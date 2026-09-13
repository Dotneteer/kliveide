import type { ReactNode } from "react";
import styles from "./DialogFooter.module.scss";

type Props = {
  /**
   * The dialog's buttons.
   *
   * The band is `row-reverse`, matching `Modal`'s own footer: declare the dismissing or committing
   * button *first* and it lands at the trailing edge, where the shell would have put it.
   */
  children?: ReactNode;
};

/**
 * The footer band for a dialog body that supplies its own buttons.
 *
 * `DialogProvider` renders a managed body inside `Modal`'s `.dialogBody` with the shell's own footer
 * buttons switched off, so a dialog whose actions do not fit the shell's primary/secondary/cancel
 * shape has to draw the band itself. Use this rather than hand-rolling one: it is the same band the
 * shell draws (one shared mixin), and it knows how to break out of the body's padding without
 * guessing at the number — see the note in `DialogFooter.module.scss`.
 */
export const DialogFooter = ({ children }: Props) => (
  <footer className={styles.dialogFooter}>{children}</footer>
);

/** Separates the trailing button from the leading ones. See `DialogFooter`. */
export const DialogFooterSpacer = () => <div className={styles.spacer} />;
