import { ideStore } from "../ide/ideStore";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { EmulatorPanelState } from "../../shared/state/AppState";
import {
  OutputColor,
  OutputPaneDescriptorBase,
  outputPaneService,
} from "../ide/tool-area/OutputPaneService";
import { engineProxy } from "../ide/engine-proxy";

const ID = "VmOutputPane";
const TITLE = "Virtual Machine";

/**
 * Descriptor for the sample side bar panel
 */
export class VmOutputPanelDescriptor extends OutputPaneDescriptorBase {
  private _lastEmuState: EmulatorPanelState | null = null;

  constructor() {
    super(ID, TITLE);
    const vmAware = new StateAwareObject<string>(ideStore, "machineType");
    vmAware.stateChanged.on((type: string) => {
      // --- Change the execution state to "none" whenever the machine type changes
      this._lastEmuState = null;
      const pane = outputPaneService.getPaneById(ID);
      if (pane) {
        const buffer = pane.buffer;
        buffer.resetColor();
        buffer.writeLine();
        buffer.write("Virtual machine model changed to ");
        buffer.bold(true);
        buffer.color("brightBlue");
        buffer.write(type);
        buffer.bold(false);
        buffer.resetColor();
      }
    });
    const emuAware = new StateAwareObject<EmulatorPanelState>(
      ideStore,
      "emulatorPanel"
    );
    emuAware.stateChanged.on(async (emuPanel: EmulatorPanelState) => {
      const pane = outputPaneService.getPaneById(ID);
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
              color = "brightRed";
              break;
            }
          }
          if (newState) {
            buffer.resetColor();
            buffer.writeLine();
            buffer.write("Machine state: ");
            buffer.bold(true);
            buffer.color(color);
            buffer.write(newState);
            buffer.bold(false);
            buffer.resetColor();
          }
        }

        // --- Check clock frequency changes
        if (this._lastEmuState?.clockMultiplier !== emuPanel.clockMultiplier) {
          buffer.resetColor();
          buffer.writeLine();
          buffer.write("CPU frequency: ");
          buffer.bold(true);
          buffer.color("brightMagenta");
          buffer.write(
            `${(
              (emuPanel.baseClockFrequency * emuPanel.clockMultiplier) /
              1000000
            ).toFixed(4)}Mhz`
          );
          buffer.bold(false);
          buffer.resetColor();
        }

        // --- Check sound mute/unmute
        if (this._lastEmuState?.muted != emuPanel.muted) {
          buffer.resetColor();
          buffer.writeLine();
          buffer.write("Sound ");
          buffer.bold(true);
          buffer.color("brightMagenta");
          buffer.write(emuPanel.muted ? "muted" : "unmuted");
          buffer.bold(false);
          buffer.resetColor();
        }

        // --- Check sound level changes
        if (this._lastEmuState?.soundLevel !== emuPanel.soundLevel) {
          buffer.resetColor();
          buffer.writeLine();
          buffer.write("Sound level: ");
          buffer.bold(true);
          buffer.color("brightMagenta");
          buffer.write(`${(100 * emuPanel.soundLevel).toFixed(0)}%`);
          buffer.bold(false);
          buffer.resetColor();
        }
      }

      this._lastEmuState = { ...emuPanel };

      async function getPcInfo(): Promise<string> {
        const cpuState = await engineProxy.getMachineState();
        const pcLabel = emuPanel.frameDiagData?.pcInfo?.label ?? "PC";
        return `${pcLabel}: ${(cpuState as any)._pc
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")}`;
      }
    });
  }
}
