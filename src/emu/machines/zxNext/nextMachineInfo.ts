/*
 * What a ZX Spectrum Next machine tells the IDE and the debugger about itself, independent of the core
 * that emulates it: the partition names, the disassembly sections, the code-injection flow that boots
 * NextZXOS and types `.nexload`, and the length of a CALL-like instruction for step-over.
 *
 * Neutral: no emulation, only what the machine tells the IDE and the debugger about itself. It
 * was extracted so the TypeScript and WASM Next machines could not drift apart; the WASM machine
 * is the only one left, and the split still keeps this description out of the core's way.
 */
import type { CodeInjectionFlow, CodeInjectionStep } from "@emu/abstractions/CodeInjectionFlow";
import { IMemorySection, MemorySectionType } from "@abstractions/MemorySection";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { convertAsciiStringToNextKeyCodes } from "./nextKeyCodes";
import { extendedInstructionLenghts } from "./z80nInstructionLengths";

/* Local, so this neutral module does not depend on the renderer's command services */
const toHexa2 = (value: number) => (value & 0xff).toString(16).toUpperCase().padStart(2, "0");
const toHexa4 = (value: number) => (value & 0xffff).toString(16).toUpperCase().padStart(4, "0");

export const ZXNEXT_MAIN_WAITING_LOOP = 0x1202;

/*
 * The bounds of NextZXOS's key-wait loop in ROM 0:
 *
 *   $1202: HALT
 *   $1203: LD HL,$5C3B      ; FLAGS
 *   $1206: BIT 5,(HL)       ; a key is available?
 *   $1208: JR Z,$11F4       ; no - keep waiting
 *   $120A: RES 5,(HL)       ; consume it
 *
 * with an outer `JR $11E5` at $1200. The OS parks here whenever it wants a key - during boot, at the
 * boot menu, at the BASIC prompt, inside the Calculator. That is precisely why reaching
 * `ZXNEXT_MAIN_WAITING_LOOP` once proves nothing about *which* program is waiting, and why the flow
 * below waits for the machine to settle in this range instead.
 * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.14.
 */
const ZXNEXT_KEY_WAIT_LOOP_FROM = 0x11e5;
const ZXNEXT_KEY_WAIT_LOOP_TO = 0x120b;
const SP_KEY_WAIT = 250;
const SP_KEY_WAIT_SHORT = 50;

/**
 * Parses a partition label to get the partition number
 * @param label Label to parse
 */
export function parseNextPartitionLabel(label: string): number | undefined {
  // --- Normalize once and use the normalized value throughout. The `default:` branch used to
  // --- test the *original* string (`label.startsWith("M")`) while the switch tested the
  // --- uppercased one, and `BreakpointCommands` lowercases an address spec before parsing it —
  // --- so `bp-set m0:$8000` fell through to the hex branch, failed, and reported "Invalid
  // --- partition". Every DivMMC RAM partition was unreachable from every breakpoint command.
  const normalized = (label ?? "").trim().toUpperCase();
  switch (normalized) {
    case "UN":
      return undefined;
    case "R0":
      return -1;
    case "R1":
      return -2;
    case "R2":
      return -3;
    case "R3":
      return -4;
    case "X0":
      return -5;
    case "X1":
      return -6;
    // --- `Q0`/`Q1` were the alternate ROMs' names before they were renamed to the slightly more
    // --- suggestive `X0`/`X1` ("eXtra"). Still accepted so a script that names them keeps
    // --- working; `getPartitionLabels` no longer returns them.
    case "Q0":
      return -5;
    case "Q1":
      return -6;
    case "DM":
      return -7;
  }

  // --- DivMMC RAM pages M0..MF occupy partitions -8..-23.
  if (normalized.startsWith("M")) {
    const page = normalized.substring(1);
    return /^[0-9A-F]$/.test(page) ? -8 - parseInt(page, 16) : undefined;
  }

  // --- Everything else is a RAM bank, named by its hex index. Note this is what makes `A0` and
  // --- `D0` mean banks $A0 and $D0 rather than the alt ROM and a DivMMC page: those spellings
  // --- are ambiguous with the bank namespace, which is why the map does not use them.
  if (/^[0-9A-F]{1,2}$/.test(normalized)) {
    const bank = parseInt(normalized, 16);
    return bank >= 0 && bank < 224 ? bank : undefined;
  }
  return undefined;
}

/**
 * Gets the label of the specified partition
 * @param partition Partition index
 */
export function nextPartitionLabels(): Record<number, string> {
  const result: Record<number, string> = {
    [-1]: "R0",
    [-2]: "R1",
    [-3]: "R2",
    [-4]: "R3",
    [-5]: "X0",
    [-6]: "X1",
    [-7]: "DM"
  };
  for (let i = 0; i < 16; i++) {
    result[-8 - i] = `M${i.toString(16).toUpperCase()}`;
  }
  for (let i = 0; i < 224; i++) {
    result[i] = toHexa2(i).toUpperCase();
  }
  return result;
}

/**
 * The long forms of this machine's partition names.
 *
 * These are the words behind the abbreviations: the memory view's bank chooser used to *label*
 * these partitions `NROM0`, `ALTR0` and `DivMR` — names nothing else in the system used and that
 * `parsePartitionLabel` rejected. They are descriptions now, and the label is what identifies.
 */
export function nextPartitionDescriptions(): Record<number, string> {
  const result: Record<number, string> = {
    [-1]: "Next ROM 0",
    [-2]: "Next ROM 1",
    [-3]: "Next ROM 2",
    [-4]: "Next ROM 3",
    [-5]: "Alt ROM 0",
    [-6]: "Alt ROM 1",
    [-7]: "DivMMC ROM"
  };
  for (let i = 0; i < 16; i++) {
    result[-8 - i] = `DivMMC RAM ${i}`;
  }
  for (let i = 0; i < 224; i++) {
    result[i] = `Bank $${toHexa2(i).toUpperCase()}`;
  }
  return result;
}

/**
 * The four blocks a chooser groups this machine's special partitions into.
 *
 * The caption carries the noun so the chip does not have to: `M0`..`MF` sit under one
 * "DivMMC RAM" heading rather than spelling it out sixteen times.
 */
export function nextPartitionGroups(): Record<number, string> {
  const result: Record<number, string> = {
    [-1]: "Next ROM",
    [-2]: "Next ROM",
    [-3]: "Next ROM",
    [-4]: "Next ROM",
    [-5]: "Alt ROM",
    [-6]: "Alt ROM",
    [-7]: "DivMMC ROM"
  };
  for (let i = 0; i < 16; i++) {
    result[-8 - i] = "DivMMC RAM";
  }
  // --- The bank grid's caption sits to its *left*, on the first row, so naming it costs no
  // --- height — which was the only reason to leave it unlabelled.
  for (let i = 0; i < 224; i++) {
    result[i] = "RAM Banks";
  }
  return result;
}

/**
 * Gets a disassembly section of the machine with the specified options.
 * @param _options The options for the disassembly section.
 * @returns The disassembly section.
 */
export function nextDisassemblySections(options: Record<string, any>): IMemorySection[] {
  const ram = !!options.ram;
  const screen = !!options.screen;
  const sections: IMemorySection[] = [];
  if (!ram || !screen) {
    // --- Use the memory segments according to the "ram" and "screen" flags
    sections.push({
      startAddress: 0x0000,
      endAddress: 0x3fff,
      sectionType: MemorySectionType.Disassemble
    });
    if (ram) {
      if (screen) {
        sections.push({
          startAddress: 0x4000,
          endAddress: 0xffff,
          sectionType: MemorySectionType.Disassemble
        });
      } else {
        sections.push({
          startAddress: 0x5b00,
          endAddress: 0xffff,
          sectionType: MemorySectionType.Disassemble
        });
      }
    } else if (screen) {
      sections.push({
        startAddress: 0x4000,
        endAddress: 0x5aff,
        sectionType: MemorySectionType.Disassemble
      });
    }
  } else {
    // --- Disassemble the whole memory
    sections.push({
      startAddress: 0x0000,
      endAddress: 0xffff,
      sectionType: MemorySectionType.Disassemble
    });
  }

  return sections;
}

/**
 * Gets the main execution point information of the machine
 * @param _model Machine model to use for code execution
 */
export function buildNextCodeInjectionFlow(hasAutoExect: boolean, additionalInfo: any): CodeInjectionFlow {
  // --- Create QueueKey steps for the prompt
  const prompt = `.nexload ${additionalInfo}\n`;
  const promtKeys = convertAsciiStringToNextKeyCodes(prompt);
  const promptQueue: CodeInjectionStep[] = [];
  for (const keyCode of promtKeys) {
    if (keyCode.extMode) {
      promptQueue.push({
        type: "QueueKey",
        primary: SpectrumKeyCode.CShift,
        secondary: SpectrumKeyCode.CShift,
        wait: SP_KEY_WAIT_SHORT
      });
    }
    promptQueue.push({
      type: "QueueKey",
      primary: keyCode.primaryCode,
      secondary: keyCode.secondaryCode,
      wait: SP_KEY_WAIT_SHORT
    });
    promptQueue.push({
      type: "Wait",
      duration: SP_KEY_WAIT_SHORT
    });
  }

  // --- Create the flow
  const keys: CodeInjectionFlow = [
    {
      type: "KeepPc"
    },
    {
      // --- The cold boot: from a hard reset all the way through NextZXOS coming up, and by far
      // --- the longest step in this flow. Checkpointed so later runs start from the boot menu
      // --- instead of booting again.
      type: "ReachExecPoint",
      rom: 0,
      execPoint: ZXNEXT_MAIN_WAITING_LOOP,
      checkpoint: "zxnext-boot",
      message: `Main execution cycle point reached (ROM0/$${toHexa4(ZXNEXT_MAIN_WAITING_LOOP)})`
    },
    {
      type: "Start"
    },
    {
      type: "Wait",
      duration: 100
    },
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: ZXNEXT_MAIN_WAITING_LOOP,
      message: `Main execution cycle point reached (ROM0/$${toHexa4(ZXNEXT_MAIN_WAITING_LOOP)})`
    },
    {
      type: "Start"
    }
  ];
  if (hasAutoExect) {
    keys.push(
      {
        type: "QueueKey",
        primary: SpectrumKeyCode.Space,
        wait: SP_KEY_WAIT,
        message: "Space"
      },
      {
        type: "ReachExecPoint",
        rom: 0,
        execPoint: ZXNEXT_MAIN_WAITING_LOOP,
        message: `Main execution cycle point reached (ROM0/$${toHexa4(ZXNEXT_MAIN_WAITING_LOOP)})`
      }
    );
  }
  keys.push(
    {
      type: "Start"
    },
    // --- Do not touch the menu until it is actually up and waiting.
    //
    // The boot sync above only proves the OS reached its key-wait loop once, which happens during
    // startup too. Pressing the menu keys before the menu is drawn threw them away, and the
    // `.nexload` text that followed was then typed into the menu instead - where `c` of
    // `ScrollNutter` starts the Calculator.
    {
      type: "WaitIdle",
      fromAddr: ZXNEXT_KEY_WAIT_LOOP_FROM,
      toAddr: ZXNEXT_KEY_WAIT_LOOP_TO,
      message: "Boot menu ready"
    },
    {
      type: "QueueKey",
      primary: SpectrumKeyCode.N6,
      secondary: SpectrumKeyCode.CShift,
      wait: SP_KEY_WAIT,
      message: "Arrow down"
    },
    {
      type: "QueueKey",
      primary: SpectrumKeyCode.Enter,
      wait: 0,
      message: "Enter"
    },
    // --- Let the machine actually consume the Enter above before asking where it is.
    //
    // `QueueKey` only *queues*; `emulateKeystroke()` plays the key back over the following frames.
    // Without this the `ReachExecPoint` below ran while the machine was still sitting in the boot
    // menu's waiting loop — which is the very address it waits for — so it matched instantly and
    // typing started anyway. See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.13.
    {
      type: "WaitKeyQueue"
    },
    // --- Wait for the command line to be up and idle before typing into it.
    //
    // Not `ReachExecPoint` on the key-wait loop: that address is where the OS waits for *any* key,
    // so it matches while the boot menu is still up. Settling in the loop across consecutive
    // samples is the difference between "something wants a key" and "the command line is ready" -
    // while NextZXOS loads it, it is doing real work and cannot satisfy this.
    {
      type: "WaitIdle",
      fromAddr: ZXNEXT_KEY_WAIT_LOOP_FROM,
      toAddr: ZXNEXT_KEY_WAIT_LOOP_TO,
      message: "Command line ready"
    },
    {
      type: "Start"
    },
    ...promptQueue
  );
  return keys;
}

/**
 * Checks if the instruction at `pc` is a call-like instruction, for step-over: 0 when it is not,
 * otherwise its length (CALL, conditional CALL, RST - with the ROM's RST $18/$28 operand byte - HALT,
 * the repeating block instructions and the Z80N extended instructions).
 * @param readByte Reads a byte of memory without side effects on the emulated machine
 * @param pc The address of the instruction
 */
export function z80nCallInstructionLength(readByte: (address: number) => number, pc: number): number {
  let opCode = readByte(pc);

  // --- CALL instruction
  if (opCode == 0xcd) return 3;

  // --- Call instruction with condition
  if ((opCode & 0xc7) == 0xc4) return 3;

  // --- Check for RST instructions
  if ((opCode & 0xc7) == 0xc7) {
    return opCode === 0xdf || opCode === 0xef ? 3 : 1;
  }

  // --- Check for HALT instruction
  if (opCode == 0x76) return 1;

  // --- Check for extended instruction prefix
  if (opCode != 0xed) return 0;

  // --- Check for I/O and block transfer instructions
  opCode = readByte((pc + 1) & 0xffff);
  if ((opCode & 0xb4) === 0xb0) {
    return 2;
  }
  if (extendedInstructionLenghts[opCode] !== undefined) {
    return extendedInstructionLenghts[opCode];
  }
  return 0;
}

/**
 * Which 8K pages hold ROM in the default mapping: the Next ROM at $0000-$3FFF, RAM above. Like the
 * classic Spectrum machines' flags, this is read once when the memory view is set up (it marks what
 * the memory editor treats as ROM), not a live view of the paging.
 */
export const NEXT_ROM_FLAGS: readonly boolean[] = [true, true, false, false, false, false, false, false];
