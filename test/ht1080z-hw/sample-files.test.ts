import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHtSession, Ht1080zTestSession } from "../harness/ht1080z";

/*
 * Real software from the HT-1080Z archive at ht.homeserver.hu (`test/testfiles/ht1080z/README.md`)
 * loads and starts on the core, through the same tape-load flow as Load and Run: SYSTEM for the
 * machine code, CLOAD and RUN for BASIC.
 */
const DIR = join(__dirname, "../testfiles/ht1080z");

async function run(name: string, frames = 200): Promise<string> {
  const s = await createHtSession();
  s.loadTape(Ht1080zTestSession.tape(new Uint8Array(readFileSync(join(DIR, name))), name), { maxFrames: 20000 });
  s.runFrames(frames);
  return s.screenText().join("\n");
}

describe("HT-1080Z sample files on the machine", () => {
  it("GALAXY loads and shows its title screen", async () => {
    const screen = await run("galaxy.cas");
    expect(screen).toContain("Big Five Software Co.");
    expect(screen).toContain("Press <ENTER> for instructions, <CLEAR> to start game");
  });

  it("the GALAXY loader shows the instructions", async () => {
    const screen = await run("galaxyld.cas");
    expect(screen).toContain("** Galaxy Invasion **");
    expect(screen).toContain("Press <CLEAR> to start game");
  });

  it("a BASIC tape loads and runs", async () => {
    expect(await run("amoeba.cas")).toContain("ELSO JATEKOS JELE?");
  });

  it("a .cmd loads and starts at its transfer address", async () => {
    const screen = (await run("auto1.cmd")).split("\n");
    expect(screen[0]).toContain("[[[[[");
  });
});
