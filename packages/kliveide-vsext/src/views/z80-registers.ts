import * as vscode from "vscode";

export class Z80RegistersProvider implements vscode.TreeDataProvider<Register> {
  private _registers: Register[] = [];

  private _onDidChangeTreeData: vscode.EventEmitter<
    Register | undefined | void
  > = new vscode.EventEmitter<Register | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<Register | undefined | void> = this
    ._onDidChangeTreeData.event;

  constructor() {
    this._registers.push(
      new Register("AF", 0x0000),
      new Register("BC", 0x0001),
      new Register("DE", 0x0002),
      new Register("HL", 0x0003),
      new Register("AF'", 0x0004),
      new Register("BC'", 0x0005),
      new Register("DE'", 0x0006),
      new Register("HL'", 0x0007),
      new Register("PC", 0x0008)
    );
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Register): vscode.TreeItem {
    return element;
  }

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

  get tooltip(): string {
    return (
      this.description +
      ` (0x${this.value.toString(2).padStart(4 * this.hexaDigits, "0")})`
    );
  }

  get description(): string {
    return `${this.label}: ${toHexa(this.value, this.hexaDigits)}${
      this.showDecimal ? " (" + this.value.toString(10) + ")" : ""
    }`;
  }

  contextValue = "register";
}

function toHexa(input: number, digits: number): string {
  return input.toString(16).toUpperCase().padStart(digits, "0");
}
