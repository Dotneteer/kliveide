import {
  FlagItem,
  RegisterItem,
  TreeItemWithChildren,
} from "../views/hw-registers";
import { ThemeIcon, TreeItem, TreeItemCollapsibleState } from "vscode";
import {
  CambridgeZ88MachineState,
  MachineState,
} from "../shared/machines/machine-state";
import { Z80MachineViewProviderBase } from "./Z80MachineViewProviderBase";

/**
 * This class implements a view provider for a Cambridge Z88 model
 */
export class Cz88ViewProvider extends Z80MachineViewProviderBase {
  /**
   * Get ZX Spectrum 128 extra diagnostics information
   * @param state Current machine state
   */
  async getHardwareRegisters(state: MachineState): Promise<TreeItem[]> {
    const cz88State = state as CambridgeZ88MachineState;
    const com = cz88State.COM;
    const int = cz88State.INT;
    const sta = cz88State.STA;
    const z80Items = await super.getHardwareRegisters(state);
    const cz88Items: TreeItem[] = [
      new PagingRootItem(cz88State),
      new RtcRootItem(cz88State),
      new ScreenRootItem(cz88State),
      new RegisterItem(
        "BCOM",
        "COM",
        com,
        [
          new FlagItem("SRUN", "SRUN", !!(com & 0x80), "clear", "set"),
          new FlagItem("SBIT", "SBIT", !!(com & 0x40), "clear", "set"),
          new FlagItem("OVERP", "OVERP", !!(com & 0x20), "clear", "set"),
          new FlagItem("RESTIM", "RESTIM", !!(com & 0x10), "clear", "set"),
          new FlagItem("PROGRAM", "PROGRAM", !!(com & 0x08), "clear", "set"),
          new FlagItem("RAMS", "RAMS", !!(com & 0x04), "Bank 0", "Bank $20"),
          new FlagItem("VPPON", "VPPON", !!(com & 0x02), "off", "on"),
          new FlagItem("LCDON", "LCDON", !!(com & 0x01), "off", "on"),
        ],
        2
      ),
      new RegisterItem(
        "BINT",
        "INT",
        int,
        [
          new FlagItem("KWAIT", "KWAIT", !!(int & 0x80), "clear", "set"),
          new FlagItem("A19", "A19", !!(int & 0x40), "clear", "set"),
          new FlagItem("FLAP", "FLAP", !!(int & 0x20), "disabled", "enabled"),
          new FlagItem("UART", "UART", !!(int & 0x10), "disabled", "enabled"),
          new FlagItem("BTL", "BTL", !!(int & 0x08), "disabled", "enabled"),
          new FlagItem("KEY", "KEY", !!(int & 0x04), "disabled", "enabled"),
          new FlagItem("TIME", "TIME", !!(int & 0x02), "disabled", "enabled"),
          new FlagItem("GINT", "GINT", !!(int & 0x01), "disabled", "enabled"),
        ],
        2
      ),
      new RegisterItem(
        "BSTA",
        "STA",
        sta,
        [
          new FlagItem("FLAOPEN", "FLAOPEN", !!(sta & 0x80), "closed", "open"),
          new FlagItem("SA19", "A19", !!(sta & 0x40), "clear", "set"),
          new FlagItem("SFLAP", "FLAP", !!(sta & 0x20), "clear", "set"),
          new FlagItem("SUART", "UART", !!(sta & 0x10), "clear", "set"),
          new FlagItem("SBTL", "BTL", !!(sta & 0x08), "clear", "set"),
          new FlagItem("SKEY", "KEY", !!(sta & 0x04), "clear", "set"),
          new FlagItem("STIME", "TIME", !!(sta & 0x01), "passive", "active"),
        ],
        2
      ),
      new RegisterItem(
        "TSTA",
        "TSTA",
        cz88State.TSTA,
        [
        ],
        2
      ),
    ];
    z80Items.push(...cz88Items);
    return z80Items;
  }
}

/**
 * Represents the Cambridge Z88 memory paging state
 */
export class PagingRootItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: CambridgeZ88MachineState) {
    super("Memory Paging", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new RegisterItem("SR0", "SR0", state.SR0, [
        new RegisterItem("SR0L", "SR0L Offset", state.s0OffsetL),
        new FlagItem("SR0LT", "SR0L Type", !!state.s0FlagL, "RAM", "ROM"),
        new RegisterItem("SR0H", "SR0H Offset", state.s0OffsetH),
        new FlagItem("SR0HT", "SR0H Type", !!state.s0FlagH, "RAM", "ROM"),
      ]),
      new RegisterItem("SR1", "SR1", state.SR1, [
        new RegisterItem("SR1O", "SR1 Offset", state.s1OffsetL),
        new FlagItem("SR1T", "SR1 Type", !!state.s1FlagL, "RAM", "ROM"),
      ]),
      new RegisterItem("SR2", "SR2", state.SR2, [
        new RegisterItem("SR2O", "SR2 Offset", state.s2OffsetL),
        new FlagItem("SR2T", "SR2 Type", !!state.s2FlagL, "RAM", "ROM"),
      ]),
      new RegisterItem("SR3", "SR3", state.SR3, [
        new RegisterItem("SR3O", "SR3 Offset", state.s3OffsetL),
        new FlagItem("SR3T", "SR3 Type", !!state.s3FlagL, "RAM", "ROM"),
      ]),
    ];
  }
}

/**
 * Represents the Cambridge Z88 RTC state
 */
export class RtcRootItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: CambridgeZ88MachineState) {
    super("Real Time Clock", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new RegisterItem("TIM0", "TIM0", state.TIM0),
      new RegisterItem("TIM1", "TIM1", state.TIM1),
      new RegisterItem("TIM2", "TIM2", state.TIM2),
      new RegisterItem("TIM3", "TIM3", state.TIM3),
      new RegisterItem("TIM4", "TIM4", state.TIM4),
      new FlagItem(
        "TSTA-TICK",
        "TSTA:TICK",
        !!(state.TSTA & 0x01),
        "clear",
        "set"
      ),
      new FlagItem(
        "TMK-TICK",
        "TMK:TICK",
        !!(state.TMK & 0x01),
        "disabled",
        "enabled"
      ),
      new FlagItem(
        "TSTA-SEC",
        "TSTA:SEC",
        !!(state.TSTA & 0x02),
        "clear",
        "set"
      ),
      new FlagItem(
        "TMK-SEC",
        "TMK:SEC",
        !!(state.TMK & 0x02),
        "disabled",
        "enabled"
      ),
      new FlagItem(
        "TSTA-MIN",
        "TSTA:MIN",
        !!(state.TSTA & 0x04),
        "clear",
        "set"
      ),
      new FlagItem(
        "TMK-MIN",
        "TMK:MIN",
        !!(state.TMK & 0x04),
        "disabled",
        "enabled"
      ),
    ];
  }
}

/**
 * Represents the Cambridge Z88 RTC state
 */
export class ScreenRootItem extends TreeItem implements TreeItemWithChildren {
  children: TreeItem[] = [];
  constructor(state: CambridgeZ88MachineState) {
    super("Screen", TreeItemCollapsibleState.Collapsed);
    this.iconPath = new ThemeIcon("folder");
    this.children = [
      new RegisterItem("PB0", "PB0", state.PB0),
      new RegisterItem("PB1", "PB1", state.PB1),
      new RegisterItem("PB2", "PB2", state.PB2),
      new RegisterItem("PB3", "PB3", state.PB3),
      new RegisterItem("SBF", "SBF", state.SBF),
      new RegisterItem("SCW", "SCW", state.SCW),
      new RegisterItem("SCH", "SCH", state.SCH),
    ];
  }
}
