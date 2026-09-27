import { MutableRefObject } from "react";
import type { MouseEvent } from "react";
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
import { NavigationControls } from "@renderer/features/navigation/NavigationControls";

type Props = {
  ide: boolean;
  kliveProjectLoaded: boolean;
  recordingManagerRef?: MutableRefObject<RecordingManager | null>;
};

/**
 * Keeps a mouse click on a toolbar button from moving keyboard focus onto that button.
 *
 * The emulator reads the host keyboard from `window`, so keys reach it wherever focus is. A button
 * that kept focus after a click therefore received every Space and Enter the user typed into the
 * emulated machine as well, and activated itself again: after starting a screen recording, the
 * first Space or Enter typed into the machine stopped it (issue #1383), and the same happened to
 * every other toolbar button. Cancelling the default action of `mousedown` leaves focus where it
 * was; the click itself still fires, and a button reached with Tab still works from the keyboard.
 */
export const keepFocusOffToolbarButtons = (event: MouseEvent<HTMLElement>) => {
  if ((event.target as Element | null)?.closest?.("button")) {
    event.preventDefault();
  }
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
    // `display: contents` adds no box, so the wrapper cannot disturb the strip's layout; it exists
    // only because `HStack` does not forward mouse handlers.
    <div style={{ display: "contents" }} onMouseDown={keepFocusOffToolbarButtons}>
      <HStack
        height="--strip-toolbar"
        backgroundColor="--bgcolor-toolbar"
        paddingHorizontal="--space-2"
        // 2px, not 4px: with 4px padding a 30px content box would clip the buttons, which are
        // 32px tall (30 + 1px padding each side). At the 42px strip height (see STRIP.toolbar in
        // dimensions.ts) 2px padding leaves a 38px content box - 3px of clearance above and below
        // each button.
        paddingVertical="--space-0_5"
        verticalContentAlignment="center"
        // The buttons used to abut with no gap at all, so the toolbar read as one undifferentiated
        // run of icons.
        gap="--space-0_5"
      >
        {ide && <NavigationControls />}
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
    </div>
  );
};
