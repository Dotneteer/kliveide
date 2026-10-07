import { useEffect, useMemo, useRef } from "react";

import type { SettingsDialogData } from "@common/settings/settings-dialog";
import { Modal } from "@renderer/controls/Modal";
import { useMainApi } from "@renderer/core/MainApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { useController, useViewModel } from "@renderer/mvc";
import { SettingsController, type SettingsPorts } from "./SettingsController";
import type { SettingsEnvironment } from "./SettingsModel";
import { SettingsView } from "./SettingsView";

export type SettingsDialogResult = undefined;

type Props = {
  data?: SettingsDialogData;
  onClose: () => void;
};

/**
 * Klive › Settings… / File › Settings… (`.plans/MENU_REDESIGN_PLAN.md` §4).
 *
 * Wiring only: the rules live in `SettingsModel` / `SettingsViewModel` / `SettingsController`.
 * Opens in whichever window has the focus, so both dialog registries render it.
 */
export const SettingsDialog = ({ data, onClose }: Props) => {
  const mainApi = useMainApi();
  const appState = useSelector((s) => s);
  const tone = appState?.theme === "light" ? "light" : "dark";
  const env = useMemo<SettingsEnvironment>(
    () => ({ appState, platform: { isWindows: !!appState?.isWindows } }),
    [appState]
  );

  // --- The controller keeps the ports it was built with, so read the close callback through a ref
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const controller = useController(() => {
    const ports: SettingsPorts = {
      setSetting: (settingId, value) => mainApi.setGlobalSettingsValue(settingId, value),
      runAction: (actionId, value) => mainApi.runUiAction(actionId, value),
      close: () => onCloseRef.current()
    };
    return new SettingsController(ports, data?.page, env);
  });
  const vm = useViewModel(controller);

  useEffect(() => {
    void controller.dispatch({ type: "environmentChanged", env });
  }, [controller, env]);

  return (
    <Modal
      title="Settings"
      iconName="settings-gear"
      isOpen={true}
      width={860}
      onClose={onClose}
      primaryLabel="Close"
      onPrimaryClicked={async () => false}
      secondaryLabel="Reset Page to Defaults"
      secondaryVisible={true}
      secondaryEnabled={vm.resetEnabled}
      onSecondaryClicked={async () => {
        await controller.dispatch({ type: "resetPageRequested" });
        return true;
      }}
      cancelVisible={false}
      initialFocus="none"
    >
      <SettingsView vm={vm} tone={tone} dispatch={(intent) => void controller.dispatch(intent)} />
    </Modal>
  );
};
