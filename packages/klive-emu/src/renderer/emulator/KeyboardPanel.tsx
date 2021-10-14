import * as React from "react";
import { useSelector } from "react-redux";
import { AppState } from "@state/AppState";
import ReactResizeDetector from "react-resize-detector";
import Sp48Keyboard from "./Sp48Keyboard";
import Cz88Keyboard from "./Cz88Keyboard";
import { animationTick } from "../../emu-ide/components/component-utils";
import styles from "styled-components";
import { useEffect, useState } from "react";

const Root = styles.div`
  display: flex;
  overflow: hidden;
  flex-shrink: 1;
  flex-grow: 1;
  height: 100%;
  background-color: var(--keyboard-background-color);
  padding: 16px 12px 8px 12px;
  box-sizing: border-box;
  align-content: start;
  justify-items: start;
  justify-content: center;
`;

interface Props {
  type: string;
}

/**
 * Represents the keyboard panel of the emulator
 */
export default function KeyboardPanel(props: Props) {
  // --- Component state
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  // --- App state selectors
  const visible = useSelector((s: AppState) => s.emuViewOptions.showKeyboard);
  const layout = useSelector((s: AppState) => s.emulatorPanel.keyboardLayout);

  const hostElement: React.RefObject<HTMLDivElement> = React.createRef();

  useEffect(() => {
    if (hostElement?.current) {
      setWidth(hostElement.current.offsetWidth);
      setHeight(hostElement.current.offsetHeight);
    }
  });

  let keyboard = null;
  switch (props.type) {
    case "sp48":
      keyboard = <Sp48Keyboard width={width} height={height} />;
      break;
    case "cz88":
      keyboard = <Cz88Keyboard width={width} height={height} layout={layout} />;
  }
  if (visible) {
    return (
      <Root ref={hostElement}>
        {keyboard}
        <ReactResizeDetector handleWidth handleHeight onResize={handleResize} />
      </Root>
    );
  }
  return null;

  async function handleResize(): Promise<void> {
    await animationTick();
    if (hostElement?.current) {
      setWidth(hostElement.current?.offsetWidth ?? 0);
      setHeight(hostElement.current?.offsetHeight ?? 0);
    }
  }
}
