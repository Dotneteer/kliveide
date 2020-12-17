import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  onExecutionStateChanged,
  onConnectionStateChanged,
  getLastConnectedState,
  getLastExecutionState,
  onMemoryPagingChanged,
  onMachineTypeChanged,
  getLastMachineType,
} from "../emulator/notifier";
import { RendererMessage } from "./messaging/message-types";
import { MessageProcessor } from "../emulator/message-processor";
import { ExecutionState, MemoryPageInfo } from "../emulator/communicator";
import { machineTypes } from "../emulator/machine-info";
import { getAssetsFileName } from "../extension-paths";

const editorInstances: vscode.WebviewPanel[] = [];
let activeEditor: vscode.WebviewPanel | null = null;

/**
 * Retrieves all registered editor providers
 */
export function getRegisteredEditors(): vscode.WebviewPanel[] {
  return editorInstances;
}

/**
 * Gets the active editor
 */
export function getActiveEditor(): vscode.WebviewPanel | null {
  return activeEditor;
}

/**
 *  * Base class for all custom editors
 */
export abstract class EditorProviderBase
  implements vscode.CustomTextEditorProvider {
  private _disposables = new Map<vscode.WebviewPanel, vscode.Disposable[]>();

  private _panel: vscode.WebviewPanel | null;
  private _displayed = false;

  /**
   * The title of the webview
   */
  abstract readonly title: string;

  /**
   * The name of the html file that is to be used as a template for
   * the contents of the view
   */
  abstract readonly htmlFileName: string;

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [];
  }

  /**
   * Instantiates the editor provider
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) {}

  /**
   * Gets the host WebViewPanel of this editor
   */
  get panel(): vscode.WebviewPanel {
    if (this._panel) {
      return this._panel;
    }
    throw new Error("WebViewPanel nos set.");
  }

  /**
   * Disposes resources held by a particular WebviewPanel
   * @param panel WebviewPanel to dispose its resorces
   */
  disposePanel(panel: vscode.WebviewPanel): void {
    // --- Remove this editor from the other instances
    const editorIndex = editorInstances.indexOf(panel);
    if (editorIndex >= 0) {
      editorInstances.splice(editorIndex, 1);
    }
    if (activeEditor === panel) {
      activeEditor = null;
    }

    // --- Hanlde disposables
    const disposables = this._disposables.get(panel);
    if (disposables) {
      disposables.forEach((d) => d.dispose());
    }
  }

  /**
   * Registers a disposable with the specified WebviewPanel
   * @param panel WebviewPanel that holds the disposables
   * @param disposable
   */
  toDispose(panel: vscode.WebviewPanel, disposable: vscode.Disposable): void {
    const disposables = this._disposables.get(panel);
    if (!disposables) {
      this._disposables.set(panel, [disposable]);
    } else {
      disposables.push(disposable);
    }
  }

  /**
   * Resolve a custom editor for a given text resource.
   *
   * @param _document Document for the resource to resolve.
   * @param webviewPanel The webview panel used to display the editor UI for this resource.
   * @param token A cancellation token that indicates the result is no longer needed.
   * @return Thenable indicating that the custom editor has been resolved.
   */
  async resolveCustomTextEditor(
    _document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // --- Store the instance
    editorInstances.push(webviewPanel);
    activeEditor = webviewPanel;

    // --- Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlContents(webviewPanel.webview);
    this._displayed = webviewPanel.visible;
    this._panel = webviewPanel;

    // --- Notify about visibility changes
    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.visible !== this._displayed) {
        this._displayed = e.webviewPanel.visible;
        if (this._displayed) {
          this.onShow();
        } else {
          this.onHidden();
        }
      }
    });

    // --- Keep track of the active editor
    this.toDispose(
      webviewPanel,
      webviewPanel.onDidChangeViewState((ev) => {
        if (ev.webviewPanel.active) {
          activeEditor = ev.webviewPanel;
        }
      })
    );

    // --- Notify the view about vm execution state changes
    this.toDispose(
      webviewPanel,
      onExecutionStateChanged((execState: ExecutionState) => {
        webviewPanel.webview.postMessage({
          viewNotification: "execState",
          state: execState.state,
          pc: execState.pc,
          runsInDebug: execState.runsInDebug,
        });
      })
    );

    // --- Notify the view about memory paging changes
    this.toDispose(
      webviewPanel,
      onMemoryPagingChanged((pageInfo: MemoryPageInfo) => {
        webviewPanel.webview.postMessage({
          viewNotification: "memoryPaging",
          selectedRom: pageInfo.selectedRom,
          selectedBank: pageInfo.selectedBank,
        });
      })
    );

    // --- Notify the view about emulator connection state changes
    this.toDispose(
      webviewPanel,
      onConnectionStateChanged((state: boolean) => {
        webviewPanel.webview.postMessage({
          viewNotification: "connectionState",
          state,
        });
      })
    );

    // --- Send machine information to the view when machine type changes
    this.toDispose(
      webviewPanel,
      onMachineTypeChanged((type) => {
        webviewPanel.webview.postMessage({
          viewNotification: "machineType",
          type,
          config: machineTypes[type],
        });
      })
    );

    // --- Receive message from the webview
    webviewPanel.webview.onDidReceiveMessage(
      async (e: ViewCommand | RendererMessage) => {
        if ((e as ViewCommand).command !== undefined) {
          await this.processViewCommand(e as ViewCommand);
        } else {
          new MessageProcessor(webviewPanel.webview).processMessage(
            e as RendererMessage
          );
        }
      }
    );

    // --- Get the initial state
    // await this.sendInitialStateToView(webviewPanel);
  }

  /**
   * Process view command
   * @param _viewCommand Command notification to process
   */
  async processViewCommand(
    _viewCommand: ViewCommand
  ): Promise<void> {}

  /**
   * Gets the HTML contents belonging to this editor
   * @param webView The webview to get this HTML for
   */
  getHtmlContents(webView: vscode.Webview): string {
    // --- Read the HTML resource file
    let htmlContents: string;
    try {
      htmlContents = fs.readFileSync(
        getAssetsFileName(this.htmlFileName),
        "utf8"
      );

      // --- Prepare replacements
      const reps = this.getContentReplacements();
      reps.push(["cspSource", webView.cspSource], ["nonce", getNonce()]);

      // --- Replace the contents
      for (const replEntry of reps) {
        htmlContents = htmlContents
          .split(`$$$${replEntry[0]}$$$`)
          .join(replEntry[1].toString());
      }
    } catch (err) {
      htmlContents = `<p>Error loading HTML resource ${this.htmlFileName}: ${err}</p>`;
    }
    return htmlContents;
  }

  /**
   * Sends the current execution state to view
   */
  protected sendInitialStateToView(): void {
    if (!getLastConnectedState()) {
      this.panel.webview.postMessage({
        viewNotification: "connectionState",
        state: false,
      });
    }
    const machineType = getLastMachineType();
    if (machineType) {
      this.panel.webview.postMessage({
        viewNotification: "machineType",
        type: machineType,
        config: machineTypes[machineType],
      });
    }
    // const pageInfo = getLastMemoryPagingInfo();
    // if (pageInfo) {
    //   this.panel.webview.postMessage({
    //     viewNotification: "memoryPaging",
    //     selectedRom: pageInfo.selectedRom,
    //     selectedBank: pageInfo.selectedBank,
    //   });
    // }
    const execState = getLastExecutionState();
    this.panel.webview.postMessage({
      viewNotification: "execState",
      state: execState.state,
      pc: execState.pc,
    });
  }

  /**
   * Override this method to handle the event when the webview
   * is displayed
   */
  protected onShow(): void {}

  /**
   * Override this method to handle the event when the webview
   * gets hidden
   */
  protected onHidden(): void {}
}

/**
 * Create a nonce we can use in web views
 */
function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Instructs the view of the WebviewPanel to go to the specified address
 * @param panel WebviewPanel to notify
 * @param address Address to scroll to
 */
export function postGoToAddressMessage(
  panel: vscode.WebviewPanel,
  address: number
): void {
  panel.webview.postMessage({
    viewNotification: "goToAddress",
    address,
  });
}

/**
 * Instructs the view of the WebviewPanel to refresh the view
 * @param panel WebviewPanel to notify
 */
export function postRefreshViewMessage(panel: vscode.WebviewPanel): void {
  panel.webview.postMessage({
    viewNotification: "refreshView",
  });
}

/**
 * This type defines a replacement tuple
 */
export type ReplacementTuple = [string, string | vscode.Uri];

/**
 * Reprensents notifications sent from the web view to its UI
 */
export interface ViewCommand {
  readonly command: string;
  readonly data?: any
}
