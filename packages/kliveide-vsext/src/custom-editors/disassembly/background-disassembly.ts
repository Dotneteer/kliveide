import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { CancellationToken, Disposable, CancellationTokenSource } from "vscode";
import {
  DisassemblyOutput,
  MemorySection,
  MemorySectionType,
  DisassemblyItem,
  intToX4,
} from "../../disassembler/disassembly-helper";
import {
  onConnectionStateChanged,
  onMachineTypeChanged,
  onExecutionStateChanged,
} from "../../emulator/notifier";
import { machineTypes } from "../../emulator/machine-info";
import { DisassemblyAnnotation } from "../../disassembler/annotations";
import {
  spectrumConfigurationInstance,
  DISASS_ANN_FILE,
} from "../../emulator/machine-config";
import { getAssetsFileName } from "../../extension-paths";
import { Z80Disassembler } from "../../disassembler/z80-disassembler";
import {
  communicatorInstance,
  ExecutionState,
} from "../../emulator/communicator";

/**
 * The current machine type
 */
let machineType: string | null = null;

/**
 * The current execution state
 */
let executionState = "";

/**
 * Cache for the full disassembly
 */
let fullDisassemblyCache: DisassemblyOutput | null = null;

/**
 * The annotation for the current machine
 */
const romAnnotations: (DisassemblyAnnotation | null)[] = [];

/**
 * Full annotations with a particular rom page
 */
const fullAnnotations: (DisassemblyAnnotation | null)[] = [];

/**
 * The currently executing disassembly task
 */
let disassemblyTask: Promise<void> | null = null;

/**
 * The cancellation token source of the currently running disassembly task
 */
let cancellationTokenSource: CancellationTokenSource | null = null;

/**
 * Disposables when background disassembly is stopped
 */
const disposables: Disposable[] = [];

/**
 * Number of disassemblies since the last start
 */
let disassemblyCount = 0;

/**
 * Gets the full disassembly
 */
export async function getFullDisassembly(): Promise<DisassemblyItem[]> {
  const start = Date.now();
  while (!fullDisassemblyCache && Date.now() - start < 15000) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return fullDisassemblyCache ? fullDisassemblyCache.outputItems : [];
}

/**
 * Starts background disassembly of ROMs and Full view
 * Note: We do not start the disassembly. It will happen when
 * the machine type is set.
 */
export function startBackgroundDisassembly(): void {
  // --- Reset the counter
  disassemblyCount = 0;

  // --- Set up event handlers
  disposables.push(
    onConnectionStateChanged(async (state: boolean) => {
      // --- Stop disassembly if emulator disconnects
      if (!state) {
        await stopDisassembly();
      } else {
        startDisassembly();
      }
    })
  );
  disposables.push(
    onExecutionStateChanged((exec: ExecutionState) => {
      // --- Follow the execution state
      executionState = exec.state;
    })
  );
  disposables.push(
    onMachineTypeChanged(async (type: string) => {
      // --- Erase the cache and start disassembly again
      // --- whenever the machine type changes
      await stopDisassembly();
      romAnnotations.length = 0;
      fullDisassemblyCache = null;
      machineType = type;
      if (machineType) {
        // --- Start only if we have a machine type.
        startDisassembly();
      }
    })
  );
}

/**
 * Stops the background disassembly processing and releases
 * resources
 */
export async function stopBackgroundDisassembly(): Promise<void> {
  await stopDisassembly();
  disposables.forEach((d) => d.dispose());
}

/**
 * Starts the background disassembly
 */
function startDisassembly(): void {
  if (cancellationTokenSource || disassemblyTask) {
    // --- Disassembly is in progress, no need to start
    return;
  }

  cancellationTokenSource = new CancellationTokenSource();
  disassemblyTask = doBackroundDisassembly(cancellationTokenSource.token);
}

/**
 * Stops the background disassembly
 */
async function stopDisassembly(): Promise<void> {
  if (cancellationTokenSource) {
    cancellationTokenSource.cancel();
  }
  if (disassemblyTask) {
    await disassemblyTask;
  }
  cancellationTokenSource = null;
  disassemblyTask = null;
}

/**
 * Executes the flow of background disassembly
 */
async function doBackroundDisassembly(
  cancellation: CancellationToken
): Promise<void> {
  if (!machineType) {
    // --- We need a machine type to carry out disassembly
    return;
  }

  // --- We need machine configuration to carry on
  const config = machineTypes[machineType];
  if (!config) {
    return;
  }

  // --- Number of ROM disassemblies to cache
  const roms = config.paging.supportsPaging ? config.paging.roms : 1;

  while (!cancellation.isCancellationRequested) {
    // --- Do the disassembly if we may have changes
    if (disassemblyCount === 0 || executionState === "running") {
      // --- Get and cache ROM pages
      for (let i = 0; i < roms; i++) {
        if (romAnnotations[i] === undefined) {
          const romAnn = (romAnnotations[i] = getRomAnnotation(i));
          const fullAnnotation = getFullAnnotation();
          if (romAnn && fullAnnotation) {
            fullAnnotation.merge(romAnn);
            fullAnnotations[i] = fullAnnotation;
          } else {
            fullAnnotations[i] = null;
          }
        }
      }

      // --- Obtain the disassembly for the full view
      const start = Date.now();
      const memContents = await communicatorInstance.getMemory(0x0000, 0xffff);
      const bytes = new Uint8Array(Buffer.from(memContents, "base64"));
      const disassemblyOut = await disassembly(
        bytes,
        0x0000,
        0xffff,
        fullAnnotations[0],
        undefined,
        disassemblyCount ? 0 : 50
      );
      if (disassemblyOut) {
        fullDisassemblyCache = disassemblyOut;
        console.log(
          `Full memory disassembled (${disassemblyOut.outputItems.length}): ${
            Date.now() - start
          }`
        );
      }

      // --- A new disassembly done
      disassemblyCount++;
    }

    // --- Allow short break before going on
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/**
 * Gets the annotation of the specified ROM page
 * @param rom ROM page number
 */
function getRomAnnotation(rom: number): DisassemblyAnnotation | null {
  // --- Let's assume on open project folder
  const folders = vscode.workspace.workspaceFolders;
  const projFolder = folders ? folders[0].uri.fsPath : null;
  if (!projFolder) {
    return null;
  }

  rom = rom ?? 0;
  try {
    // --- Obtain the file for the annotations
    const annotations =
      spectrumConfigurationInstance.configuration?.annotations;
    if (!annotations) {
      return null;
    }

    let romAnnotationFile = annotations[rom];
    if (romAnnotationFile.startsWith("#")) {
      romAnnotationFile = getAssetsFileName(
        path.join("annotations", romAnnotationFile.substr(1))
      );
    } else {
      romAnnotationFile = path.join(projFolder, romAnnotationFile);
    }

    // --- Get root annotations from the file
    const contents = fs.readFileSync(romAnnotationFile, "utf8");
    const annotation = DisassemblyAnnotation.deserialize(contents);
    return annotation;
  } catch (err) {
    console.log(err);
  }
  return null;
}

/**
 * Gets the full annotation merged with the specified ROM page
 */
function getFullAnnotation(): DisassemblyAnnotation | null {
  try {
    const folders = vscode.workspace.workspaceFolders;
    const projFolder = folders ? folders[0].uri.fsPath : null;
    if (!projFolder) {
      return null;
    }
    const viewFilePath = path.join(projFolder, DISASS_ANN_FILE);
    const viewContents = fs.readFileSync(viewFilePath, "utf8");
    return DisassemblyAnnotation.deserialize(viewContents);
  } catch (err) {
    console.log(err);
  }
  return null;
}

/**
 * Gets the disassembly for the specified memory range
 * @param from Start address
 * @param to End address
 */
async function disassembly(
  bytes: Uint8Array,
  from: number,
  to: number,
  annotations?: DisassemblyAnnotation | null,
  cancellation?: CancellationToken,
  batchPause?: number
): Promise<DisassemblyOutput | null> {
  // --- Use the memory sections in the annotations
  const sections: MemorySection[] = annotations?.memoryMap?.sections ?? [
    new MemorySection(from, to, MemorySectionType.Disassemble),
  ];

  // --- Do the disassembly
  const disassembler = new Z80Disassembler(sections, bytes);
  const rawItems = await disassembler.disassemble(from, to, batchPause);
  if (!rawItems) {
    return rawItems;
  }

  // --- Compose annotations
  const updatedItems: DisassemblyItem[] = [];
  for (const item of rawItems.outputItems) {
    const prefixComment = annotations?.prefixComments.get(item.address);
    if (prefixComment) {
      const prefixItem: DisassemblyItem = {
        address: item.address,
        isPrefixItem: true,
        prefixComment,
      };
      updatedItems.push(prefixItem);
    }
    const formattedLabel = annotations?.labels.get(item.address);
    item.formattedLabel =
      formattedLabel ?? (item.hasLabel ? "L" + intToX4(item.address) : "");
    item.formattedComment = item.hardComment ? item.hardComment + " " : "";
    const comment = annotations?.comments.get(item.address);
    if (comment) {
      item.formattedComment += comment;
    }
    if (annotations && item.tokenLength && item.tokenLength > 0) {
      let symbol: string | undefined;
      if (item.hasLabelSymbol && item.symbolValue) {
        const label = annotations.labels.get(item.symbolValue);
        if (label) {
          symbol = label;
        }
      } else {
        symbol = annotations.literalReplacements.get(item.address);
      }
      if (symbol && item.instruction && item.tokenPosition) {
        item.instruction =
          item.instruction.substr(0, item.tokenPosition) +
          symbol +
          item.instruction.substr(item.tokenPosition + item.tokenLength);
      }
    }
    updatedItems.push(item);
  }
  rawItems.replaceOutputItems(updatedItems);
  return rawItems;
}
