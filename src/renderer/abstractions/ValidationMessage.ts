import type { ValidationMessageType } from "./ValidationMessageType";

/**
 * Describes a trace message
 */
export type ValidationMessage = {
  type: ValidationMessageType;
  message: string;
};
