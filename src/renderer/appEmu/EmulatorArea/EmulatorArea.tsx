import { SplitPanel } from "@controls/SplitPanel";
import { EmulatorPanel } from "./EmulatorPanel";
import { useSelector } from "@renderer/core/RendererProvider";
import { KeyboardApi, KeyboardPanel } from "../Keyboard/KeyboardPanel";
import styles from "./EmulatorArea.module.scss";
import { useRef } from "react";

export const EmulatorArea = () => {
  const keyboardVisible = useSelector(
    s => s.emuViewOptions?.showKeyboard ?? false
  );

  let api = useRef<KeyboardApi>();

  const machineType = useSelector(s => s.emulatorState?.machineId);
  return (
    <div className={styles.emulatorArea}>
      <SplitPanel
        primaryLocation='bottom'
        secondaryPanel={
          <EmulatorPanel
            keyStatusSet={(code, down) => {
              api.current?.signKeyStatus(code, down);
            }}
          />
        }
        initialPrimarySize='33%'
        primaryPanel={
          <KeyboardPanel
            machineType={machineType}
            apiLoaded={kbApi => {
              api.current = kbApi;
            }}
          />
        }
        primaryVisible={keyboardVisible}
        secondaryVisible={true}
        minSize={120}
      />
    </div>
  );
};
