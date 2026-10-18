/**
 * The NEX file name of a ZX Spectrum Next run, debug or export (src/renderer/appIde/utils/nex-file-name.ts).
 *
 * A program without `.savenex file` used to reach the emulated SD card as `_klive/undefined`: the
 * run path named the exported host file `output.nex` but copied and loaded `nexConfig.filename`
 * as it was. Now the program's own name wins, and without one the project folder names the file.
 */
import { describe, expect, it } from "vitest";
import {
  defaultNexFileName,
  FALLBACK_NEX_FILE_NAME,
  nexFileNameOf,
  sdCardNexName
} from "@renderer/appIde/utils/nex-file-name";

describe("NEX file names", () => {
  it("keeps the program's own .savenex file name", () => {
    expect(nexFileNameOf("NextSprites.nex", "/Users/me/KliveProjects/Other")).toBe("NextSprites.nex");
  });

  it("names the file after the project folder when the program names none", () => {
    expect(nexFileNameOf(undefined, "/Users/me/KliveProjects/NextSprites")).toBe("NextSprites.nex");
    expect(nexFileNameOf("", "C:\\Users\\me\\KliveProjects\\Shooter\\")).toBe("Shooter.nex");
    expect(nexFileNameOf("   ", "/p/Demo")).toBe("Demo.nex");
  });

  it("replaces characters a NEX file name cannot hold", () => {
    expect(defaultNexFileName("/p/My Game (v2)")).toBe("My_Game__v2.nex");
    expect(defaultNexFileName("/p/Játék")).toBe("J_t_k.nex");
  });

  it("falls back to output.nex without a usable folder name", () => {
    expect(defaultNexFileName(undefined)).toBe(FALLBACK_NEX_FILE_NAME);
    expect(defaultNexFileName("/")).toBe(FALLBACK_NEX_FILE_NAME);
    expect(defaultNexFileName("/p/...")).toBe(FALLBACK_NEX_FILE_NAME);
    expect(nexFileNameOf(undefined, undefined)).toBe("output.nex");
  });

  it("never sends 'undefined' to the SD card", () => {
    expect(sdCardNexName(undefined, "/home/me/KliveExports/NextSprites.nex")).toBe("NextSprites.nex");
    expect(sdCardNexName("game.nex", "/home/me/KliveExports/exported.nex")).toBe("game.nex");
    expect(sdCardNexName(undefined, "C:\\KliveExports\\Shooter.nex")).toBe("Shooter.nex");
    expect(sdCardNexName(undefined, "")).toBe(FALLBACK_NEX_FILE_NAME);
    expect(sdCardNexName(undefined, "/x/y.nex")).not.toContain("undefined");
  });
});
