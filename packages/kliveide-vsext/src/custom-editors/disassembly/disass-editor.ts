import * as vscode from "vscode";
import {
  EditorProviderBase,
  ReplacementTuple,
  ViewCommand,
} from "../editor-base";
import {
  onBreakpointsChanged,
  getLastBreakpoints,
  onFrameInfoChanged,
} from "../../emulator/notifier";
import { FrameInfo, communicatorInstance } from "../../emulator/communicator";

export class DisassemblyEditorProvider extends EditorProviderBase {
  private static readonly viewType = "kliveide.disassemblyEditor";

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DisassemblyEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      DisassemblyEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  /**
   * Instantiates an editor provider
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) {
    super(context);
  }

  title = "Klive Disassembly Editor";
  htmlFileName = "disassembly.html";

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [
      ["stylefile", this.getAssetsFileResource("style.css")],
      ["jsfile", this.getAssetsFileResource("disass.bundle.js")],
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

    // --- Watch for breakpoint changes
    const breakpointsDisposable = onBreakpointsChanged(
      (breakpoints: number[]) => {
        webviewPanel.webview.postMessage({
          viewNotification: "breakpoints",
          breakpoints,
        });
      }
    );

    // --- Watch for PC changes
    let lastPc = -1;
    const pcDisposable = onFrameInfoChanged((fi: FrameInfo) => {
      if (lastPc !== fi.pc && fi.pc !== undefined) {
        lastPc = fi.pc;
        webviewPanel.webview.postMessage({
          viewNotification: "pc",
          pc: lastPc,
        });
      }
    });

    // --- Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      breakpointsDisposable.dispose();
      pcDisposable.dispose();
    });

    // --- Send the current breakpoints to the view
    this.sendBreakpointsToView();
  }

  /**
   * Process view command
   * @param viewCommand Command notification to process
   */
  processViewCommand(viewCommand: ViewCommand): void {
    switch (viewCommand.command) {
      case "refresh":
        // --- Send breakpoint info to the view
        console.log("Refresh asked.")
        this.sendExecutionStateToView();
        this.sendBreakpointsToView();
        break;
      case "setBreakpoint":
        communicatorInstance.setBreakpoint((viewCommand as any).address);
        break;
      case "removeBreakpoint":
        communicatorInstance.removeBreakpoint((viewCommand as any).address);
        break;
    }
  }

  /**
   * Sends the current breakpoints to the webview
   */
  protected sendBreakpointsToView(): void {
    if (!this.webviewPanel) {
      return;
    }

    this.webviewPanel.webview.postMessage({
      viewNotification: "breakpoints",
      breakpoints: getLastBreakpoints(),
    });
  }
}
