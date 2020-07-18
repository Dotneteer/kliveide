<script>
  // ==========================================================================
  // The singleton toolbar of the application

  import { onMount } from "svelte";
  import ToolbarIconButton from "./ToolbarIconButton.svelte";
  import ToolbarSeparator from "./ToolbarSeparator.svelte";

  import { themeStore } from "../stores/theme-store";
  import { createRendererProcessStateAware } from "../rendererProcessStore";
  import {
    keyboardShowAction,
    keyboardHideAction
  } from "../../shared/state/redux-keyboard-state";
  import { getSpectrumEngine } from "../spectrum-loader";

  // --- We change Titlebar colors as the app focus changes
  let backgroundColor;
  let keyboardDisplayed;
  calculateColors(true); // --- Default: the app has the focus

  let spectrum;
  let executionState = 0;

  // --- Respond to the event when app focus changes
  const stateAware = createRendererProcessStateAware();
  stateAware.onStateChanged.on(state => {
    keyboardDisplayed = state.keyboardPanelState.visible;
    calculateColors(state.appHasFocus);
  });

  onMount(async () => {
    spectrum = await getSpectrumEngine();
    spectrum.executionStateChanged.on(({ newState }) => executionState = newState);
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
    on:clicked={() => spectrum.start()} />
  <ToolbarIconButton
    iconName="pause"
    fill="lightblue"
    title="Stop"
    enable={executionState === 1}
    on:clicked={async () => spectrum.pause()} />
  <ToolbarIconButton
    iconName="stop"
    fill="orangered"
    title="Pause"
    enable={executionState === 1 || executionState === 3} 
    on:clicked={async() => spectrum.stop() }/>
  <ToolbarIconButton
    iconName="restart"
    fill="lightgreen"
    title="Reset"
    size="22"
    highlightSize="26"
    enable={executionState === 1 || executionState === 3} />
  <ToolbarSeparator />
  <ToolbarIconButton
    iconName="debug"
    fill="lightgreen"
    title="Debug"
    size="20"
    highlightSize="24"
    enable={executionState === 0 || executionState === 3 || executionState === 5} 
    on:clicked={() => spectrum.startDebugging()} />
  <ToolbarIconButton
    iconName="step-into"
    fill="lightblue"
    title="Step into"
    enable={executionState === 3} />
  <ToolbarIconButton
    iconName="step-over"
    fill="lightblue"
    title="Step over"
    enable={executionState === 3} />
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
      stateAware.dispatch(keyboardDisplayed ? keyboardHideAction() : keyboardShowAction());
    }} />
  <ToolbarSeparator />
  <ToolbarIconButton
    iconName="shadow-screen"
    fill="#ff80ff"
    title="Toggle shadow screen" />
  <ToolbarIconButton
    iconName="beam-position"
    fill="#ff80ff"
    title="Show ULA position" />
</div>
