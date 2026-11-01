import type { ProfileEdge } from "@common/profile/profileTypes";
import { epProfileLayout } from "@common/profile/layouts/ep";
import { profileOffsetOf } from "@common/profile/layouts/profileLayout";
import { sp48ProfileLayout } from "@common/profile/layouts/sp48";
import type { ProfileSlice } from "@common/reverse/pipeline/profile/romPageProfile";
import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { createSp48Session } from "../harness/sp48";
import { buildFat12Image } from "../ep/fat12Image";

/*
 * The profile recipes of the ROM annotation pipeline (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.2,
 * P3): one per machine, kept here rather than written again by every session. A recipe boots the real
 * machine, turns the access profile on, types a fixed script of commands and returns the whole run;
 * `profile.test.ts` cuts it into one profile per ROM page (`romPageProfileOf`).
 *
 * Each ROM page names its slice of the core's profile buffer through the core's layout: the
 * Enterprise's ROMs are DAVE segments there (EXOS 00h-01h, the cartridge 04h, EXDOS 20h-21h), not
 * segment x 4000h of a file.
 *
 * What a run shows is observation (the provenance rule's "Klive's own runs"): the screens after each
 * command are kept in the log so a session can quote them.
 */

export type RecipeRom = { file: string; page: number; slice: ProfileSlice };

export type RecipeRun = {
  flags: Uint8Array;
  edges: ProfileEdge[];
  /** Each command and the screen after it, when the harness can read the screen as text. */
  steps: { command: string; screen?: string }[];
};

export type ProfileRecipe = {
  id: string;
  description: string;
  roms: RecipeRom[];
  run(): Promise<RecipeRun>;
};

// ------------------------------------------------------------------------------------------------
// The 48K

/** BASIC statements typed at the K cursor (a letter is a keyword there), each ending in ENTER. */
const SP48_SCRIPT: { command: string; keys: string[][] }[] = [
  { command: "PRINT 2+2", keys: [["P"], ["N2"], ["SShift", "K"], ["N2"], ["Enter"]] },
  { command: "PRINT 7/3", keys: [["P"], ["N7"], ["SShift", "V"], ["N3"], ["Enter"]] },
  { command: "CLS", keys: [["V"], ["Enter"]] },
  { command: "BORDER 1", keys: [["B"], ["N1"], ["Enter"]] },
  { command: "BEEP .1,1", keys: [["CShift", "SShift"], ["SShift", "Z"], ["SShift", "M"], ["N1"], ["SShift", "N"], ["N1"], ["Enter"]] },
  { command: "PLOT 10,10", keys: [["Q"], ["N1"], ["N0"], ["SShift", "N"], ["N1"], ["N0"], ["Enter"]] },
  { command: "10 PRINT 1", keys: [["N1"], ["N0"], ["P"], ["N1"], ["Enter"]] },
  { command: "LIST", keys: [["K"], ["Enter"]] },
  { command: "RUN", keys: [["R"], ["Enter"]] }
];

const sp48: ProfileRecipe = {
  id: "sp48",
  description: "48K BASIC: PRINT, arithmetic, CLS, BORDER, BEEP, PLOT, a program line, LIST, RUN",
  roms: [{ file: "sp48.rom", page: 0, slice: { start: profileOffsetOf(sp48ProfileLayout, undefined, 0)!, size: 0x4000 } }],
  async run() {
    const session = await createSp48Session();
    session.bootToBasic();
    const machine = session.machine;
    machine.resetProfile();
    machine.setProfiling(true, true);
    machine.setProfileCalls(true);
    const steps: RecipeRun["steps"] = [];
    for (const step of SP48_SCRIPT) {
      session.typeKeys(step.keys);
      session.runFrames(40);
      steps.push({ command: step.command });
    }
    machine.setProfiling(false, true);
    return { flags: machine.readProfileFlags(0, sp48ProfileLayout.flagBytes)!, edges: machine.readProfileEdges() ?? [], steps };
  }
};

// ------------------------------------------------------------------------------------------------
// The Enterprise

const segment = (s: number): ProfileSlice => ({ start: profileOffsetOf(epProfileLayout, s, 0)!, size: 0x4000 });

/** IS-BASIC commands, each typed and run with ENTER. */
const EP_SCRIPT = [
  "PRINT 1+2",
  "PRINT SIN(1),SQR(2)",
  'PRINT "AB"&"CD",LEN("ABC")',
  "10 FOR I=1 TO 3",
  "12 PRINT I",
  "14 NEXT",
  "20 PRINT TIME$",
  "LIST",
  "RUN",
  "PRINT INT(7/2),2^10",
  "NEW"
];

/** Commands that need the EXDOS card and a disk (an extension's command takes a `:` in IS-BASIC). */
const EXDOS_SCRIPT = [":DIR", '10 PRINT "DISK"', 'SAVE "TEST"', ":DIR", "NEW", 'LOAD "TEST"', "LIST"];

async function runEp(session: EpTestSession, script: string[]): Promise<RecipeRun> {
  session.bootToBasic({ maxFrames: 3000 });
  const machine = session.machine;
  machine.resetProfile();
  machine.setProfiling(true, true);
  machine.setProfileCalls(true);
  const steps: RecipeRun["steps"] = [];
  for (const command of script) {
    session.typeKeys(`${command}\n`, { settle: 120 });
    steps.push({ command, screen: session.screenText() });
  }
  machine.setProfiling(false, true);
  return { flags: machine.readProfileFlags(0, epProfileLayout.flagBytes)!, edges: machine.readProfileEdges() ?? [], steps };
}

const ep128: ProfileRecipe = {
  id: "ep128",
  description: "Enterprise 128, EXOS 2.1 and IS-BASIC 2.1: arithmetic, functions, strings, a program, LIST, RUN, NEW",
  roms: [
    { file: "ep-exos21.rom", page: 0, slice: segment(0x00) },
    { file: "ep-exos21.rom", page: 1, slice: segment(0x01) },
    { file: "ep-basic21.rom", page: 0, slice: segment(0x04) }
  ],
  run: async () => runEp(await createEpSession(), EP_SCRIPT)
};

const ep64: ProfileRecipe = {
  id: "ep64",
  description: "Enterprise 64, EXOS 2.0 and IS-BASIC 2.0: the ep128 script",
  roms: [
    { file: "ep-exos20.rom", page: 0, slice: segment(0x00) },
    { file: "ep-exos20.rom", page: 1, slice: segment(0x01) },
    { file: "ep-basic20.rom", page: 0, slice: segment(0x04) }
  ],
  run: async () => runEp(await createEpSession({ model: "ep64" }), EP_SCRIPT)
};

const ep128Exdos: ProfileRecipe = {
  id: "ep128-exdos",
  description: "Enterprise 128 with the EXDOS card and an empty 720K disk: the ep128 script, then DIR, SAVE, LOAD",
  roms: [
    ...ep128.roms,
    { file: "ep-exdos13.rom", page: 0, slice: segment(0x20) },
    { file: "ep-exdos13.rom", page: 1, slice: segment(0x21) }
  ],
  async run() {
    const session = await createEpSession({ exdos: true });
    session.insertDisk(0, buildFat12Image());
    return runEp(session, [...EP_SCRIPT, ...EXDOS_SCRIPT]);
  }
};

export const PROFILE_RECIPES: readonly ProfileRecipe[] = [sp48, ep128, ep64, ep128Exdos];

export function profileRecipe(id: string): ProfileRecipe {
  const recipe = PROFILE_RECIPES.find((r) => r.id === id);
  if (!recipe) throw new Error(`No profile recipe "${id}" (there are ${PROFILE_RECIPES.map((r) => r.id).join(", ")})`);
  return recipe;
}
