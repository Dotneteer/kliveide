import { MutableRefObject } from "react";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { HStack } from "./new/Panels";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ExecutionControls } from "./ExecutionControls";
import { ViewControls } from "./ViewControls";
import { DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "@common/state/common-ids";
import { SETTING_IDE_SYNC_BREAKPOINTS } from "@common/settings/setting-const";
import type { RecordingManager } from "@renderer/appEmu/recording/RecordingManager";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
  recordingManagerRef?: MutableRefObject<RecordingManager | null>;
};

export const Toolbar = ({ ide, kliveProjectLoaded, recordingManagerRef }: Props) => {
  const mainApi = useMainApi();
  const volatileDocs = useSelector((s) => s.ideView.volatileDocs);
  const syncSourceBps = useGlobalSetting(SETTING_IDE_SYNC_BREAKPOINTS);
  const { ideCommandsService } = useAppServices();

  return (
    <HStack
      height="38px"
      backgroundColor="--bgcolor-toolbar"
      paddingHorizontal="--space-1_5"
      paddingVertical="--space-1"
      verticalContentAlignment="center"
    >
      <ExecutionControls ide={ide} kliveProjectLoaded={kliveProjectLoaded} />
      {!ide && <ViewControls recordingManagerRef={recordingManagerRef} />}
      {ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName="sync-ignored"
            selected={syncSourceBps}
            fill="--color-toolbarbutton-orange"
            title="Sync the source with the current breakpoint"
            clicked={async () => {
              await mainApi.setGlobalSettingsValue(SETTING_IDE_SYNC_BREAKPOINTS, !syncSourceBps);
            }}
          />
          <ToolbarSeparator />
          <IconButton
            iconName="memory-icon"
            fill="--color-toolbarbutton-orange"
            title="Show Memory Panel"
            selected={volatileDocs?.[MEMORY_PANEL_ID]}
            clicked={async () => {
              if (volatileDocs?.[MEMORY_PANEL_ID]) {
                await ideCommandsService.executeCommand("hide-memory");
              } else {
                await ideCommandsService.executeCommand("show-memory");
              }
            }}
          />
          <IconButton
            iconName="disassembly-icon"
            fill="--color-toolbarbutton-orange"
            title="Show Disassembly Panel"
            selected={volatileDocs?.[DISASSEMBLY_PANEL_ID]}
            clicked={async () => {
              if (volatileDocs?.[DISASSEMBLY_PANEL_ID]) {
                await ideCommandsService.executeCommand("hide-disass");
              } else {
                await ideCommandsService.executeCommand("show-disass");
              }
            }}
          />
        </>
      )}
    </HStack>
  );
};
