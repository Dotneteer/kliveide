import { BackDrop } from "@controls/BackDrop";
import { SplitPanel } from "@controls/SplitPanel";
import { Toolbar } from "@controls/Toolbar";
import {
  useDispatch,
  useGlobalSetting,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { activityRegistry } from "@renderer/registry";
import { displayDialogAction, incProjectFileVersionAction } from "@state/actions";
import { useEffect, useState } from "react";
import { ActivityBar } from "./ActivityBar/ActivityBar";
import { DocumentArea } from "@renderer/features/documents/DocumentArea";
import { useAppServices } from "./services/AppServicesProvider";
import { SiteBar } from "./SideBar/SideBar";
import { IdeStatusBar } from "./StatusBar/IdeStatusBar";
import { ToolArea } from "./ToolArea/ToolArea";
import { IdeEventsHandler } from "./IdeEventsHandler";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { useMainApi } from "@renderer/core/MainApi";
import { IdeDialogHost } from "./IdeDialogHost";
import {
  SETTING_IDE_MAXIMIZE_TOOLS,
  SETTING_IDE_SHOW_SIDEBAR,
  SETTING_IDE_SHOW_STATUS_BAR,
  SETTING_IDE_SHOW_TOOLBAR,
  SETTING_IDE_SHOW_TOOLS,
  SETTING_IDE_SIDEBAR_TO_RIGHT,
  SETTING_IDE_SIDEBAR_WIDTH,
  SETTING_IDE_TOOLPANEL_HEIGHT,
  SETTING_IDE_TOOLS_ON_TOP
} from "@common/settings/setting-const";
import { useEnsureIdeDocumentHub, useIdeStartup } from "./useIdeStartup";

const IdeApp = () => {
  // --- Used services
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const mainApi = useMainApi();
  const { store, messenger } = useRendererContext();

  // --- Visual state
  const appPath = decodeURIComponent(location.search.split("=")?.[1]);
  const ideLoaded = useSelector((s) => s.ideLoaded ?? false);
  const dimmed = useSelector((s) => s.dimMenu ?? false);
  const isWindows = useSelector((s) => s.isWindows ?? false);
  const showToolbar = useGlobalSetting(SETTING_IDE_SHOW_TOOLBAR);
  const showStatusBar = useGlobalSetting(SETTING_IDE_SHOW_STATUS_BAR);
  const showSideBar = useGlobalSetting(SETTING_IDE_SHOW_SIDEBAR);
  const sidebarToRight = useGlobalSetting(SETTING_IDE_SIDEBAR_TO_RIGHT);
  const showToolPanels = useGlobalSetting(SETTING_IDE_SHOW_TOOLS);
  const maximizeToolPanels = useGlobalSetting(SETTING_IDE_MAXIMIZE_TOOLS);
  const dialogId = useSelector((s) => s.ideView?.dialogToDisplay);
  const kliveProjectLoaded = useSelector((s) => s.project?.isKliveProject ?? false);
  const sideBarWidth = useGlobalSetting(SETTING_IDE_SIDEBAR_WIDTH);
  const toolPanelHeight = useGlobalSetting(SETTING_IDE_TOOLPANEL_HEIGHT);
  const toolPanelOnTop = useGlobalSetting(SETTING_IDE_TOOLS_ON_TOP);
  const [currentSidebarWidth, setCurrentSidebarWidth] = useState(sideBarWidth);
  const [currentToolPanelHeight, setCurrentToolPanelHeight] = useState(toolPanelHeight);

  useEnsureIdeDocumentHub(appServices);
  useIdeStartup({ appPath, appServices, dispatch, ideLoaded, isWindows, messenger, store });

  useEffect(() => {
    setCurrentSidebarWidth(sideBarWidth);
    setCurrentToolPanelHeight(toolPanelHeight);
  }, [sideBarWidth, toolPanelHeight]);

  return (
    <FullPanel id="appMain">
      <IdeEventsHandler />
      {showToolbar && <Toolbar ide={true} kliveProjectLoaded={kliveProjectLoaded} />}
      <FullPanel orientation="horizontal">
        <ActivityBar activities={activityRegistry} order={sidebarToRight ? 3 : 0} />
        <SplitPanel
          primaryLocation={sidebarToRight ? "right" : "left"}
          primaryVisible={showSideBar}
          initialPrimarySize={currentSidebarWidth}
          minSize={60}
          onPrimarySizeUpdateCompleted={(size: string) => {
            (async () => {
              await mainApi.setGlobalSettingsValue(SETTING_IDE_SIDEBAR_WIDTH, size);
              dispatch(incProjectFileVersionAction());
            })();
          }}
        >
          <SiteBar />
          <SplitPanel
            primaryLocation={toolPanelOnTop ? "top" : "bottom"}
            primaryVisible={showToolPanels}
            minSize={160}
            secondaryVisible={!maximizeToolPanels || !showToolPanels}
            initialPrimarySize={currentToolPanelHeight}
            onPrimarySizeUpdateCompleted={(size: string) => {
              (async () => {
                await mainApi.setGlobalSettingsValue(SETTING_IDE_TOOLPANEL_HEIGHT, size);
                dispatch(incProjectFileVersionAction());
              })();
            }}
          >
            <ToolArea siblingPosition={toolPanelOnTop ? "top" : "bottom"} />
            <DocumentArea />
          </SplitPanel>
        </SplitPanel>
      </FullPanel>
      <IdeStatusBar show={showStatusBar} />
      <BackDrop visible={dimmed} />
      <IdeDialogHost dialogId={dialogId} onClose={() => store.dispatch(displayDialogAction())} />
    </FullPanel>
  );
};

export default IdeApp;
