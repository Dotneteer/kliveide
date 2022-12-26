import { SplitPanel } from "../SplitPanel/SplitPanel";
import { EmulatorPanel } from "./EmulatorPanel";
import { KeyboardPanel } from "./KeyboardPanel";
import styles from "./EmulatorArea.module.scss";
import { useSelector } from "@/emu/StoreProvider";

export const EmulatorArea = () => {
    const keyboardVisible = useSelector(s => s.emuViewOptions?.showKeyboard ?? false);
    return  (
    <div className={styles.component} >
        <SplitPanel
            id="emulator"
            primaryLocation="top"
            primaryPanel={<EmulatorPanel />}
            initialPrimarySize="50%"
            secondaryPanel={<KeyboardPanel />}
            secondaryVisible={keyboardVisible}
            minSize={40}
        />
    </div>
    )
}