<script>
  // ==========================================================================
  // The singleton toolbar of the application

  import { onMount } from "svelte";
  import ToolbarIconButton from "./ToolbarIconButton.svelte";
  import ToolbarSeparator from "./ToolbarSeparator.svelte";

  import { themeStore } from "../stores/theme-store";
  import {
    rendererProcessStore,
    createRendererProcessStateAware
  } from "../rendererProcessStore";
  import {
    emulatorToggleKeyboardAction,
    emulatorToggleShadowScreenAction,
    emulatorToggleBeamPositionAction,
    emulatorToggleFastLoadAction,
    emulatorMuteAction,
    emulatorUnmuteAction
  } from "../../shared/state/redux-emulator-state";
  import { emulatorSetCommandAction } from "../../shared/state/redux-emulator-command-state";
  import { getSpectrumEngine } from "../spectrum-loader";

  // --- We change Titlebar colors as the app focus changes
  let backgroundColor;
  let keyboardDisplayed;
  let shadowScreenEnabled;
  let beamPositionEnabled;
  let fastLoadEnabled;
  let muted;
  calculateColors(true); // --- Default: the app has the focus

  let spectrum;
  let executionState = 0;

  // --- Respond to the event when app focus changes
  const stateAware = createRendererProcessStateAware();
  stateAware.onStateChanged.on(async state => {
    // --- Change the UI according to state change
    const emuUi = state.emulatorPanelState;
    if (emuUi) {
      keyboardDisplayed = emuUi.keyboardPanel;
      shadowScreenEnabled = emuUi.shadowScreen;
      beamPositionEnabled = emuUi.beamPosition;
      fastLoadEnabled = emuUi.fastLoad;
      muted = emuUi.muted;
    }
    calculateColors(state.appHasFocus);
  });

  onMount(async () => {
    spectrum = await getSpectrumEngine();
    spectrum.executionStateChanged.on(({ newState }) => {
      executionState = newState;
    });
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

<div class="toolbar" style="background-color:{backgroundColor}">
  <ToolbarIconButton
    iconName="play"
    fill="lightgreen"
    title="Start"
    enable={executionState === 0 || executionState === 3 || executionState === 5}
    on:clicked={async () => await spectrum.start()} />
  <ToolbarIconButton
    iconName="pause"
    fill="lightblue"
    title="Stop"
    enable={executionState === 1}
    on:clicked={async () => await spectrum.pause()} />
  <ToolbarIconButton
    iconName="stop"
    fill="orangered"
    title="Pause"
    enable={executionState === 1 || executionState === 3}
    on:clicked={async () => await spectrum.stop()} />
  <ToolbarIconButton
    iconName="restart"
    fill="lightgreen"
    title="Reset"
    size="22"
    highlightSize="26"
    enable={executionState === 1 || executionState === 3}
    on:clicked={async () => await spectrum.restart()} />
  <ToolbarSeparator />
  <ToolbarIconButton
    iconName="debug"
    fill="lightgreen"
    title="Debug"
    size="20"
    highlightSize="24"
    enable={executionState === 0 || executionState === 3 || executionState === 5}
    on:clicked={async () => await spectrum.startDebug()} />
  <ToolbarIconButton
    iconName="step-into"
    fill="lightblue"
    title="Step into"
    enable={executionState === 3}
    on:clicked={async () => await spectrum.stepInto()} />
  <ToolbarIconButton
    iconName="step-over"
    fill="lightblue"
    title="Step over"
    enable={executionState === 3} 
    on:clicked={async () => await spectrum.stepOver()} />
  <ToolbarIconButton
    iconName="step-out"
    fill="lightblue"
    title="Step out"
    enable={executionState === 3} />
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
  <ToolbarIconButton
    iconName="shadow-screen"
    fill="#ff80ff"
    title="Toggle shadow screen"
    selected={shadowScreenEnabled}
    on:clicked={() => {
      stateAware.dispatch(emulatorToggleShadowScreenAction());
    }} />
  <ToolbarIconButton
    iconName="beam-position"
    fill="#ff80ff"
    title="Show ULA position"
    selected={beamPositionEnabled}
    on:clicked={() => {
      stateAware.dispatch(emulatorToggleBeamPositionAction());
    }} />
  <ToolbarSeparator />
  <ToolbarIconButton
    iconName="rocket"
    title="Fast LOAD mode"
    selected={fastLoadEnabled}
    on:clicked={() => {
      stateAware.dispatch(emulatorToggleFastLoadAction());
    }} />
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
</div>
