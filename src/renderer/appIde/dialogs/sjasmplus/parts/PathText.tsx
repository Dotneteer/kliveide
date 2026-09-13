import classnames from "classnames";

import styles from "../SjasmplusIntegrationDialog.module.scss";

type PathTextProps = {
  testId?: string;
  value?: string;
  fallback: string;
  muted?: boolean;
};

// --- Renders a single-line path that truncates at its head, so the file name
// --- (the interesting part) always stays visible.
export const PathText = ({ testId, value, fallback, muted }: PathTextProps) => (
  <code
    className={classnames(styles.path, { [styles.muted]: muted })}
    title={value || fallback}
    data-testid={testId}
  >
    <bdi>{value || fallback}</bdi>
  </code>
);
