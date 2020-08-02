import * as vscode from "vscode";
import { RegisterData } from "../emulator/communicator";

export class Z80RegistersProvider implements vscode.TreeDataProvider<Register> {
  // --- Keeps register data
  private _registers: Register[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<
    Register | undefined | void
  > = new vscode.EventEmitter<Register | undefined | void>();

  /**
   * An optional event to signal that an element or root has changed.
   * This will trigger the view to update the changed element/root and its children recursively (if shown).
   * To signal that root has changed, do not pass any argument or pass `undefined` or `null`.
   */
  readonly onDidChangeTreeData: vscode.Event<Register | undefined | void> = this
    ._onDidChangeTreeData.event;

  /**
   * Refreshes the display of register values
   * @param r Register data to display
   */
  refresh(r: RegisterData): void {
    (async () => {
      this._registers = [
        new Register("AF", r.af),
        new Register("BC", r.bc),
        new Register("DE", r.de),
        new Register("HL", r.hl),
        new Register("AF'", r.af_),
        new Register("BC'", r.bc_),
        new Register("DE'", r.de_),
        new Register("HL'", r.hl_),
        new Register("PC", r.pc),
        new Register("SP", r.sp),
        new Register("I", r.i, 2),
        new Register("R", r.r, 2),
        new Register("IY", r.iy),
        new Register("IX", r.ix),
        new Register("IY", r.iy),
        new Register("WZ", r.wz),
      ];
      this._onDidChangeTreeData.fire();
    })();
  }

  /**
   * Get [TreeItem](#TreeItem) representation of the `element`
   * @param element The element for which [TreeItem](#TreeItem) representation is asked for.
   * @return [TreeItem](#TreeItem) representation of the element
   */
  getTreeItem(element: Register): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children of `element` or root if no element is passed.
   * @param element The element from which the provider gets children. Can be `undefined`.
   * @return Children of `element` or root if no element is passed.
   */
  getChildren(element?: Register): Thenable<Register[]> {
    return Promise.resolve(element ? [] : this._registers);
  }
}

/**
 * Represents a register value
 */
class Register extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public value: number,
    private readonly hexaDigits = 4,
    private readonly showDecimal = true
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
  }

  /**
   * The tooltip text when you hover over this item.
   */
  get tooltip(): string {
    return (
      this.description +
      ` (0x${this.value.toString(2).padStart(4 * this.hexaDigits, "0")})`
    );
  }

  /**
   * A human-readable string which is rendered less prominent.
   * When `true`, it is derived from [resourceUri](#TreeItem.resourceUri) and when `falsy`, it is not shown.
   */
  get description(): string {
    return `${this.label}: ${toHexa(this.value, this.hexaDigits)}${
      this.showDecimal ? " (" + this.value.toString(10) + ")" : ""
    }`;
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
