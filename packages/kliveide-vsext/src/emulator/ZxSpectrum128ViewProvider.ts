import { FlagItem } from "../views/hw-registers";
import { RegisterItem } from "../views/hw-registers";
import { TreeItemWithChildren } from "../views/hw-registers";
import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import {
  MachineState,
  Spectrum128MachineState,
} from "../shared/machines/machine-state";
import { ZxSpectrumViewProviderBase } from "./ZxSpectrumViewProviderBase";
import { stat } from "fs";

/**
 * This class implements a view provider for a ZX Spectrum 128 model
 */
export class ZxSpectrum128ViewProvider extends ZxSpectrumViewProviderBase {
  /**
   * Override this member to provide additional hardware register
   * data
   * @param state Current machine state
   */
  async getHardwareRegisters(state: MachineState): Promise<TreeItem[]> {
    const sp128State = state as Spectrum128MachineState;
    const spectrumItems = await super.getHardwareRegisters(state);
    const sp128Items: TreeItem[] = [
      new PagingRootItem(sp128State),
      new PsgRootItem(sp128State),
    ];
    spectrumItems.push(...sp128Items);
    return spectrumItems;
  }
}

/**
 * Represents the ZX 128 memory paging state
 */
export class PagingRootItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: Spectrum128MachineState) {
    super("Memory Paging", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new FlagItem(
        "PAG",
        "Paging",
        state.memoryPagingEnabled,
        "disabled",
        "enabled"
      ),
      new FlagItem(
        "SROM",
        "ROM",
        !!state.memorySelectedRom,
        "Spectrum 128",
        "Spectrum 48"
      ),
      new RegisterItem("SBANK", "Bank", state.memorySelectedBank),
      new FlagItem(
        "SHDS",
        "Shadow Screen",
        state.memoryUseShadowScreen,
        "disabled",
        "enabled"
      ),
    ];
  }
}

/**
 * Represents the ZX 128 PSG state
 */
export class PsgRootItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: Spectrum128MachineState) {
    super("PSG (AY-3-8912)", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new ChannelItem(
        "A",
        state.psgToneAEnabled,
        state.psgNoiseAEnabled,
        state.psgEnvA,
        state.psgToneA,
        state.psgVolA,
        state.psgCntA,
        state.psgBitA
      ),
      new ChannelItem(
        "B",
        state.psgToneBEnabled,
        state.psgNoiseBEnabled,
        state.psgEnvB,
        state.psgToneB,
        state.psgVolB,
        state.psgCntB,
        state.psgBitB
      ),
      new ChannelItem(
        "C",
        state.psgToneCEnabled,
        state.psgNoiseCEnabled,
        state.psgEnvC,
        state.psgToneC,
        state.psgVolC,
        state.psgCntC,
        state.psgBitC
      ),
      new RegisterItem("NSEED", "Noise Seed", state.psgNoiseSeed),
      new RegisterItem("NFREQ", "Noise Frequency", state.psgNoiseSeed),
      new RegisterItem("NCNT", "Noise Counter", state.psgCntNoise),
      new FlagItem("NSMP", "Noise Sample", state.psgBitNoise, "low", "high"),
      new RegisterItem("ESTY", "Env. Style", state.psgEnvStyle),
      new RegisterItem("EFREQ", "Env. Frequency", state.psgEvnFreq),
      new RegisterItem("ECNT", "Env. Counter", state.psgCntEnv),
      new RegisterItem("EPOS", "Env. Position", state.psgPosEnv),
    ];
  }
}

/**
 * Represents the ZX 128 PSG state
 */
export class ChannelItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(
    ch: string,
    toneEnabled: boolean,
    noiseEnabled: boolean,
    envEnabled: boolean,
    tone: number,
    volume: number,
    counter: number,
    sample: boolean
  ) {
    super(`Channel ${ch}`, TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("settings");
    this.children = [
      new FlagItem(
        `TEN${ch}`,
        `Tone ${ch}`,
        toneEnabled,
        "disabled",
        "enabled"
      ),
      new FlagItem(
        `NOI${ch}`,
        `Noise ${ch}`,
        noiseEnabled,
        "disabled",
        "enabled"
      ),
      new FlagItem(
        `ENV${ch}`,
        `Envelope ${ch}`,
        envEnabled,
        "disabled",
        "enabled"
      ),
      new RegisterItem(`FREQ${ch}`, `Frequency ${ch}`, tone),
      new RegisterItem(`VOL${ch}`, `Volume ${ch}`, volume),
      new RegisterItem(`CNT ${ch}`, `Counter ${ch}`, counter),
      new FlagItem(`SMP${ch}`, `Sample ${ch}`, sample, "high", "low"),
    ];
  }
}
