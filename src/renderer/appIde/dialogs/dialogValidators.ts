import type { IValidationService } from "@renderer/core/ValidationService";
import { t } from "@common/i18n/i18n";

export type FieldValidator = (value: string | null | undefined) => string | undefined;

export function requiredFilename(
  validationService: IValidationService,
  value: string | null | undefined
): string | undefined {
  const normalizedValue = (value ?? "").trim();
  if (!normalizedValue.trim()) return t("dialog.validation.enterFileName");
  return validationService.isValidFilename(normalizedValue) ? undefined : t("dialog.validation.enterValidFileName");
}

export function requiredPath(
  validationService: IValidationService,
  value: string | null | undefined
): string | undefined {
  const normalizedValue = (value ?? "").trim();
  if (!normalizedValue.trim()) return t("dialog.validation.chooseFolder");
  return validationService.isValidPath(normalizedValue, false) ? undefined : t("dialog.validation.enterValidFolder");
}

export function optionalPath(
  validationService: IValidationService,
  value: string | null | undefined
): string | undefined {
  return validationService.isValidPath((value ?? "").trim(), true) ? undefined : t("dialog.validation.enterValidPath");
}

export function newItemName(
  validationService: IValidationService,
  existingNames: string[],
  value: string
): string | undefined {
  const filenameError = requiredFilename(validationService, value);
  if (filenameError) return filenameError;
  return existingNames.includes(value) ? t("dialog.validation.nameExists") : undefined;
}

export function renamedItemName(
  validationService: IValidationService,
  oldName: string,
  value: string
): string | undefined {
  if (value === oldName) return t("dialog.validation.enterDifferentName");
  return requiredFilename(validationService, value);
}

export function decimalAddress(value: string | null | undefined): string | undefined {
  const normalizedValue = (value ?? "").trim();
  return !normalizedValue.trim() || /^\d+$/.test(normalizedValue) ? undefined : t("dialog.validation.enterDecimalAddress");
}
