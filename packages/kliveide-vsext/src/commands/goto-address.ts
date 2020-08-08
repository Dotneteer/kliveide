import * as vscode from "vscode";

/**
 *
 * @param context Goes to the specified location
 */
export async function goToAddress(context: vscode.ExtensionContext
): Promise<void> {
  vscode.window.showInformationMessage(
    `Go to location`
  );
}
