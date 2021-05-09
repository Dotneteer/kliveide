import * as React from "react";
import styles from "styled-components";

const Root = styles.div`
  height: 100%;
  padding: 4px 8px;
`;

const Line = styles.div`
  border-left: var(--toolbar-separator);
  height: 100%;
`;

/**
 * Represents a toolbar separator comonent
 */
export class ToolbarSeparator extends React.Component {
  render() {
    return (
      <Root>
        <Line />
      </Root>
    );
  }
}
