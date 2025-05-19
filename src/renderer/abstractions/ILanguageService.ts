import { ILiteEvent } from "@abstractions/ILiteEvent";
import { IAssemblerErrorInfo } from "@main/z80-compiler/assembler-types";

/**
 * This interface defines the methods used by language services
 */
export interface ILanguageService {
  /**
   * Checks if the background compilation is in progress
   **/
  isBackgroundCompilationInProgress: () => boolean;

  /**
   * Starts the background compilation process
   **/
  startBackgroundCompilation: () => void;

  /**
   * This event is called when the background compilation process is completed
   */
  compilationCompleted: ILiteEvent<CompilationCompleted>;
}

export type CompilationCompleted = {
  success: boolean;
  timeout: boolean;
  errors: IAssemblerErrorInfo[];
};
