import type { ExecutionHistoryInfo, ExecutionHistoryPage } from "@common/history/historyTypes";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import { WasmHistoryReader, type WasmHistoryExports } from "./WasmHistoryReader";

/*
 * The `IExecutionHistorySource` methods of a machine on a WASM core that records history
 * (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` §1, step 3): one reader per loaded core instance,
 * rebuilt when the core is reloaded. A machine class owns one and delegates its four methods to it.
 */
export class WasmHistorySource {
  private cached?: { exports: WasmHistoryExports; reader: WasmHistoryReader };

  /**
   * @param getExports The loaded core's exports; undefined until the core is loaded
   * @param machineId The machine whose context decoder reads the records (`historyMachineId`)
   */
  constructor(
    private readonly getExports: () => WasmHistoryExports | undefined,
    private readonly machineId: () => string
  ) {}

  /** The reader of the loaded core, or undefined until the core is loaded */
  reader(): WasmHistoryReader | undefined {
    const exports = this.getExports();
    if (!exports) return undefined;
    if (this.cached?.exports !== exports) {
      this.cached = { exports, reader: new WasmHistoryReader(exports, this.machineId()) };
    }
    return this.cached.reader;
  }

  info(): ExecutionHistoryInfo | undefined {
    return this.reader()?.info();
  }

  read(fromSequence: number, count: number): ExecutionHistoryPage | undefined {
    return this.reader()?.read(fromSequence, count);
  }

  serviceSpans(): HistoryServiceSpan[] | undefined {
    return this.reader()?.serviceSpans();
  }

  clear(): void {
    this.reader()?.clear();
  }

  setEnabled(enabled: boolean): void {
    this.reader()?.setEnabled(enabled);
  }
}
