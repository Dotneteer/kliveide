import { 
    app, 
    BrowserWindow, 
    Menu, 
    MenuItem, 
    MenuItemConstructorOptions 
} from "electron";
import { __DARWIN__ } from "./electron-utils";
import { mainStore } from "./main-store";
import { emuShowToolbarAction } from "../common/state/actions";

const TOGGLE_DEVTOOLS = "toggle_devtools";
const TOGGLE_ACTIVITY_BAR = "toggle_activity_bar";
const TOGGLE_SIDE_BAR = "toggle_side_bar";
const TOGGLE_TOOLBAR = "toggle_toolbar";
const TOGGLE_STATUS_BAR = "toggle_status_bar";
const SET_EMULATOR_VIEW = "set_emulator_view";
const SET_IDE_VIEW = "set_ide_view";

/**
 * Creates and sets the main menu of the app
 */
export function setupMenu(): void {
    const template: (MenuItemConstructorOptions | MenuItem)[] = [];

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
            label: "Show toolbar",
            type: "checkbox",
            checked: false,
            click: (mi) => {
                mainStore.dispatch(emuShowToolbarAction(mi.checked));
            },
        },
        {
            id: TOGGLE_STATUS_BAR,
            label: "Show status bar",
            type: "checkbox",
            checked: false,
            click: (mi) => {
                // TODO
            },
        },
        { type: "separator" },
        {
            id: SET_EMULATOR_VIEW,
            label: "Set emulator view",
            click: (mi) => {
                // TODO
            },
        },
        {
            id: SET_IDE_VIEW,
            label: "Set IDE view",
            click: (mi) => {
                // TODO
            },
        },
        { type: "separator" },
    ];

    template.push({
        label: "View",
        submenu: viewSubMenu,
    });

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}