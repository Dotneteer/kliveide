import {
  getOutputPaneService,
  getStore,
} from "@core/service-registry";
import { EmulatorPanelState } from "@state/AppState";
import { OutputPaneDescriptorBase } from "@ide/tool-area/OutputPaneService";
import { IOutputBuffer, OutputColor, VM_OUTPUT_PANE_ID } from "@abstractions/output-pane-service";
import { getEngineProxyService } from "@services/engine-proxy";

const TITLE = "Virtual Machine";

let eventCount = 0;

/**
 * Descriptor for the sample side bar panel
 */
export class VmOutputPanelDescriptor extends OutputPaneDescriptorBase {
  private _isMachineTypeSet = false;
  private _lastEmuState: EmulatorPanelState | null = null;

  constructor() {
    super(VM_OUTPUT_PANE_ID, TITLE);
    const outputPaneService = getOutputPaneService();
    getStore().machineTypeChanged.on((type) => {
      // --- Change the execution state to "none" whenever the machine type changes
      this._isMachineTypeSet = true;
      this._lastEmuState = null;
      const pane = outputPaneService.getPaneById(VM_OUTPUT_PANE_ID);
      if (pane) {
        const buffer = pane.buffer;
        buffer.resetColor();
        buffer.writeLine();
        buffer.write("--> Virtual machine model: ");
        buffer.bold(true);
        buffer.color("bright-blue");
        buffer.write(type);
        buffer.bold(false);
        buffer.resetColor();
      }
    });
    getStore().emulatorPanelChanged.on(async (emuPanel: EmulatorPanelState) => {
      if (!this._isMachineTypeSet) {
        return;
      }
      const pane = outputPaneService.getPaneById(VM_OUTPUT_PANE_ID);
      if (pane) {
        const buffer = pane.buffer;

        // --- Check for execution state changes
        if (this._lastEmuState?.executionState !== emuPanel.executionState) {
          let newState = "";
          let color: OutputColor = "cyan";
          switch (emuPanel.executionState) {
            case 0:
              newState = "Turned off";
              break;
            case 1:
              newState = "Running";
              if (emuPanel.runsInDebug) {
                newState += " (Debug)";
              }
              color = "green";
              break;
            case 3: {
              newState = "Paused";
              const pcInfo = await getPcInfo();
              if (pcInfo) {
                newState += ` (${pcInfo})`;
              }
              break;
            }
            case 5: {
              newState = "Stopped";
              const pcInfo = await getPcInfo();
              if (pcInfo) {
                newState += ` (${pcInfo})`;
              }
              color = "bright-red";
              break;
            }
          }
          if (newState) {
            displayEntry(buffer, "Machine state: ", color, newState);
          }
        }

        // --- Check clock multiplier changes
        if (
          (this._lastEmuState?.clockMultiplier !== emuPanel.clockMultiplier &&
            emuPanel.clockMultiplier &&
            emuPanel.baseClockFrequency) ||
          !eventCount
        ) {
          displayEntry(
            buffer,
            "Clock multiplier: ",
            "bright-magenta",
            `${emuPanel.clockMultiplier}`
          );
        }

        // --- Check clock frequency changes
        if (
          (this._lastEmuState?.baseClockFrequency &&
            this._lastEmuState.baseClockFrequency !==
              emuPanel.baseClockFrequency &&
            emuPanel.clockMultiplier &&
            emuPanel.baseClockFrequency) ||
          !eventCount
        ) {
          displayEntry(
            buffer,
            "Base clock frequency: ",
            "bright-magenta",
            `${(emuPanel.baseClockFrequency / 1000000).toFixed(4)}Mhz`
          );
          displayEntry(
            buffer,
            "Clock frequency: ",
            "bright-magenta",
            `${(
              (emuPanel.baseClockFrequency * emuPanel.clockMultiplier) /
              1000000
            ).toFixed(4)}Mhz`
          );
        }

        // --- Check sound mute/unmute
        if (this._lastEmuState?.muted != emuPanel.muted) {
          displayEntry(
            buffer,
            "Sound ",
            "bright-magenta",
            emuPanel.muted ? "muted" : "unmuted"
          );
        }

        // --- Check sound level changes
        if (this._lastEmuState?.soundLevel !== emuPanel.soundLevel) {
          displayEntry(
            buffer,
            "Sound level: ",
            "bright-magenta",
            `${(100 * emuPanel.soundLevel).toFixed(0)}%`
          );
        }

        if (
          this._lastEmuState?.keyboardLayout !== emuPanel.keyboardLayout &&
          emuPanel.keyboardLayout
        ) {
          displayEntry(
            buffer,
            "Keyboard: ",
            "bright-magenta",
            emuPanel.keyboardLayout
          );
        }
      }

      this._lastEmuState = { ...emuPanel };
      eventCount++;

      // --- Get the current PC value
      async function getPcInfo(): Promise<string> {
        const cpuState = await getEngineProxyService().getMachineState();
        const pcLabel = emuPanel.frameDiagData?.pcInfo?.label ?? "PC";
        return `${pcLabel}: ${(cpuState as any)._pc
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")}`;
      }

      // --- Display the specified information entry
      function displayEntry(
        buffer: IOutputBuffer,
        label: string,
        infoColor: OutputColor,
        infoValue?: string
      ) {
        buffer.resetColor();
        buffer.writeLine();
        buffer.write(label);
        buffer.bold(true);
        buffer.color(infoColor);
        if (infoValue) {
          buffer.write(infoValue);
        }
        buffer.bold(false);
      }
    });
  }
}
