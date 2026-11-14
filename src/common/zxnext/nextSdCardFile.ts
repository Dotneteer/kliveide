/*
 * A file read from the ZX Spectrum Next's current SD card (`src/main/next-sd-card-file.ts`): what the
 * main process sends the renderer. Errors are codes; the renderer words them.
 */
export type NextSdCardFileResult = {
  /** The card image read (full path) */
  card: string;
  contents?: Uint8Array;
  /** `noCard`: the image file is missing; `notFound`: the card has no such file; `unreadable`: anything else */
  error?: "noCard" | "notFound" | "unreadable";
  /** The reason, for `unreadable` (the disk code's own English message) */
  message?: string;
};
