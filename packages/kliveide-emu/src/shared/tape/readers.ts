import { BinaryReader } from "../utils/BinaryReader";
import { TzxReader } from "./tzx-file";
import { TapReader } from "./tap-file";

/**
 * Tests if the specified binary stream is a valid tape file
 * @param reader Reader to use
 */
export function checkTapeFile(reader: BinaryReader): boolean {
  const tzxReader = new TzxReader(reader);
  if (tzxReader.readContents()) {
    return true;
  }

  reader.seek(0);
  const tapReader = new TapReader(reader);
  if (tapReader.readContents()) {
    return true;
  }
  return false;
}
