import { IOutputBuffer, OutputColor } from "@renderer/appIde/ToolArea/abstractions";

/**
 * Describes a console action that can be displayed in the output pane
 */
export type ConsoleAction = {
  type: string;
  payload: any;
};

/**
 * Displays a navigation action to the specified project file
 * @param output Output to display the messages is
 * @param file Filename
 * @param line Optional line number
 * @param column Optional column number
 */
export function outputNavigateAction(
  output: IOutputBuffer,
  file: string,
  line?: number,
  column?: number
): void {
  output.write(
    `${file}${line != undefined ? ` (${line}:${column + 1})` : ""}`,
    {
      type: "@navigate",
      payload: { file, line, column }
    },
    true
  );
}

/**
 * Writes an error/warning message to the output buffer, converting any
 * embedded `path:line:column` references into clickable navigation links.
 * The remaining text is written with the buffer's current style. The caller
 * is responsible for setting (and later resetting) the message colour.
 *
 * Recognised reference formats:
 *   - `<path>:<line>:<col>`  (zero-based column, as produced by the Klive
 *     compiler when it embeds invocation locations into error messages)
 *   - `<path>(<line>:<col>)` (already-rendered location, as produced by
 *     `outputNavigateAction`)
 */
export function writeErrorMessageWithLinks(
  output: IOutputBuffer,
  message: string,
  textColor?: OutputColor,
  linkColor: OutputColor = "bright-cyan"
): void {
  // --- Match either "path:line:col" or "path (line:col)".
  // --- The filename portion is matched non-greedily so the regex stops at
  // --- the first valid coordinate suffix.
  const re = /(\S+?)(?::(\d+):(\d+)|\s\((\d+):(\d+)\))/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    if (m.index > lastIndex) {
      output.write(message.substring(lastIndex, m.index));
    }
    const file = m[1];
    const line = parseInt(m[2] ?? m[4], 10);
    const colRaw = parseInt(m[3] ?? m[5], 10);
    // --- Monaco setPosition uses 1-based columns (the nav pipeline nets zero:
    // --- ConsoleOutput adds +1 and NavigateToDocumentCommand subtracts -1).
    // --- The "path:line:col" form stores the 0-based startColumn from the
    // --- lexer, so we add 1 to get the 1-based Monaco column.
    // --- The "path (line:col)" form was already rendered by outputNavigateAction
    // --- as `column + 1` (1-based), so we keep it as-is.
    const column = m[3] !== undefined ? colRaw + 1 : colRaw;
    if (linkColor) output.color(linkColor);
    output.write(m[0], { type: "@navigate", payload: { file, line, column } }, true);
    if (textColor) output.color(textColor);
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < message.length) {
    output.write(message.substring(lastIndex));
  }
}
