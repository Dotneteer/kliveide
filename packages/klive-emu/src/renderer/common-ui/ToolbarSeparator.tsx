import * as React from "react";
import styles from "styled-components";

/**
 * Represents a toolbar separator comonent
 */
export function ToolbarSeparator() {
  return (
    <Root>
      <Line />
    </Root>
  );
}

const Root = styles.div`
  height: 100%;
  padding: 4px 8px;
`;

const Line = styles.div`
  border-left: var(--toolbar-separator);
  height: 100%;
`;
