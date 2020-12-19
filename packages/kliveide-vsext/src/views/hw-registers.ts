import {
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { MachineState } from "../shared/machines/machine-state";
import {
  getMachineViewProvider,
  onMachineTypeChanged,
} from "../emulator/notifier";
import { Z80SignalStateFlags } from "../shared/machines/z80-helpers";
import { communicatorInstance } from "../emulator/communicator";

export /**
 * This class represents a provider that displays the "Z80 CPU & Other Registers"
 * view
 */
class HardwareRegistersProvider implements TreeDataProvider<TreeItem> {
  // --- Keeps register data
  private _registers: TreeItem[] = [];
  private _onDidChangeTreeData: EventEmitter<
    TreeItem | undefined | void
  > = new EventEmitter<TreeItem | undefined | void>();

  constructor() {
    onMachineTypeChanged(async (e) => {
      const state = await communicatorInstance.getMachineState();
      this.refresh(state);
    });
  }

  /**
   * An optional event to signal that an element or root has changed.
   * This will trigger the view to update the changed element/root and its children recursively (if shown).
   * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
   */
  readonly onDidChangeTreeData: Event<TreeItem | undefined | void> = this
    ._onDidChangeTreeData.event;

  /**
   * Refreshes the display of register values
   * @param r Register data to display
   */
  refresh(r: MachineState): void {
    (async () => {
      // --- Collect Z80 register values
      this._registers = [
        new RegisterItem("regAF", "AF", r._af, [
          new RegisterItem("regA", "A", r._af >> 8, [], 2),
          new FlagItem("flagS", "S", (r._af & 0x80) !== 0, "P", "M"),
          new FlagItem("flagZ", "Z", (r._af & 0x40) !== 0, "Z", "NZ"),
          new FlagItem("flag5", "5", (r._af & 0x20) !== 0, "", ""),
          new FlagItem("flagH", "H", (r._af & 0x10) !== 0, "", ""),
          new FlagItem("flag3", "3", (r._af & 0x08) !== 0, "", ""),
          new FlagItem("flagPV", "PV", (r._af & 0x04) !== 0, "PO", "PE"),
          new FlagItem("flagN", "N", (r._af & 0x02) !== 0, "", ""),
          new FlagItem("flagC", "C", (r._af & 0x01) !== 0, "C", "NC"),
        ]),
        new RegisterItem("regBC", "BC", r._bc, [
          new RegisterItem("regB", "B", r._bc >> 8, [], 2),
          new RegisterItem("regC", "C", r._bc & 0xff, [], 2),
        ]),
        new RegisterItem("regDE", "DE", r._de, [
          new RegisterItem("regD", "D", r._de >> 8, [], 2),
          new RegisterItem("regE", "E", r._de & 0xff, [], 2),
        ]),
        new RegisterItem("regHL", "HL", r._hl, [
          new RegisterItem("regH", "H", r._hl >> 8, [], 2),
          new RegisterItem("regL", "L", r._hl & 0xff, [], 2),
        ]),
        new RegisterItem("regAF_", "AF'", r._af_sec),
        new RegisterItem("regBC_", "BC'", r._bc_sec),
        new RegisterItem("regDE_", "DE'", r._de_sec),
        new RegisterItem("regHL_", "HL'", r._hl_sec),
        new RegisterItem("regPC", "PC", r._pc),
        new RegisterItem("regSP", "SP", r._sp),
        new RegisterItem("regI", "I", r._i, [], 2),
        new RegisterItem("regR", "R", r._r, [], 2),
        new RegisterItem("regIX", "IX", r._ix, [
          new RegisterItem("regXH", "IXH", r._ix >> 8, [], 2),
          new RegisterItem("regXL", "IXL", r._ix & 0xff, [], 2),
        ]),
        new RegisterItem("regIY", "IY", r._iy, [
          new RegisterItem("regYH", "IYH", r._iy >> 8, [], 2),
          new RegisterItem("regYL", "IYL", r._iy & 0xff, [], 2),
        ]),
        new RegisterItem("regWZ", "WZ", r._wz),
        new InterruptModeItem(r.interruptMode),
        new FlagItem("iff1", "IFF1", r.iff1, "disabled", "enabled"),
        new FlagItem("iff2", "IFF2", r.iff1, "disabled", "enabled"),
        new FlagItem(
          "int",
          "INT",
          !!(r.stateFlags & Z80SignalStateFlags.Int),
          "no",
          "yes"
        ),
        new FlagItem("intb", "INT Blocked", r.isInterruptBlocked, "no", "yes"),
        new FlagItem(
          "nmi",
          "NMI",
          !!(r.stateFlags & Z80SignalStateFlags.Nmi),
          "no",
          "yes"
        ),
        new FlagItem(
          "halt",
          "HLT",
          !!(r.stateFlags & Z80SignalStateFlags.Halted),
          "no",
          "yes"
        ),
        new TactsItem(
          "Tacts",
          "#of T-cycles since start",
          r.tacts + r.frameCount * r.tactsInFrame
        ),
      ];

      const viewProvider = getMachineViewProvider();
      if (viewProvider) {
        const additionalRegs = await viewProvider.getHardwareRegisters(r);
        this._registers.push(...additionalRegs);
      }

      this._onDidChangeTreeData.fire();
    })();
  }

  /**
   * Get [TreeItem](#TreeItem) representation of the `element`
   * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
   * @return [TreeItem](#TreeItem) representation of the element
   */
  getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  /**
   * Get the children of `element` or root if no element is passed.
   * @param element The element from which the provider gets children. Can be `undefined`.
   * @return Children of `element` or root if no element is passed.
   */
  getChildren(element?: TreeItemWithChildren): Thenable<TreeItem[]> {
    return Promise.resolve(element ? element.children : this._registers);
  }
}

export interface TreeItemWithChildren extends TreeItem {
  children: TreeItem[];
}

/**
 * Represents a Z80 register/other register value
 */
export class RegisterItem extends TreeItem implements TreeItemWithChildren {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public value: number,
    public children: TreeItem[] = [],
    private readonly hexaDigits = 4,
    private readonly showDecimal = true
  ) {
    super(
      label,
      children.length > 0
        ? TreeItemCollapsibleState.Collapsed
        : TreeItemCollapsibleState.None
    );
    this.id = id;
    this.description = `$${toHexa(this.value, this.hexaDigits)}${
      this.showDecimal ? " (" + this.value.toString(10) + ")" : ""
    }`;
    this.tooltip = `${this.label} ${this.description} (0b${this.value
      .toString(2)
      .padStart(4 * this.hexaDigits, "0")})`;
    this.iconPath = new ThemeIcon("symbol-variable");
  }
}

/**
 * Represents a Z80/other register flag value
 */
export class FlagItem extends TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public value: boolean,
    private falseVal: string,
    private trueVal: string
  ) {
    super(label, TreeItemCollapsibleState.None);
    this.id = id;
    this.description = `${this.value ? "1" : "0"} ${
      this.falseVal && this.trueVal
        ? "(" + (this.value ? this.trueVal : this.falseVal) + ")"
        : ""
    }`;
    this.tooltip = `${this.label} ${this.description}`;
    this.iconPath = new ThemeIcon(
      this.value ? "circle-filled" : "circle-outline"
    );
  }
}

/**
 * Represent an interrupt mode item
 */
class InterruptModeItem extends TreeItem {
  constructor(value: number) {
    super("IM", TreeItemCollapsibleState.None);
    this.description = `${value}`;
    this.tooltip = `Interrupt mode: ${value}`;
    this.iconPath = new ThemeIcon("symbol-variable");
  }
}

/**
 * Represent an interrupt mode item
 */
export class TactsItem extends TreeItem {
  constructor(label: string, descLabel: string, value: number) {
    super(label, TreeItemCollapsibleState.None);
    this.description = `${value}`;
    this.tooltip = `${descLabel}: ${value}`;
    this.iconPath = new ThemeIcon("watch");
  }
}

/**
 * Converts a value to its hexadecimal representation
 * @param input Input value
 * @param digits Number of hexadecimal digits
 */
function toHexa(input: number, digits: number): string {
  return input.toString(16).toUpperCase().padStart(digits, "0");
}
