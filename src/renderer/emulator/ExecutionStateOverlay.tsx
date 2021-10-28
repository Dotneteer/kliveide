import * as React from "react";
import styles from "styled-components";

interface Props {
  text: string;
  clicked?: () => void;
}

/**
 * Represents the overlay of the emulator's panel
 */
export default function ExecutionStateOverlay(props: Props) {
  if (props.text) {
    return (
      <Root onClick={handleClick}>
        <Overlay title="Hide overlay (click to show again)">
          {props.text}
        </Overlay>
      </Root>
    );
  } else {
    return null;
  }

  function handleClick(e: React.MouseEvent): void {
    e.stopPropagation();
    props.clicked?.();
  }
}

const Root = styles.div`
  position: relative;
  flex-shrink: 0;
  flex-grow: 0;
  height: 0;
  left: 8px;
  top: 8px;
  margin-right: 16px;
`;

const Overlay = styles.span`
  display: inline-block;
  background-color: #404040;
  color: lightgreen;
  opacity: 0.9;
  padding: 2px 10px 4px 10px;
  border-radius: 4px;
  cursor: pointer;
`;
