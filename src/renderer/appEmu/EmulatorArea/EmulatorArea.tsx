import { SplitPanel } from "@controls/SplitPanel";
import { EmulatorPanel } from "./EmulatorPanel";
import { useSelector } from "@renderer/core/RendererProvider";
import { KeyboardPanel } from "../Keyboard/KeyboardPanel";
import styles from "./EmulatorArea.module.scss";

export const EmulatorArea = () => {
  const keyboardVisible = useSelector(
    s => s.emuViewOptions?.showKeyboard ?? false
  );
  return (
    <div className={styles.emulatorArea}>
      <SplitPanel
        primaryLocation='bottom'
        secondaryPanel={<EmulatorPanel />}
        initialPrimarySize='33%'
        primaryPanel={<KeyboardPanel />}
        primaryVisible={keyboardVisible}
        secondaryVisible={true}
        minSize={120}
      />
    </div>
  );
};
