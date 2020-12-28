import * as vscode from "vscode";

import { CmdNode } from "../command-parser/command-line-nodes";
import { InputStream } from "../command-parser/input-stream";
import { KliveCommandParser } from "../command-parser/klive-command-parser";
import { TokenStream } from "../command-parser/token-stream";
import { handleKliveCommand } from "../emulator/command-handler";

/**
 * Goes to the specified view location
 */
export async function executeKliveCommand(): Promise<void> {
  // --- Ask for the command to execute
  const result = await vscode.window.showInputBox({
    value: "",
    prompt: "Type in a Klive command",
    placeHolder: "command text",
    validateInput: (text) => {
      const parser = new KliveCommandParser(
        new TokenStream(new InputStream(text))
      );
      let cmd: CmdNode | null;
      try {
        cmd = parser.parseCommand();
      } catch {
        // --- This error is intentionally ignored
      }
      if (parser.hasErrors) {
        return parser.error.text;
      }
      return null;
    },
  });

  // --- Go to the specified address
  if (result && result.trim()) {
    const parser = new KliveCommandParser(
      new TokenStream(new InputStream(result))
    );
    let cmd: CmdNode | null;
    try {
      cmd = parser.parseCommand();
    } catch {
      // --- This error is intentionally ignored
    }
    if (parser.hasErrors) {
      vscode.window.showErrorMessage(parser.error.text);
    }

    // --- Display the command text and handle it
    handleKliveCommand(result, cmd);
  }
}
