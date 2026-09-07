import { MutableRefObject } from "react";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { HStack } from "@renderer/controls/layout/Panels";
import { IconButton } from "./IconButton";
import { ToolbarSeparator } from "./ToolbarSeparator";
import { ExecutionControls } from "./ExecutionControls";
import { ViewControls } from "./ViewControls";
import { DISASSEMBLY_PANEL_ID, MEMORY_PANEL_ID } from "@common/state/common-ids";
import { SETTING_IDE_SYNC_BREAKPOINTS } from "@common/settings/setting-const";
import type { RecordingManager } from "@renderer/appEmu/recording/RecordingManager";
import { SECONDARY_ICON_SIZE } from "./toolbar-constants";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
  recordingManagerRef?: MutableRefObject<RecordingManager | null>;
};


export const Toolbar = ({ ide, kliveProjectLoaded, recordingManagerRef }: Props) => {
  const mainApi = useMainApi();
  const syncSourceBps = useGlobalSetting(SETTING_IDE_SYNC_BREAKPOINTS);
  const { ideCommandsService, projectService } = useAppServices();
  useSelector((s) => s.ideView?.documentHubState);
  const activeDocumentHub = projectService.getActiveDocumentHubService();
  const isMemoryOpen = activeDocumentHub?.isOpen(MEMORY_PANEL_ID) ?? false;
  const isDisassemblyOpen = activeDocumentHub?.isOpen(DISASSEMBLY_PANEL_ID) ?? false;

  return (
    <HStack
      height="--strip-toolbar"
      backgroundColor="--bgcolor-toolbar"
      paddingHorizontal="--space-2"
      // 2px, not 4px: a 38px strip with 4px padding leaves a 30px content box, and the buttons are
      // 32px tall (30 + 1px padding each side), so they would overflow it.
      paddingVertical="--space-0_5"
      verticalContentAlignment="center"
      // The buttons used to abut with no gap at all, so the toolbar read as one undifferentiated
      // run of icons.
      gap="--space-0_5"
    >
      <ExecutionControls ide={ide} kliveProjectLoaded={kliveProjectLoaded} />
      {!ide && <ViewControls recordingManagerRef={recordingManagerRef} />}
      {ide && (
        <>
          <ToolbarSeparator />
          <IconButton
            iconName="sync-ignored"
            iconSize={SECONDARY_ICON_SIZE}
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
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-orange"
            title="Show Memory Panel"
            selected={isMemoryOpen}
            clicked={async () => {
              if (isMemoryOpen) {
                await ideCommandsService.executeCommand("hide-memory");
              } else {
                await ideCommandsService.executeCommand("show-memory");
              }
            }}
          />
          <IconButton
            iconName="disassembly-icon"
            iconSize={SECONDARY_ICON_SIZE}
            fill="--color-toolbarbutton-orange"
            title="Show Disassembly Panel"
            selected={isDisassemblyOpen}
            clicked={async () => {
              if (isDisassemblyOpen) {
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
