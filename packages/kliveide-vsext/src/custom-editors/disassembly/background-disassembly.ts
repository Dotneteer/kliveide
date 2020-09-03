import { CancellationToken, Disposable, CancellationTokenSource } from "vscode";
import { DisassemblyOutput } from "../../disassembler/disassembly-helper";
import {
  onConnectionStateChanged,
  onMachineTypeChanged,
} from "../../emulator/notifier";
import { machineTypes } from "../../emulator/machine-info";

/**
 * The current machine type
 */
let machineType: string | null = null;

/**
 * Cache for the disassembly of ROMs
 */
const romDisassemblyCache: DisassemblyOutput[] = [];

/**
 * Cache for the full disassembly
 */
let fullDisassemblyCache: DisassemblyOutput | null = null;

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
 * Starts background disassembly of ROMs and Full view
 * Note: We do not start the disassembly. It will happen when
 * the machine type is set.
 */
export function startBackgroundDisassembly(): void {
  disposables.push(
    onConnectionStateChanged(async (state: boolean) => {
      // --- Stop disassembly if emulator disconnects
      if (!state) {
        await stopDisassembly();
      }
    })
  );
  disposables.push(
    onMachineTypeChanged(async (type: string) => {
      // --- Erase the cache and start disassembly again
      console.log(`Changing to machine type ${type}`);
      await stopDisassembly();
      romDisassemblyCache.length = 0;
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

  console.log("Disasembly starting.");
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
  console.log("Disasembly stopped.");
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
    // --- Get and cache ROM pages
    for (let i = 0; i < roms; i++) {
      if (!romDisassemblyCache[i]) {
        // --- Obtain the disassembly for this ROM
        // TODO
      }
    }

    // --- Obtain the disassembly for the full view
    // TODO

    // --- Allow short break before going on
    await new Promise((r) => setTimeout(r, 2000));
  }

  // TODO: Implement this method
  console.log("Disasembly pass completed.");
}
