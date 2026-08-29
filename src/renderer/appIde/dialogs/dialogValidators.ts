import type { IValidationService } from "@renderer/core/ValidationService";

export type FieldValidator = (value: string | null | undefined) => string | undefined;

export function requiredFilename(
  validationService: IValidationService,
  value: string | null | undefined
): string | undefined {
  const normalizedValue = (value ?? "").trim();
  if (!normalizedValue.trim()) return "Enter a file name.";
  return validationService.isValidFilename(normalizedValue) ? undefined : "Enter a valid file name.";
}

export function requiredPath(
  validationService: IValidationService,
  value: string | null | undefined
): string | undefined {
  const normalizedValue = (value ?? "").trim();
  if (!normalizedValue.trim()) return "Choose a folder.";
  return validationService.isValidPath(normalizedValue, false) ? undefined : "Enter a valid folder path.";
}

export function optionalPath(
  validationService: IValidationService,
  value: string | null | undefined
): string | undefined {
  return validationService.isValidPath((value ?? "").trim(), true) ? undefined : "Enter a valid path.";
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

export function decimalAddress(value: string | null | undefined): string | undefined {
  const normalizedValue = (value ?? "").trim();
  return !normalizedValue.trim() || /^\d+$/.test(normalizedValue) ? undefined : "Enter a decimal address.";
}
