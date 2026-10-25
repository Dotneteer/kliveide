/**
 * The ZX Spectrum ROM's error reports by ERR_NR (the report's number or letter, less one). They name
 * an error stop of any Spectrum language whose runtime raises ROM-numbered errors (a producer's
 * `errorStop.reports: "zx-rom"`), and the ROM's own error restart.
 */
const REPORTS = [
  "0 OK",
  "1 NEXT without FOR",
  "2 Variable not found",
  "3 Subscript wrong",
  "4 Out of memory",
  "5 Out of screen",
  "6 Number too big",
  "7 RETURN without GOSUB",
  "8 End of file",
  "9 STOP statement",
  "A Invalid argument",
  "B Integer out of range",
  "C Nonsense in BASIC",
  "D BREAK - CONT repeats",
  "E Out of DATA",
  "F Invalid file name",
  "G No room for line",
  "H STOP in INPUT",
  "I FOR without NEXT",
  "J Invalid I/O device",
  "K Invalid colour",
  "L BREAK into program",
  "M RAMTOP no good",
  "N Statement lost",
  "O Invalid stream",
  "P FN without DEF",
  "Q Parameter error",
  "R Tape loading error"
];

/** The ROM's report text for an ERR_NR code. */
export function zxRomReport(code: number): string {
  return REPORTS[code + 1] ?? `Error ${code}`;
}

/** An error's report from a report table: the ROM's, or a producer's own texts indexed by code. */
export function errorReport(reports: "zx-rom" | readonly string[] | undefined, code: number): string {
  if (reports === undefined || reports === "zx-rom") return zxRomReport(code);
  return reports[code] ?? `Error ${code}`;
}
