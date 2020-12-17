// @ts-nocheck
import * as vscode from "vscode";
import { getLastMachineType } from "../emulator/notifier";
import { MachineState } from "../shared/machines/machine-state";

export class Z80RegistersProvider
  implements vscode.TreeDataProvider<RegisterItem | FlagItem> {
  // --- Keeps register data
  private _registers: RegisterItem[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<
    RegisterItem | FlagItem | undefined | void
  > = new vscode.EventEmitter<RegisterItem | FlagItem | undefined | void>();

  /**
   * An optional event to signal that an element or root has changed.
   * This will trigger the view to update the changed element/root and its children recursively (if shown).
   * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
   */
  readonly onDidChangeTreeData: vscode.Event<
    RegisterItem | FlagItem | undefined | void
  > = this._onDidChangeTreeData.event;

  /**
   * Refreshes the display of register values
   * @param r Register data to display
   */
  refresh(r: MachineState): void {
    (async () => {
      this._registers = [
        new RegisterItem("regAF", "AF", r._af, [
          new RegisterItem("regA", "A", r._af >> 8, [], 2),
          new FlagItem("flagS", "S", (r._af & 0x80) !== 0, "P", "M"),
          new FlagItem("flagZ","Z", (r._af & 0x40) !== 0, "Z", "NZ"),
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
        new RegisterItem("regPC","PC", r._pc),
        new RegisterItem("regSP", "SP", r._sp),
        new RegisterItem("regI", "I", r._i, [], 2),
        new RegisterItem("regR", "R", r._r, [], 2),
        new RegisterItem("regIX", "IX", r._ix, [
          new RegisterItem("regXH", "IXH", r._ix >> 8, [], 2),
          new RegisterItem("regXL", "IXL", r._ix & 0xff, [], 2),
        ]),
        new RegisterItem("regIY", "IY", r._iy, [
          new RegisterItem("regYH","IYH", r._iy >> 8, [], 2),
          new RegisterItem("regYL", "IYL", r._iy & 0xff, [], 2),
        ]),
        new RegisterItem("regWZ", "WZ", r._wz),
      ];

      const machineType = getLastMachineType();
      if (machineType === "cz88") {
        
      }
      this._onDidChangeTreeData.fire();
    })();
  }

  /**
   * Get [TreeItem](#TreeItem) representation of the `element`
   * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
   * @return [TreeItem](#TreeItem) representation of the element
   */
  getTreeItem(element: RegisterItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children of `element` or root if no element is passed.
   * @param element The element from which the provider gets children. Can be `undefined`.
   * @return Children of `element` or root if no element is passed.
   */
  getChildren(element?: RegisterItem): Thenable<(RegisterItem | FlagItem)[]> {
    return Promise.resolve(element ? element.children : this._registers);
  }
}

/**
 * Represents a register value
 */
class RegisterItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public value: number,
    public children: (RegisterItem | FlagItem)[] = [],
    private readonly hexaDigits = 4,
    private readonly showDecimal = true
  ) {
    super(
      label,
      children.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
  }

  /**
   * The tooltip text when you hover over this item.
   */
  get tooltip(): string {
    return `${this.label} ${this.description} (0b${this.value.toString(2).padStart(4 * this.hexaDigits, "0")})`
    ;
  }

  /**
   * A human-readable string which is rendered less prominent.
   * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) and when `falsy`, it is not shown.
   */
  get description(): string {
    return `$${toHexa(this.value, this.hexaDigits)}${
      this.showDecimal ? " (" + this.value.toString(10) + ")" : ""
    }`;
  }

  iconPath = new vscode.ThemeIcon("symbol-variable");
}

/**
 * Represents a register value
 */
class FlagItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public value: boolean,
    private falseVal: string,
    private trueVal: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }

  /**
   * The tooltip text when you hover over this item.
   */
  get tooltip(): string {
    return `${this.label} ${this.description}`;
  }

  /**
   * A human-readable string which is rendered less prominent.
   * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) and when `falsy`, it is not shown.
   */
  get description(): string {
    return `${this.value ? "1" : "0"} ${
      this.falseVal && this.trueVal
        ? "(" + (this.value
          ? this.trueVal
          : this.falseVal) + ")"
        : ""
    }`;
  }

  iconPath = new vscode.ThemeIcon(this.value ? "circle-filled" : "circle-outline");
}

/**
 * Converts a value to its hexadecimal representation
 * @param input Input value
 * @param digits Number of hexadecimal digits
 */
function toHexa(input: number, digits: number): string {
  return input.toString(16).toUpperCase().padStart(digits, "0");
}
