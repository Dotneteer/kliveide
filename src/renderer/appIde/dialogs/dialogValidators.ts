import type { IValidationService } from "@renderer/core/ValidationService";

export type FieldValidator = (value: string) => string | undefined;

export function requiredFilename(validationService: IValidationService, value: string): string | undefined {
  if (!value.trim()) return "Enter a file name.";
  return validationService.isValidFilename(value) ? undefined : "Enter a valid file name.";
}

export function requiredPath(validationService: IValidationService, value: string): string | undefined {
  if (!value.trim()) return "Choose a folder.";
  return validationService.isValidPath(value, false) ? undefined : "Enter a valid folder path.";
}

export function optionalPath(validationService: IValidationService, value: string): string | undefined {
  return validationService.isValidPath(value, true) ? undefined : "Enter a valid path.";
}

export function newItemName(
  validationService: IValidationService,
  existingNames: string[],
  value: string
): string | undefined {
  const filenameError = requiredFilename(validationService, value);
  if (filenameError) return filenameError;
  return existingNames.includes(value) ? "An item with this name already exists." : undefined;
}

export function renamedItemName(
  validationService: IValidationService,
  oldName: string,
  value: string
): string | undefined {
  if (value === oldName) return "Enter a different name.";
  return requiredFilename(validationService, value);
}

export function decimalAddress(value: string): string | undefined {
  return !value.trim() || /^\d+$/.test(value) ? undefined : "Enter a decimal address.";
}
