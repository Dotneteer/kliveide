import * as React from "react";

import styles from "styled-components";
import { createSizedStyledPanel } from "../common/PanelStyles";

const Root = createSizedStyledPanel({
  height: 24,
  splitsVertical: true,
  fitToClient: false,
});

styles.div`
  display: flex;
  flex-direction: column;
  flex-grow: 0;
  flex-shrink: 0;
  height: 24px;
  width: 100%;
  background-color: var(--sidebar-background-color);
  position: relative;
  border: 1px solid yellow
`;

interface Props {
}

interface State {
}

/**
 * Represents the statusbar of the emulator
 */
export default class DocumentTabBar extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
    };
  }

  render() {
    return (
      <Root>
      </Root>
    );
  }

}
