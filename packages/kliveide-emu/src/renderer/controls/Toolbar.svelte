<script>
  // ==========================================================================
  // The singleton toolbar of the application

  import { onDestroy } from "svelte";
  import ToolbarIconButton from "./ToolbarIconButton.svelte";
  import ToolbarSeparator from "./ToolbarSeparator.svelte";

  import { themeStore } from "../stores/theme-store";
  import { createRendererProcessStateAware } from "../rendererProcessStore";
  import {
    emulatorToggleKeyboardAction,
    emulatorToggleBeamPositionAction,
    emulatorToggleFastLoadAction,
    emulatorMuteAction,
    emulatorUnmuteAction,
  } from "../../shared/state/redux-emulator-state";

  // --- The virtual machine instance
  export let vmEngine;
  export let vmEngineError;

  // --- We change Titlebar colors as the app focus changes
  let backgroundColor;
  let keyboardDisplayed;
  let beamPositionEnabled;
  let fastLoadEnabled;
  let isLoading;
  let muted;
  let extraFeatures = [];

  calculateColors(true); // --- Default: the app has the focus

  let executionState = 0;

  // --- Respond to the event when app focus changes
  const stateAware = createRendererProcessStateAware();
  stateAware.stateChanged.on(async (state) => {
    // --- Change the UI according to state change
    const emuUi = state.emulatorPanelState;
    if (emuUi) {
      keyboardDisplayed = emuUi.keyboardPanel;
      beamPositionEnabled = emuUi.beamPosition;
      fastLoadEnabled = emuUi.fastLoad;
      isLoading = emuUi.isLoading;
      muted = emuUi.muted;
    }
    calculateColors(state.appHasFocus);
  });

  // --- Watch the execution state change of the virtual machine
  $: {
    if (vmEngine) {
      extraFeatures = vmEngine.z80Machine.getExtraMachineFeatures();
      vmEngine.executionStateChanged.on(({ newState }) => {
        executionState = newState;
      });
    }
  }

  // --- Cleanup subscriptions
  onDestroy(() => {
    if (stateAware) {
      stateAware.dispose();
    }
    if (vmEngine) {
      vmEngine.dispose();
    }
  });

  // --- Calculate colors according to focus state
  function calculateColors(focused) {
    let propName = focused
      ? "--toolbar-active-background-color"
      : "--toolbar-inactive-background-color";
    backgroundColor = themeStore.getProperty(propName);
  }
</script>

<style>
  .toolbar {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    height: 40px;
    width: 100%;
    padding: 0px 4px;
    background-color: var(--toolbar-background-color);
    box-sizing: border-box;
    align-items: center;
    justify-content: start;
    font-size: 0.9em;
  }
</style>

{#if vmEngine}
  <div class="toolbar" style="background-color:{backgroundColor}">
    <ToolbarIconButton
      iconName="play"
      fill="lightgreen"
      title="Start"
      enable={!vmEngineError && (executionState === 0 || executionState === 3 || executionState === 5)}
      on:clicked={async () => await vmEngine.start()} />
    <ToolbarIconButton
      iconName="pause"
      fill="lightblue"
      title="Stop"
      enable={executionState === 1}
      on:clicked={async () => await vmEngine.pause()} />
    <ToolbarIconButton
      iconName="stop"
      fill="orangered"
      title="Pause"
      enable={executionState === 1 || executionState === 3}
      on:clicked={async () => await vmEngine.stop()} />
    <ToolbarIconButton
      iconName="restart"
      fill="lightgreen"
      title="Reset"
      size="22"
      highlightSize="26"
      enable={!vmEngineError && (executionState === 1 || executionState === 3)}
      on:clicked={async () => await vmEngine.restart()} />
    <ToolbarSeparator />
    <ToolbarIconButton
      iconName="debug"
      fill="lightgreen"
      title="Debug"
      size="20"
      highlightSize="24"
      enable={!vmEngineError && (executionState === 0 || executionState === 3 || executionState === 5)}
      on:clicked={async () => await vmEngine.startDebug()} />
    <ToolbarIconButton
      iconName="step-into"
      fill="lightblue"
      title="Step into"
      enable={!vmEngineError && executionState === 3}
      on:clicked={async () => await vmEngine.stepInto()} />
    <ToolbarIconButton
      iconName="step-over"
      fill="lightblue"
      title="Step over"
      enable={!vmEngineError && executionState === 3}
      on:clicked={async () => await vmEngine.stepOver()} />
    <ToolbarIconButton
      iconName="step-out"
      fill="lightblue"
      title="Step out"
      enable={!vmEngineError && executionState === 3}
      on:clicked={async () => await vmEngine.stepOut()} />
    <ToolbarSeparator />
    <ToolbarIconButton
      iconName="keyboard"
      title="Toggle keyboard"
      highlightSize="32"
      selected={keyboardDisplayed}
      on:clicked={() => {
        stateAware.dispatch(emulatorToggleKeyboardAction());
      }} />
    <ToolbarSeparator />
    {#if extraFeatures.includes('UlaDebug')}
      <ToolbarIconButton
        iconName="beam-position"
        fill="#ff80ff"
        title="Show ULA position"
        selected={beamPositionEnabled}
        on:clicked={() => {
          stateAware.dispatch(emulatorToggleBeamPositionAction());
        }} />
      <ToolbarSeparator />
    {/if}
    {#if extraFeatures.includes('Sound')}
      {#if muted}
        <ToolbarIconButton
          iconName="unmute"
          title="Unmute sound"
          on:clicked={() => {
            stateAware.dispatch(emulatorUnmuteAction());
          }} />
      {:else}
        <ToolbarIconButton
          iconName="mute"
          title="Mute sound"
          on:clicked={() => {
            stateAware.dispatch(emulatorMuteAction());
          }} />
      {/if}
      <ToolbarSeparator />
    {/if}
    {#if extraFeatures.includes('Tape')}
      <ToolbarIconButton
        iconName="rocket"
        title="Fast LOAD mode"
        selected={fastLoadEnabled}
        on:clicked={() => {
          stateAware.dispatch(emulatorToggleFastLoadAction());
        }} />
      <ToolbarIconButton
        iconName="reverse-tape"
        title="Rewind the tape"
        enable={!isLoading}
        on:clicked={() => vmEngine.initTapeContents('Tape rewound')} />
      <ToolbarSeparator />
    {/if}
  </div>
{/if}
