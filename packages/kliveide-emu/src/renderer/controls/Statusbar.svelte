<script>
  // ==========================================================================
  // The coomponent that displays the emulator's status bar

  import { getVersion } from "../../version";
  import { createRendererProcessStateAware } from "../rendererProcessStore";

  import SvgIcon from "./SvgIcon.svelte";
  import { themeStore } from "../stores/theme-store";

  // --- The virtual machine instance
  export let vmEngine;

  // --- We need to be aware of state changes
  const ideConnectStateAware = createRendererProcessStateAware("ideConnection");
  const stateAware = createRendererProcessStateAware();

  // --- Apply theme
  const fillValue = themeStore.getProperty("--statusbar-foreground-color");

  // --- Display this version number
  const version = getVersion();

  // --- Indicates if the IDE is connected
  let ideConnected = false;

  // --- The value of PC
  let PC = 0;
  let cpuFreq = 1;

  // --- Connect to the virtual machine whenever that changes
  $: {
    if (vmEngine) {
      vmEngine.screenRefreshed.on(onScreenRefreshed);
    }
  }

  // --- Catch the state of IDE connection changes
  ideConnectStateAware.stateChanged.on((state) => {
    ideConnected = state.connected;
  });

  // --- Catch the emulator state changes
  stateAware.stateChanged.on(async (state) => {
    // --- Change the UI according to state change
    const emuUi = state.emulatorPanelState;
    if (emuUi) {
      const state = vmEngine.z80Machine.getMachineState();
      PC = state.pc;
      cpuFreq = (emuUi.clockMultiplier * state.baseClockFrequency / 1000000).toFixed(4);
    }
  });

  // --- Initialize frame counters
  let lastEngineTimeStr = "---";
  let avgEngineTimeStr = "---";
  let lastFrameTimeStr = "---";
  let avgFrameTimeStr = "---";
  let renderedFramesStr = "---";

  // --- Calculate counters on every screen refresh
  function onScreenRefreshed() {
    PC = vmEngine.z80Machine.getMachineState().pc;
    const {
      lastEngineTime,
      avgEngineTime,
      lastFrameTime,
      avgFrameTime,
      renderedFrames,
    } = vmEngine.getFrameTimes();
    lastEngineTimeStr = lastEngineTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    avgEngineTimeStr = avgEngineTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    lastFrameTimeStr = lastFrameTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    avgFrameTimeStr = avgFrameTime.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    renderedFramesStr = renderedFrames.toLocaleString();
  }
</script>

<style>
  .statusbar {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    height: 28px;
    width: 100%;
    padding: 8px 8px;
    background-color: var(--statusbar-background-color);
    box-sizing: border-box;
    align-content: start;
    align-items: center;
    justify-items: start;
    font-size: 0.9em;
  }

  .label {
    margin: 0px 8px;
    color: var(--statusbar-foreground-color);
  }

  .section {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    margin: 0 4px;
    align-content: flex-start;
    align-items: center;
    justify-items: start;
  }

  .placeholder {
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;
  }
</style>

<div class="statusbar">
  <div class="section" title="Engine time per frame (average/last)">
    <SvgIcon iconName="vm-running" width="16" height="16" fill={fillValue} />
    {#if vmEngine}
      <span class="label">{avgEngineTimeStr} / {lastEngineTimeStr}</span>
    {/if}
  </div>
  <div class="section" title="Total time per frame (average/last)">
    <SvgIcon iconName="vm" width="16" height="16" fill={fillValue} />
    {#if vmEngine}
      <span class="label">{avgFrameTimeStr} / {lastFrameTimeStr}</span>
    {/if}
  </div>
  <div class="section" title="# of frames rendered since start">
    <SvgIcon iconName="window" width="16" height="16" fill={fillValue} />
    {#if vmEngine}<span class="label">{renderedFramesStr}</span>{/if}
  </div>
  <div class="section" title="The value of Program Counter">
    <span class="label">PC: ${PC.toString(16)
        .toUpperCase()
        .padStart(4, '0')}</span>
  </div>
  <div class="placeholder" />
  {#if ideConnected}
    <div class="section"><span class="label">IDE connected</span></div>
  {/if}
  {#if vmEngine}
    <div class="section">
      <span class="label">{vmEngine.z80Machine.displayName}</span>
    </div>
    <div class="section">
      <span class="label">CPU: {cpuFreq}Mhz</span>
    </div>
  {/if}
  <div class="section"><span class="label">Klive v{version}</span></div>
</div>
