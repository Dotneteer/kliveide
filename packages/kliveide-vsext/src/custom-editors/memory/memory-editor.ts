import * as vscode from "vscode";

import {
  EditorProviderBase,
  ReplacementTuple,
  ViewCommand,
} from "../editor-base";
import { onFrameInfoChanged } from "../../emulator/notifier";
import { communicatorInstance } from "../../emulator/communicator";
import { getAssetsFileResource } from "../../extension-paths";
import { onCodeInjected } from "../../commands/code-related";

export class MemoryEditorProvider extends EditorProviderBase {
  private static readonly viewType = "kliveide.memoryEditor";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MemoryEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      MemoryEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  // --- Signs that the view has been initialized
  private _viewInitialized = false;

  // --- Store the latest top position
  private _lastTopPosition: number = 0;

  /**
   * Instantiates an editor provider
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) {
    super(context);
  }

  title = "Klive Memory Editor";
  htmlFileName = "memory.html";

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [
      ["stylefile", getAssetsFileResource("style.css")],
      ["jsfile", getAssetsFileResource("memory.bundle.js")],
    ];
  }

  /**
   * Resolve a custom editor for a given text resource.
   *
   * @param document Document for the resource to resolve.
   * @param webviewPanel The webview panel used to display the editor UI for this resource.
   * @param token A cancellation token that indicates the result is no longer needed.
   * @return Thenable indicating that the custom editor has been resolved.
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    super.resolveCustomTextEditor(document, webviewPanel, _token);

    const editor = this;
    let refreshCounter = 0;
    let refreshing = false;

    this.toDispose(
      webviewPanel,
      onFrameInfoChanged(async () => {
        refreshCounter++;
        if (refreshCounter % 10 === 0) {
          refresh();
        }
      })
    );

    this.toDispose(
      webviewPanel,
      onCodeInjected(async () => refresh())
    );

    // --- Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      super.disposePanel(webviewPanel);
    });

    webviewPanel.onDidChangeViewState((state) => {
      if (!state.webviewPanel.active) {
        this._viewInitialized = false;
      }
    });

    /**
     * Refresh the current view port
     */
    function refresh(): void {
      try {
        if (!refreshing) {
          refreshing = true;
          editor.refreshViewPort();
        }
      } finally {
        refreshing = false;
      }
    }
  }

  /**
   * Process view command
   * @param panel The WebviewPanel that should process a message from its view
   * @param viewCommand Command notification to process
   */
  async processViewCommand(viewCommand: ViewCommand): Promise<void> {
    switch (viewCommand.command) {
      case "refresh":
        // --- Send breakpoint info to the view
        this.sendInitialStateToView();
        await this.refreshViewPort(-1);
        this.panel.webview.postMessage({
          viewNotification: "goToAddress",
          address: this._lastTopPosition,
        });
        this._viewInitialized = true;
        break;

      case "changeView":
        if (this._viewInitialized) {
          await this.refreshViewPort(0);
        }
        break;

      case "topPosition":
        this._lastTopPosition = viewCommand.data ?? 0;
        break;
    }
  }

  /**
   * Refresh the viewport of the specified panel
   * @param panel Panel to refresh
   */
  async refreshViewPort(itemIndex?: number): Promise<void> {
    try {
      const memory = await communicatorInstance.getMemory();
      const machineState = await communicatorInstance.getMachineState();
      this.panel.webview.postMessage({
        viewNotification: "machineState",
        machineState,
      });

      this.panel.webview.postMessage({
        viewNotification: "refreshViewport",
        itemIndex,
        memory,
      });
    } catch (err) {
      // --- This exception is intentionally ignored
    }
  }
}
