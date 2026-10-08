import type { ProfileCounts, ProfileEdge, ProfileInfo, ProfileTouchedByte } from "@common/profile/profileTypes";
import { hasProfileExports, WasmProfileReader } from "./WasmProfileReader";

/*
 * The `IAccessProfileSource` methods of a machine on a WASM core (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md`
 * §4.2): one reader per loaded core instance, rebuilt when the core is reloaded. A machine class owns
 * one and delegates to it, as it does with `WasmHistorySource`. A core built without the profile
 * reads as "no profile" rather than failing.
 */
export class WasmProfileSource {
  private cached?: { exports: unknown; reader: WasmProfileReader | undefined };

  /**
   * @param getExports The loaded core's exports; undefined until the core is loaded
   * @param machineId The machine whose layout names the offsets (`profileMachineId`)
   * @param timeUnit What the core's time counts in (D8)
   */
  constructor(
    private readonly getExports: () => unknown,
    private readonly machineId: () => string,
    private readonly timeUnit = "T-states"
  ) {}

  /** The reader of the loaded core, or undefined until the core is loaded */
  reader(): WasmProfileReader | undefined {
    const exports = this.getExports();
    if (!exports) return undefined;
    if (this.cached?.exports !== exports) {
      this.cached = {
        exports,
        reader: hasProfileExports(exports) ? new WasmProfileReader(exports, this.machineId(), this.timeUnit) : undefined
      };
    }
    return this.cached.reader;
  }

  info(): ProfileInfo | undefined {
    return this.reader()?.info();
  }

  setEnabled(enabled: boolean, counters: boolean): void {
    this.reader()?.setEnabled(enabled, counters);
  }

  reset(): void {
    this.reader()?.reset();
  }

  flags(start: number, length: number): Uint8Array | undefined {
    return this.reader()?.flags(start, length);
  }

  counts(start: number, length: number): ProfileCounts | undefined {
    return this.reader()?.counts(start, length);
  }

  touched(mask?: number): ProfileTouchedByte[] | undefined {
    return this.reader()?.touched(mask);
  }

  merge(bytes: readonly ProfileTouchedByte[], totals: { instructions: number; timeTotal: number }): void {
    this.reader()?.merge(bytes, totals);
  }

  setCalls(on: boolean): void {
    this.reader()?.setCalls(on);
  }

  arm(start: number | undefined, stop: number | undefined): void {
    this.reader()?.arm(start, stop);
  }

  edges(): ProfileEdge[] | undefined {
    return this.reader()?.edges();
  }
}
