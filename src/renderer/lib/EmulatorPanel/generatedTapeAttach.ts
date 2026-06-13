import {
  uploadTapeToActiveSp48ControllerOrQueue,
  type Sp48TapeUploadResult
} from "../../../emu/sp48/sp48-session";
import { parseTapeFile } from "../../../emu/tape/tape-parser";

export type GeneratedTapeAttachResult = {
  fileName: string;
  format: "tap" | "tzx";
  blockCount: number;
  uploadResult: Sp48TapeUploadResult;
  warnings: string[];
};

export function attachGeneratedTapeFile(
  fileName: string,
  contents: Uint8Array
): GeneratedTapeAttachResult {
  const parsed = parseTapeFile(contents);
  const uploadResult = uploadTapeToActiveSp48ControllerOrQueue(parsed.blocks, fileName);
  return {
    fileName,
    format: parsed.format,
    blockCount: parsed.blocks.length,
    uploadResult,
    warnings: parsed.warnings
  };
}
