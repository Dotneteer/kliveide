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
    showToolPanelsAction} from "../common/state/actions";

const TOGGLE_DEVTOOLS = "toggle_devtools";
const TOGGLE_SIDE_BAR = "toggle_side_bar";
const TOGGLE_TOOLBAR = "toggle_toolbar";
const TOGGLE_PRIMARY_BAR_RIGHT = "primary_side_bar_right"
const TOGGLE_STATUS_BAR = "toggle_status_bar";
const SET_EMULATOR_VIEW = "set_emulator_view";
const SET_IDE_VIEW = "set_ide_view";
const TOGGLE_TOOL_PANELS = "toggle_tool_panels";

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu(): void {
    const template: (MenuItemConstructorOptions | MenuItem)[] = [];
    const appState = mainStore.getState();

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

    // --- Preapre the view menu
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
            click: (mi) => {
                mainStore.dispatch(showSideBarAction(mi.checked));
            },
        },
        {
            id: TOGGLE_PRIMARY_BAR_RIGHT,
            label: "Move Primary Side Bar Right",
            type: "checkbox",
            checked: appState.emuViewOptions.primaryBarOnRight,
            click: (mi) => {
                mainStore.dispatch(primaryBarOnRightAction(mi.checked));
            },
        },
        {
            id: TOGGLE_TOOL_PANELS,
            label: "Show Tool Panels",
            type: "checkbox",
            checked: appState.emuViewOptions.showToolPanels,
            click: (mi) => {
                mainStore.dispatch(showToolPanelsAction(mi.checked));
            },
        },
    ];

    template.push({
        label: "View",
        submenu: viewSubMenu,
    });

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}