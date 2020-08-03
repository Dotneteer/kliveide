import * as vscode from "vscode";
import { RegisterData } from "../emulator/communicator";

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
  refresh(r: RegisterData): void {
    (async () => {
      this._registers = [
        new RegisterItem("regAF", "AF", r.af, [
          new RegisterItem("regA", "A", r.af >> 8, [], 2),
          new FlagItem("flagS", "S", (r.af & 0x80) !== 0, "P", "M"),
          new FlagItem("flagZ","Z", (r.af & 0x40) !== 0, "Z", "NZ"),
          new FlagItem("flag5", "5", (r.af & 0x20) !== 0, "", ""),
          new FlagItem("flagH", "H", (r.af & 0x10) !== 0, "", ""),
          new FlagItem("flag3", "3", (r.af & 0x08) !== 0, "", ""),
          new FlagItem("flagPV", "PV", (r.af & 0x04) !== 0, "PO", "PE"),
          new FlagItem("flagN", "N", (r.af & 0x02) !== 0, "", ""),
          new FlagItem("flagC", "C", (r.af & 0x01) !== 0, "C", "NC"),
        ]),
        new RegisterItem("regBC", "BC", r.bc, [
          new RegisterItem("regB", "B", r.bc >> 8, [], 2),
          new RegisterItem("regC", "C", r.bc & 0xff, [], 2),
        ]),
        new RegisterItem("regDE", "DE", r.de, [
          new RegisterItem("regD", "D", r.de >> 8, [], 2),
          new RegisterItem("regE", "E", r.de & 0xff, [], 2),
        ]),
        new RegisterItem("regHL", "HL", r.hl, [
          new RegisterItem("regH", "H", r.hl >> 8, [], 2),
          new RegisterItem("regL", "L", r.hl & 0xff, [], 2),
        ]),
        new RegisterItem("regAF_", "AF'", r.af_),
        new RegisterItem("regBC_", "BC'", r.bc_),
        new RegisterItem("regDE_", "DE'", r.de_),
        new RegisterItem("regHL_", "HL'", r.hl_),
        new RegisterItem("regPC","PC", r.pc),
        new RegisterItem("regSP", "SP", r.sp),
        new RegisterItem("regI", "I", r.i, [], 2),
        new RegisterItem("regR", "R", r.r, [], 2),
        new RegisterItem("regIX", "IX", r.ix, [
          new RegisterItem("regXH", "IXH", r.ix >> 8, [], 2),
          new RegisterItem("regXL", "IXL", r.ix & 0xff, [], 2),
        ]),
        new RegisterItem("regIY", "IY", r.iy, [
          new RegisterItem("regYH","IYH", r.iy >> 8, [], 2),
          new RegisterItem("regYL", "IYL", r.iy & 0xff, [], 2),
        ]),
        new RegisterItem("regWZ", "WZ", r.wz),
      ];
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
