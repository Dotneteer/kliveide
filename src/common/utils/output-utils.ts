import { IOutputBuffer } from "../abstractions/OutputBuffer";

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
