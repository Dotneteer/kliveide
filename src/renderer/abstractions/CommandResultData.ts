import { IOutputBuffer, OutputContentLine } from "@appIde/ToolArea/abstractions";

/**
 * Represents the data passed to a command result documents
 */
export type CommandResultData = {
  title: string;
  buffer: IOutputBuffer
};
