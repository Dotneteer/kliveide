import { ProjectNodeWithChildren } from "@/appIde/project/project-node";
import { MessageBase } from "./messages-core";

/**
 * The client sends a text file read request
 */
export interface MainReadTextFileRequest extends MessageBase {
  type: "MainReadTextFile";
  path: string;
  encoding?: string;
}

/**
 * The client sends a binary file read request
 */
export interface MainReadBinaryFileRequest extends MessageBase {
  type: "MainReadBinaryFile";
  path: string;
}

/**
 * The client sends an error message to display
 */
export interface MainDisplayMessageBoxRequest extends MessageBase {
  type: "MainDisplayMessageBox";
  messageType?: "none" | "info" | "error" | "question" | "warning";
  title?: string;
  message?: string;
}

/**
 * The client wants to get the contents of a directory
 */
export interface MainGetDirectoryContent extends MessageBase {
  type: "MainGetDirectoryContent";
  directory: string;
}

/**
 * The client wants to create a new Klive project
 */
export interface MainOpenFolder extends MessageBase {
  type: "MainOpenFolder";
  folder?: string;
}

/**
 * The client wants to create a new Klive project
 */
export interface MainCreateKliveProject extends MessageBase {
  type: "MainCreateKliveProject";
  machineId: string;
  projectName: string;
  projectFolder?: string;
}

/**
 * The client wants to delete a file entry
 */
export interface MainDeleteFileEntry extends MessageBase {
  type: "MainDeleteFileEntry";
  name: string;
}

/**
 * The client wants to delete a file entry
 */
export interface MainAddNewFile extends MessageBase {
  type: "MainAddNewFile";
  folder?: string;
  name: string;
}

/**
 * The client wants to delete a file entry
 */
export interface MainAddNewFolder extends MessageBase {
  type: "MainAddNewFolder";
  folder?: string;
  name: string;
}

/**
 * The client wants to delete a file entry
 */
export interface MainRenameFileEntry extends MessageBase {
  type: "MainRenameFileEntry";
  oldName: string;
  newName: string;
}

/**
 * Response for text file read action
 */
export interface TextContentsResponse extends MessageBase {
  type: "TextContents";
  contents: string;
}

/**
 * Response for binary file read action
 */
export interface BinaryContentsResponse extends MessageBase {
  type: "BinaryContents";
  contents: Uint8Array;
}

/**
 * The client wants to get the contents of a directory
 */
export interface MainGetDirectoryContentResponse extends MessageBase {
  type: "MainGetDirectoryContentResponse";
  contents: ProjectNodeWithChildren;
}

/**
 * The client wants to create a new Klive project
 */
export interface MainCreateKliveProjectResponse extends MessageBase {
  type: "MainCreateKliveProjectResponse";
  path?: string;
  errorMessage?: string;
}

export function textContentsResponse (contents: string): TextContentsResponse {
  return {
    type: "TextContents",
    contents
  };
}

export function binaryContentsResponse (
  contents: Uint8Array
): BinaryContentsResponse {
  return {
    type: "BinaryContents",
    contents
  };
}
