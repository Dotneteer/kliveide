import * as React from "react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import { AppState } from "@state/AppState";
import { animationTick } from "@components/component-utils";
import Sp48Keyboard from "./Sp48Keyboard";
import Cz88Keyboard from "./Cz88Keyboard";
import { useObserver } from "@components/useObserver";

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

  const hostElement = useRef<HTMLDivElement>();

  useEffect(() => {
    if (hostElement?.current) {
      setWidth(hostElement.current.offsetWidth);
      setHeight(hostElement.current.offsetHeight);
    }
  });

  // --- Handle resizing
  const _onResize = () => handleResize();

  useObserver({
    callback: _onResize,
    element: hostElement,
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
      <div style={rootStyle} ref={hostElement}>
        {keyboard}
      </div>
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

const rootStyle: CSSProperties = {
  display: "flex",
  overflow: "hidden",
  flexShrink: 1,
  flexGrow: 1,
  height: "100%",
  backgroundColor: "var(--keyboard-background-color)",
  padding: "16px 12px 8px 12px",
  boxSizing: "border-box",
  alignContent: "start",
  justifyItems: "start",
  justifyContent: "center",
};
