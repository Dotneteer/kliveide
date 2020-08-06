import * as vscode from "vscode";
import { EditorProviderBase, ReplacementTuple } from "../editor-base";

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
}
