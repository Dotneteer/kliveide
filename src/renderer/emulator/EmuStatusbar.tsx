import * as React from "react";
import { useSelector } from "react-redux";

import {
  getThemeService,
} from "@core/service-registry";

import { getVersion } from "../../version";
import { AppState } from "@state/AppState";
import { Icon } from "../../emu-ide/components/Icon";
import { Root, Gap, Section, Label } from "../../emu-ide/components/StatusbarStyles";
import { getVmEngineService } from "@ext-core/vm-engine-service";

/**
 * Represents the statusbar of the emulator
 */
export default function Statusbar() {
  // --- State selectors
  const showFrames = useSelector(
    (s: AppState) => s.emuViewOptions.showFrameInfo
  );
  const cpuFreq = useSelector(
    (s: AppState) =>
      s.emulatorPanel.clockMultiplier * s.emulatorPanel.baseClockFrequency
  );
  const vmEngineService = getVmEngineService();
  const displayName = useSelector(() =>
    vmEngineService.hasEngine
      ? vmEngineService.getEngine()?.displayName ?? ""
      : ""
  );
  const machineContext = useSelector(
    (s: AppState) => s.emulatorPanel.machineContext
  );
  const lastFrameTime = useSelector((s: AppState) =>
    s.emulatorPanel.frameDiagData.lastFrameTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  );
  const lastEngineTime = useSelector((s: AppState) =>
    s.emulatorPanel.frameDiagData.lastEngineTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  );
  const avgEngineTime = useSelector((s: AppState) =>
    s.emulatorPanel.frameDiagData.avgEngineTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  );
  const avgFrameTime = useSelector((s: AppState) =>
    s.emulatorPanel.frameDiagData.avgFrameTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })
  );
  const renderedFrames = useSelector(
    (s: AppState) => s.emulatorPanel.frameDiagData.renderedFrames
  );
  const pcInfo = useSelector(
    (s: AppState) => s.emulatorPanel.frameDiagData.pcInfo
  );

  const fillValue = getThemeService().getProperty(
    "--statusbar-foreground-color"
  );

  const frameInformation = [
    <Section key="1">
      <Icon iconName="vm-running" width={16} height={16} fill={fillValue} />
      <Label>
        {avgEngineTime} / {lastEngineTime}
      </Label>
    </Section>,
    <Section key="2" title="Total time per frame (average/last)">
      <Icon iconName="vm" width={16} height={16} fill={fillValue} />
      <Label>
        {avgFrameTime} / {lastFrameTime}
      </Label>
    </Section>,
    <Section key="3" title="# of frames rendered since start">
      <Icon iconName="window" width={16} height={16} fill={fillValue} />
      <Label>{renderedFrames}</Label>
    </Section>,
    <Section key="4" title="The value of Program Counter">
      <Label>
        {pcInfo?.label ?? ""}: $
        {(pcInfo?.value ?? 0).toString(16).toUpperCase().padStart(4, "0")}
      </Label>
    </Section>,
  ];
  const cpuInformation = [
    <Section key="14">
      <Label>{displayName}</Label>
    </Section>,
    <Section key="15">
      <Label>{machineContext}</Label>
    </Section>,
    <Section key="16">
      <Label>CPU: {(cpuFreq / 1000000).toFixed(4)}Mhz</Label>
    </Section>,
  ];
  return (
    <Root>
      {showFrames && frameInformation}
      <Gap />
      {vmEngineService.hasEngine && cpuInformation}
      <Section>
        <Label>Klive {getVersion()}</Label>
      </Section>
    </Root>
  );
}
