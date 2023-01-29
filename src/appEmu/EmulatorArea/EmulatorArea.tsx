import { SplitPanel } from "../../controls/common/SplitPanel";
import { EmulatorPanel } from "./EmulatorPanel";
import { KeyboardPanel } from "./KeyboardPanel";
import styles from "./EmulatorArea.module.scss";
import { useSelector } from "@/core/RendererProvider";

export const EmulatorArea = () => {
  const keyboardVisible = useSelector(
    s => s.emuViewOptions?.showKeyboard ?? false
  );
  return (
    <div className={styles.component}>
      <SplitPanel
        primaryLocation='top'
        primaryPanel={<EmulatorPanel />}
        initialSecondarySize="33%"
        secondaryPanel={<KeyboardPanel />}
        secondaryVisible={keyboardVisible}
        minSize={40}
      />
    </div>
  );
};
