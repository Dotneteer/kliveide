import type { DisassemblyItem } from "@renderer/appIde/disassemblers/common-types";
import type { NexFileAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";
import type {
  NexAnnotationEditorEnvironment,
  NexAnnotationEditorState
} from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorModel";
import { initialState } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorModel";
import type { NexAnnotationSessionSnapshot } from "@renderer/appIde/DocumentPanels/Next/annotationEditor/NexAnnotationEditorPorts";

/*
 * Deep-merged builders, per `.ai/ui-mvc-guide.md`: a test names only the fields it cares about, and
 * a new field on the state cannot be missed because the builder starts from the real `initialState`.
 */

export const SIDECAR = "/projects/game/Game.nex.dis";
export const BANK = 5;

export function anEnvironment(
  over: Partial<NexAnnotationEditorEnvironment> = {}
): NexAnnotationEditorEnvironment {
  return {
    annotationPath: SIDECAR,
    bank: BANK,
    viewMode: "disassembly",
    decimalView: false,
    disassOffset: 0x4000,
    machineRunning: false,
    ...over
  };
}

export function anAnnotationModel(over: Partial<NexFileAnnotations> = {}): NexFileAnnotations {
  return {
    schemaVersion: 1,
    banks: {
      [String(BANK)]: {
        offsetIndex: 1,
        regions: [{ start: 0, end: 0x3fff, type: "disassemble" }]
      }
    },
    ...over
  };
}

/** A listing row carrying the bank/offset metadata every annotation action reads. */
export function aRow(
  bankOffset: number,
  over: Partial<DisassemblyItem> & { byteLength?: number } = {}
): DisassemblyItem {
  const { byteLength = 1, ...rest } = over;
  return {
    address: 0x4000 + bankOffset,
    opCodes: [0x00],
    instruction: "nop",
    annotation: { bank: BANK, bankOffset, byteLength },
    ...rest
  } as DisassemblyItem;
}

/** A row an operand label can be attached to: a real instruction with a decoded 16-bit operand. */
export function anOperandRow(bankOffset: number): DisassemblyItem {
  return aRow(bankOffset, {
    byteLength: 3,
    instruction: "jp $4100",
    operandCandidates: [{ operandIndex: 0, value: 0x4100 }]
  } as any);
}

/**
 * A row whose operand the listing resolved to a label, as "Go to definition" requires.
 *
 * `resolvedText` is the part that matters: it is the only mark left that a *name* was printed, the
 * instruction having been flattened to a string by then.
 */
export function aLabelledOperandRow(bankOffset: number, operandValue: number): DisassemblyItem {
  return aRow(bankOffset, {
    byteLength: 3,
    instruction: "ld hl,Target",
    operandCandidates: [
      {
        instructionAddress: 0x4000 + bankOffset,
        instructionOffset: bankOffset,
        operandIndex: 0,
        operandValue,
        defaultText: "$0000",
        resolvedText: "Target"
      }
    ]
  } as any);
}

/** An annotation model carrying one label in this bank and one beyond it. */
export function anAnnotationModelWithLabels(): NexFileAnnotations {
  return anAnnotationModel({
    globalLabels: [
      { name: "Nearby", value: 0x4100 },
      { name: "FarAway", value: 0xc100 }
    ]
  });
}

/** The generated prefix row a synopsis comment renders as: no annotation of its own. */
export function aPrefixRow(): DisassemblyItem {
  return { address: 0x4000, isPrefixItem: true, prefixComment: "; note" } as DisassemblyItem;
}

/** A listing of `count` one-byte rows, starting at offset 0. */
export function aListing(count: number): DisassemblyItem[] {
  return Array.from({ length: count }, (_, index) => aRow(index));
}

export function aState(over: Partial<NexAnnotationEditorState> = {}): NexAnnotationEditorState {
  return {
    ...initialState(over.env ?? anEnvironment()),
    ...over
  };
}

export function aSnapshot(
  over: Partial<NexAnnotationSessionSnapshot> = {}
): NexAnnotationSessionSnapshot {
  return {
    annotations: anAnnotationModel(),
    dirty: false,
    loading: false,
    ...over
  };
}
