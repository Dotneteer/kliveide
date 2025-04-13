import { SplitPanel } from "@controls/SplitPanel";
import { EmulatorPanel } from "./EmulatorPanel";
import { useDispatch, useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { KeyboardApi, KeyboardPanel } from "../Keyboard/KeyboardPanel";
import styles from "./EmulatorArea.module.scss";
import { useLayoutEffect, useRef, useState } from "react";
import {
  SETTING_EMU_KEYBOARD_HEIGHT,
  SETTING_EMU_SHOW_KEYBOARD
} from "@common/settings/setting-const";
import { useMainApi } from "@renderer/core/MainApi";
import { incProjectFileVersionAction } from "@common/state/actions";

export const EmulatorArea = () => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();

  const keyboardVisible = useGlobalSetting(SETTING_EMU_SHOW_KEYBOARD);
  const keyboardPanelHeight = useGlobalSetting(SETTING_EMU_KEYBOARD_HEIGHT);
  const [currentKeyboardPanelHeight, setCurrentKeyboardPanelHeight] = useState(keyboardPanelHeight);

  let api = useRef<KeyboardApi>();

  const machineType = useSelector((s) => s.emulatorState?.machineId);

  useLayoutEffect(() => {
    setCurrentKeyboardPanelHeight(keyboardPanelHeight);
  }, [keyboardPanelHeight]);

  return (
    <div className={styles.emulatorArea}>
      <SplitPanel
        primaryLocation="bottom"
        initialPrimarySize={currentKeyboardPanelHeight}
        primaryVisible={keyboardVisible}
        secondaryVisible={true}
        minSize={120}
        onPrimarySizeUpdateCompleted={(size: string) => {
          (async () => {
            await mainApi.setGlobalSettingsValue(SETTING_EMU_KEYBOARD_HEIGHT, size);
            dispatch(incProjectFileVersionAction());
          })();
        }}
      >
        <KeyboardPanel
          machineType={machineType}
          apiLoaded={(kbApi) => {
            api.current = kbApi;
          }}
        />
        <EmulatorPanel
          keyStatusSet={(code, down) => {
            api.current?.signKeyStatus(code, down);
          }}
        />
      </SplitPanel>
    </div>
  );
};
