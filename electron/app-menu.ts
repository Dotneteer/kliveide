import { 
    app, 
    BrowserWindow, 
    Menu, 
    MenuItem, 
    MenuItemConstructorOptions 
} from "electron";
import { __DARWIN__ } from "./electron-utils";
import { mainStore } from "./main-store";
import { 
    showStatusBarAction, 
    showToolbarAction, 
    primaryBarOnRightAction, 
    showSideBarAction, 
    useEmuViewAction, 
    showToolPanelsAction,
    toolPanelsOnTopAction,
    maximizeToolsAction,
    setThemeAction,
    changeToolVisibilityAction} from "../common/state/actions";
import { setMachineType } from "./machines";
import { MachineControllerState } from "../common/state/MachineControllerState";
import { sendFromMainToEmu } from "./MainToEmuMessenger";
import { createMachineCommand } from "../common/messaging/message-types";

const TOGGLE_DEVTOOLS = "toggle_devtools";
const TOGGLE_SIDE_BAR = "toggle_side_bar";
const TOGGLE_TOOLBAR = "toggle_toolbar";
const TOGGLE_PRIMARY_BAR_RIGHT = "primary_side_bar_right"
const TOGGLE_STATUS_BAR = "toggle_status_bar";
const SET_EMULATOR_VIEW = "set_emulator_view";
const SET_IDE_VIEW = "set_ide_view";
const TOGGLE_TOOL_PANELS = "toggle_tool_panels";
const TOGGLE_TOOLS_TOP = "tool_panels_top";
const MAXIMIZE_TOOLS = "tools_maximize";
const TOOL_PREFIX = "tool_panel_";
const THEMES = "themes";
const LIGHT_THEME = "light_theme";
const DARK_THEME = "dark_theme";

const MACHINE_TYPES = "machine_types";
const MACHINE_SP48 = "machine_sp48";
const START_MACHINE = "start";
const PAUSE_MACHINE = "pause";
const STOP_MACHINE = "stop";
const RESTART_MACHINE = "restart";
const DEBUG_MACHINE = "debug";
const STEP_INTO = "step_into";
const STEP_OVER = "step_over";
const STEP_OUT = "step_out";

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu(): void {
    const template: (MenuItemConstructorOptions | MenuItem)[] = [];
    const appState = mainStore.getState();
    const tools = appState.ideView?.tools ?? [];

    /**
     * Application system menu on MacOS
     */
    if (__DARWIN__) {
        template.push({
            label: app.name,
            submenu: [
                { role: "about" },
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        });
    }

    /**
     * Edit menu on MacOS
     */
    if (__DARWIN__) {
        template.push({
            label: 'Edit',
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                {role: 'pasteAndMatchStyle'},
                {role: 'delete'},
                {role: 'selectAll'}
            ]
        })
    }

    const toolMenus: MenuItemConstructorOptions[] = tools.map(t => {
        return {
            id: `${TOOL_PREFIX}${t.id}`,
            label: `Show ${t.name} Panel`,
            type: "checkbox",
            checked: t.visible,
            enabled: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                const panelId = mi.id.substring(TOOL_PREFIX.length);
                mainStore.dispatch(changeToolVisibilityAction(panelId, mi.checked))
            }
        }
    });

    // --- Prepare the view menu
    const viewSubMenu: MenuItemConstructorOptions[] = [
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        {
            id: TOGGLE_DEVTOOLS,
            label: "Toggle Developer Tools",
            accelerator: "Ctrl+Shift+I",
            click: () => {
                BrowserWindow.getFocusedWindow().webContents.toggleDevTools();
            },
        },
        { type: "separator" },
        {
            id: THEMES,
            label: "Themes",
            submenu: [
                {
                    id: LIGHT_THEME,
                    label: "Light",
                    type: "checkbox",
                    checked: appState.theme === "light",
                    click: () => {
                        mainStore.dispatch(setThemeAction("light"));
                    },
                },
                {
                    id: DARK_THEME,
                    label: "Dark",
                    type: "checkbox",
                    checked: appState.theme === "dark",
                    click: () => {
                        mainStore.dispatch(setThemeAction("dark"));
                    },
                },
            ]
        },
        { type: "separator" },
        {
            id: TOGGLE_TOOLBAR,
            label: "Show the Toolbar",
            type: "checkbox",
            checked: appState.emuViewOptions.showToolbar,
            click: (mi) => {
                mainStore.dispatch(showToolbarAction(mi.checked));
            },
        },
        {
            id: TOGGLE_STATUS_BAR,
            label: "Show the Status Bar",
            type: "checkbox",
            checked: appState.emuViewOptions.showStatusBar,
            click: (mi) => {
                mainStore.dispatch(showStatusBarAction(mi.checked));
            },
        },
        { type: "separator" },
        {
            id: SET_EMULATOR_VIEW,
            label: "Use the Emulator view",
            type: "checkbox",
            checked: appState.emuViewOptions.useEmuView,
            click: (mi) => {
                mi.checked = true;
                Menu.getApplicationMenu().getMenuItemById(SET_IDE_VIEW).checked = false;
                mainStore.dispatch(useEmuViewAction(true));
            },
        },
        {
            id: SET_IDE_VIEW,
            label: "Use the IDE view",
            type: "checkbox",
            checked: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                mi.checked = true;
                Menu.getApplicationMenu().getMenuItemById(SET_EMULATOR_VIEW).checked = false;
                mainStore.dispatch(useEmuViewAction(false));
            },
        },
        { type: "separator" },
        {
            id: TOGGLE_SIDE_BAR,
            label: "Show the Side Bar",
            type: "checkbox",
            checked: appState.emuViewOptions.showStatusBar,
            enabled: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                mainStore.dispatch(showSideBarAction(mi.checked));
            },
        },
        {
            id: TOGGLE_PRIMARY_BAR_RIGHT,
            label: "Move Primary Side Bar Right",
            type: "checkbox",
            checked: appState.emuViewOptions.primaryBarOnRight,
            enabled: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                mainStore.dispatch(primaryBarOnRightAction(mi.checked));
            },
        },
        {
            id: TOGGLE_TOOL_PANELS,
            label: "Show Tool Panels",
            type: "checkbox",
            checked: appState.emuViewOptions.showToolPanels,
            enabled: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                const checked = mi.checked;
                mainStore.dispatch(showToolPanelsAction(checked));
                if (checked) {
                    mainStore.dispatch(maximizeToolsAction(false));
                }
            },
        },
        {
            id: TOGGLE_TOOLS_TOP,
            label: "Move Tool Panels Top",
            type: "checkbox",
            checked: appState.emuViewOptions.toolPanelsOnTop,
            enabled: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                mainStore.dispatch(toolPanelsOnTopAction(mi.checked));
            },
        },
        {
            id: MAXIMIZE_TOOLS,
            label: "Maximize Tool Panels",
            type: "checkbox",
            checked: appState.emuViewOptions.maximizeTools,
            enabled: !appState.emuViewOptions.useEmuView,
            click: (mi) => {
                const checked = mi.checked;
                if (checked) {
                    mainStore.dispatch(showToolPanelsAction(true));
                }
                mainStore.dispatch(maximizeToolsAction(checked));
            },
        },
        { type: "separator" },
        ...toolMenus
    ];

    template.push({
        label: "View",
        submenu: viewSubMenu,
    });

    // --- Prepare the machine menu

    template.push({
        label: "Machine",
        submenu: [
            {
                id: MACHINE_TYPES,
                label: "Machine type",
                submenu: [
                    {
                        id: MACHINE_SP48,
                        label: "ZX Spectrum 48K",
                        type: "checkbox",
                        checked: appState.ideView?.machineId === "sp48",
                        click: async () => {
                            await setMachineType("sp48");
                        },
                    },
                ]
            },
            { type: "separator"},
            {
                id: START_MACHINE,
                label: "Start",
                click: async () => {
                    await sendFromMainToEmu(createMachineCommand("start"));
                },
            },
            {
                id: PAUSE_MACHINE,
                label: "Pause",
                click: async () => {
                    console.log("Pause");
                },
            },
            {
                id: STOP_MACHINE,
                label: "Stop",
                click: async () => {
                    console.log("Stop");
                },
            },
            {
                id: RESTART_MACHINE,
                label: "Restart",
                click: async () => {
                    console.log("Restart");
                },
            },
            { type: "separator"},
            {
                id: DEBUG_MACHINE,
                label: "Start with Debugging",
                click: async () => {
                    console.log("Start with debugging");
                },
            },
            {
                id: STEP_INTO,
                label: "Step Into",
                click: async () => {
                    console.log("Step Into");
                },
            },
            {
                id: STEP_OVER,
                label: "Step Over",
                click: async () => {
                    console.log("Step Over");
                },
            },
            {
                id: STEP_OUT,
                label: "Step Out",
                click: async () => {
                    console.log("Step Out");
                },
            },

    ]
    })

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * Update the state of menu items whenver the app state changes.
 */
export function updateMenuState(): void {
    setupMenu();
    
    const appState = mainStore.getState();
    const getMenuItem = (id: string) => Menu.getApplicationMenu().getMenuItemById(id);

    // --- Disable IDE-related items in EMU mode
    const enableIdeMenus = !appState.emuViewOptions.useEmuView;
    getMenuItem(TOGGLE_PRIMARY_BAR_RIGHT).enabled = enableIdeMenus;
    getMenuItem(TOGGLE_PRIMARY_BAR_RIGHT).checked = appState.emuViewOptions.primaryBarOnRight;
    getMenuItem(TOGGLE_SIDE_BAR).enabled = enableIdeMenus;
    getMenuItem(TOGGLE_SIDE_BAR).checked = appState.emuViewOptions.showSidebar;
    getMenuItem(TOGGLE_TOOL_PANELS).enabled = enableIdeMenus;
    getMenuItem(TOGGLE_TOOL_PANELS).checked = appState.emuViewOptions.showToolPanels;
    getMenuItem(TOGGLE_TOOLS_TOP).enabled = enableIdeMenus;
    getMenuItem(TOGGLE_TOOLS_TOP).checked = appState.emuViewOptions.toolPanelsOnTop;
    getMenuItem(MAXIMIZE_TOOLS).enabled = enableIdeMenus;
    getMenuItem(MAXIMIZE_TOOLS).checked = appState.emuViewOptions.maximizeTools;
    getMenuItem(LIGHT_THEME).checked = appState.theme === "light";
    getMenuItem(DARK_THEME).checked = appState.theme === "dark";

    // --- Machine-related items
    const state = appState.ideView.machineState;
    getMenuItem(START_MACHINE).enabled = 
    getMenuItem(DEBUG_MACHINE).enabled = 
        state === MachineControllerState.None || 
        state === MachineControllerState.Paused || 
        state === MachineControllerState.Stopped;
    getMenuItem(PAUSE_MACHINE).enabled = state === MachineControllerState.Running;
    getMenuItem(STOP_MACHINE).enabled = 
    getMenuItem(RESTART_MACHINE).enabled =
        state === MachineControllerState.Running || 
        state === MachineControllerState.Paused;
    getMenuItem(STEP_INTO).enabled = 
    getMenuItem(STEP_OVER).enabled = 
    getMenuItem(STEP_OUT).enabled = 
        state === MachineControllerState.Paused;
}
