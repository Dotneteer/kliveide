import * as vscode from "vscode";
import { EditorProviderBase, ReplacementTuple } from "./editor-base";

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
      ["jsfile", this.getAssetsFileResource("disassembly.js")],
    ];
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // --- Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    //
    // Remember that a single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });

    // Receive message from the webview.
    webviewPanel.webview.onDidReceiveMessage((e) => {
      // TODO: Implement custom messages
    });

    updateWebview();

    /**
     * Updates the web view
     */
    function updateWebview() {
      webviewPanel.webview.postMessage({
        type: "update",
        text: document.getText(),
      });
    }
  }

  /**
   * Get the static html used for the editor webviews.
   */
  getHtmlForWebview(webview: vscode.Webview): string {
    return this.getHtmlContents(webview);
    // // --- Use a nonce to whitelist which scripts can be run
    // const nonce = getNonce();
    // return /* html */ `
    //         <!DOCTYPE html>
		// 	<html lang="en">
		// 	<head>
		// 		<meta charset="UTF-8">
		// 		<!--
		// 		Use a content security policy to only allow loading images from https or from our extension directory,
		// 		and only allow scripts that have a specific nonce.
		// 		-->
		// 		<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
		// 		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		// 		<title>Cat Scratch</title>
		// 	</head>
    //         <body>
    //             <h1>Disassembly Editor</h1>
		// 	</body>
		// 	</html>`;
  }
}
