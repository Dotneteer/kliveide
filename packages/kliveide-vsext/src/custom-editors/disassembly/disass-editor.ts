import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import {
  EditorProviderBase,
  ReplacementTuple,
  ViewCommand,
} from "../editor-base";
import {
  onFrameInfoChanged,
  onMachineTypeChanged,
  onConnectionStateChanged,
} from "../../emulator/notifier";
import { communicatorInstance } from "../../emulator/communicator";
import { DisassemblyAnnotation } from "../../disassembler/annotations";
import {
  machineConfigurationInstance,
  DISASS_ANN_FILE,
} from "../../emulator/machine-config";
import {
  getAssetsFileName,
  getAssetsFileResource,
} from "../../extension-paths";
import { machineTypes } from "../../emulator/machine-info";
import {
  DisassemblyItem,
  DisassemblyOutput,
  intToX4,
  MemorySection,
  MemorySectionType,
} from "../../disassembler/disassembly-helper";
import { Z80Disassembler } from "../../disassembler/z80-disassembler";
import { DiagViewFrame } from "@shared/machines/diag-info";
import { breakpointDefinitions } from "../../emulator/breakpoints";
import { onCommandExecuted } from "../../emulator/command-handler";
import { CmdNode } from "../../command-parser/command-line-nodes";

/**
 * The annotation for the current machine
 */
const romAnnotations: (DisassemblyAnnotation | null)[] = [];

/**
 * Full annotations with a particular rom page
 */
const fullAnnotations: (DisassemblyAnnotation | null)[] = [];

/**
 * This provide implements the functionality of the Disassembly Editor
 */
export class DisassemblyEditorProvider extends EditorProviderBase {
  private static readonly viewType = "kliveide.disassemblyEditor";

  /**
   * Registers this editor provider
   * @param context Extension context
   */
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DisassemblyEditorProvider(context);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      DisassemblyEditorProvider.viewType,
      provider
    );
    return providerRegistration;
  }

  /**
   * Instantiates an editor provider
   * @param context Extension context
   */
  constructor(protected readonly context: vscode.ExtensionContext) {
    super(context);
  }

  title = "Klive Disassembly Editor";
  htmlFileName = "disassembly.html";

  /**
   * The replacements that should be carried out on the HTML contents
   * of this panel's view
   */
  getContentReplacements(): ReplacementTuple[] {
    return [
      ["stylefile", getAssetsFileResource("style.css")],
      ["jsfile", getAssetsFileResource("disass.bundle.js")],
    ];
  }

  /**
   * Resolve a custom editor for a given text resource.
   *
   * @param document Document for the resource to resolve.
   * @param webviewPanel The webview panel used to display the editor UI for this resource.
   * @param token A cancellation token that indicates the result is no longer needed.
   * @return Thenable indicating that the custom editor has been resolved.
   */
  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    super.resolveCustomTextEditor(document, webviewPanel, _token);

    // --- Take care that initial annotations are read
    if (romAnnotations.length === 0) {
      await readRomAnnotations();
    }

    // --- Watch for PC changes
    let lastPc = -1;
    this.toDispose(
      webviewPanel,
      onFrameInfoChanged((fi: DiagViewFrame) => {
        if (lastPc !== fi.pc && fi.pc !== undefined) {
          lastPc = fi.pc;
          webviewPanel.webview.postMessage({
            viewNotification: "pc",
            pc: lastPc,
          });
        }
      })
    );

    // --- Watch for breakpoint commands
    this.toDispose(
      webviewPanel,
      onCommandExecuted((cmd: CmdNode) => {
        if (cmd.type.includes("Breakpoint")) {
          this.sendBreakpointsToView();
        }
      })
    );
    

    // --- Refresh annotations whenever machine type changes
    this.toDispose(
      webviewPanel,
      onMachineTypeChanged(async () => {
        await readRomAnnotations();
        this.refreshView();
        this.refreshViewport(Date.now());
      })
    );

    // --- Refresh the view whenever connection restores
    this.toDispose(
      webviewPanel,
      onConnectionStateChanged(async (connected: boolean) => {
        if (connected) {
          this.refreshViewport(Date.now());
        }
      })
    );

    // --- Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      super.disposePanel(webviewPanel);
    });
  }

  /**
   * Process view command
   * @param panel The WebviewPanel that should process a message from its view
   * @param viewCommand Command notification to process
   */
  async processViewCommand(viewCommand: ViewCommand): Promise<void> {
    switch (viewCommand.command) {
      case "requestRefresh":
        // --- Send the refresh command to the view
        this.refreshView();
        this.refreshViewport(Date.now());
        break;
      case "requestViewportRefresh":
        this.refreshViewport(Date.now());
        break;
      case "setBreakpoint":
        breakpointDefinitions.set({
          address: (viewCommand as any).address,
        });
        await communicatorInstance.setBreakpoints(breakpointDefinitions.toArray());
        this.sendBreakpointsToView();
        break;
      case "removeBreakpoint":
        breakpointDefinitions.remove((viewCommand as any).address);
        await communicatorInstance.setBreakpoints(breakpointDefinitions.toArray());
        this.sendBreakpointsToView();
        break;
    }
  }

  /**
   * Sends the current breakpoints to the webview
   */
  protected sendBreakpointsToView(): void {
    this.panel.webview.postMessage({
      viewNotification: "breakpoints",
      breakpoints: breakpointDefinitions.toArray(),
    });
  }

  /**
   * Sends messages to the view so that can refresh itself
   */
  async refreshView(): Promise<void> {
    this.sendInitialStateToView();
    this.sendBreakpointsToView();
  }

  /**
   * Refresh the viewport of the specified panel
   * @param panel Panel to refresh
   */
  async refreshViewport(start: number): Promise<void> {
    try {
      const memContents = await communicatorInstance.getMemory();
      const bytes = new Uint8Array(Buffer.from(memContents, "base64"));
      const disassemblyOut = await disassembly(
        bytes,
        0x0000,
        0xffff,
        fullAnnotations[0]
      );

      // const fullView = await getFullDisassembly();
      this.panel.webview.postMessage({
        viewNotification: "refreshViewport",
        fullView: JSON.stringify(disassemblyOut.outputItems),
        start,
      });
    } catch (err) {
      // --- This exception in intentionally ignored
    }
  }
}

/**
 * Reads the ROM annotations of the specified machine type
 * @param machineType
 */
async function readRomAnnotations(): Promise<void> {
  // --- We need machine configuration to carry on
  const machineType = machineConfigurationInstance.configuration.type;
  const config = machineTypes[machineType];
  if (!config) {
    return;
  }

  // --- Number of ROM disassemblies to cache
  const roms = config.paging.supportsPaging ? config.paging.roms : 1;
  for (let i = 0; i < roms; i++) {
    if (romAnnotations[i] === undefined) {
      const romAnn = (romAnnotations[i] = getRomAnnotation(i));
      const fullAnnotation = getFullAnnotation();
      if (romAnn && fullAnnotation) {
        fullAnnotation.merge(romAnn);
        fullAnnotations[i] = fullAnnotation;
      } else {
        fullAnnotations[i] = romAnn;
      }
    }
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
    const annotations = machineConfigurationInstance.configuration?.annotations;
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
  annotations?: DisassemblyAnnotation | null
): Promise<DisassemblyOutput | null> {
  // --- Use the memory sections in the annotations
  const sections: MemorySection[] = annotations?.memoryMap?.sections ?? [
    new MemorySection(from, to, MemorySectionType.Disassemble),
  ];

  // --- Do the disassembly
  const disassembler = new Z80Disassembler(sections, bytes);
  const rawItems = await disassembler.disassemble(from, to);
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
