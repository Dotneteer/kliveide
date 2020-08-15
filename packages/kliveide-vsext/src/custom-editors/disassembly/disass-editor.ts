import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

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
import { DisassemblyAnnotation } from "../../disassembler/annotations";
import {
  spectrumConfigurationInstance,
  DISASS_ANN_FILE,
} from "../../emulator/machine-config";

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

    // --- Get the annotation for the view
    const annotations = this.getAnnotation();
    if (annotations) {
      webviewPanel.webview.postMessage({
        viewNotification: "annotations",
        annotations: annotations.serialize(),
      });
    }

    // --- Watch for breakpoint changes
    this.toDispose(
      webviewPanel,
      onBreakpointsChanged((breakpoints: number[]) => {
        webviewPanel.webview.postMessage({
          viewNotification: "breakpoints",
          breakpoints,
        });
      })
    );

    // --- Watch for PC changes
    let lastPc = -1;
    this.toDispose(
      webviewPanel,
      onFrameInfoChanged((fi: FrameInfo) => {
        if (lastPc !== fi.pc && fi.pc !== undefined) {
          lastPc = fi.pc;
          webviewPanel.webview.postMessage({
            viewNotification: "pc",
            pc: lastPc,
          });
        }
      })
    );

    // --- Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      super.disposePanel(webviewPanel);
    });
  }

  /**
   * Process view command
   * @param panel The WebviewPanel that should process a message from its view
   * @param viewCommand Command notification to process
   */
  processViewCommand(
    panel: vscode.WebviewPanel,
    viewCommand: ViewCommand
  ): void {
    switch (viewCommand.command) {
      case "refresh":
        // --- Send breakpoint info to the view
        this.sendExecutionStateToView(panel);
        this.sendBreakpointsToView(panel);
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
  protected sendBreakpointsToView(panel: vscode.WebviewPanel): void {
    panel.webview.postMessage({
      viewNotification: "breakpoints",
      breakpoints: getLastBreakpoints(),
    });
  }

  /**
   * Gets the annotation for the current machine
   * @param rom Optional ROM page
   * @param bank Optional RAM bank
   */
  getAnnotation(rom?: number, bank?: number): DisassemblyAnnotation | null {
    // --- Let's assume on open project folder
    const folders = vscode.workspace.workspaceFolders;
    const projFolder = folders ? folders[0].uri.fsPath : null;
    if (!projFolder) {
      return null;
    }

    rom = rom ?? 0;
    try {
      // --- Obtain the file for the annotations
      let romAnnotationFile =
        spectrumConfigurationInstance.configuration.annotations[rom];
      if (romAnnotationFile.startsWith("#")) {
        romAnnotationFile = this.getAssetsFileName(
          path.join("annotations", romAnnotationFile.substr(1))
        );
      } else {
        romAnnotationFile = path.join(projFolder, romAnnotationFile);
      }

      // --- Get root annotations from the file
      const contents = fs.readFileSync(romAnnotationFile, "utf8");
      const annotation = DisassemblyAnnotation.deserialize(contents);

      // --- Get view annotation
      const viewFilePath = path.join(projFolder, DISASS_ANN_FILE);
      const viewContents = fs.readFileSync(viewFilePath, "utf8");
      const viewAnnotation = DisassemblyAnnotation.deserialize(viewContents);
      if (annotation && viewAnnotation) {
        annotation.merge(viewAnnotation);
      }
      return annotation;
    } catch (err) {
      console.log(err);
    }
    return null;
  }
}
