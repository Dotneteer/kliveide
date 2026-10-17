import { t, translator } from "@common/i18n/i18n";
import { SOURCE_CATALOG } from "@common/i18n/catalogs";
/**
 * The common root error class
 */
export class ParserError extends Error {
  constructor (message: string, public code?: string) {
    super(message);

    // --- Set the prototype explicitly.
    Object.setPrototypeOf(this, ParserError.prototype);
  }
}

/**
 * Represents a parser error message
 */
export interface ParserErrorMessage {
  code: ErrorCodes;
  text: string;
  position: number;
  line: number;
  column: number;
}

/**
 * Represents a parser error codes
 */
export type ErrorCodes =
  | "K001"
  | "K002"
  | "K003"
  | "K004"
  | "K005"
  | "K006"
  | "K007"
  | "K008"
  | "K009"
  | "K010"
  | "K011"
  | "K012"
  | "K013"
  | "K014"
  | "K015"
  | "K016"
  | "K017"
  | "K018"
  | "K019"
  | "K020"
  | "K021"
  | "K022"
  | "K023"
  | "K024"
  | "K025"
  | "K026"
  | "K027";

/**
 * The text of a KSX parser error, in the display language (`.plans/LOCALIZATION_PLAN.md` step 13):
 * `compiler.ksx.<code>` in `src/common/i18n/locales/en/compiler.json`, with `{0}`, `{1}`... filled
 * from `params` in order.
 */
// i18n-dynamic: compiler.ksx.
export function ksxErrorMessage(code: ErrorCodes, params?: readonly unknown[]): string {
  const key = `compiler.ksx.${code}`;
  if (SOURCE_CATALOG[key] === undefined) return t("compiler.asm.unknownError");
  const args: Record<string, string> = {};
  (params ?? []).forEach((p, i) => (args[String(i)] = String(p)));
  return translator.t(key, args);
}
