<script>
  // ==========================================================================
  // The panel that displays the ZX Spectrum emulator with its overlays

  import { onMount, tick, afterUpdate } from "svelte";
  import { createRendererProcessStateAware } from "../rendererProcessStore";
  import { emulatorSetZoomAction } from "../../shared/state/redux-emulator-state";
  import { getSpectrumEngine } from "../spectrum-loader";
  import { pcKeyNames, currentKeyMappings } from "../spectrum/spectrum-keys";

  import ExecutionStateOverlay from "./ExecutionStateOverlay.svelte";
  import BeamOverlay from "./BeamOverlay.svelte";

  // --- We need to be awae of state changes
  const stateAware = createRendererProcessStateAware("emulatorPanelState");

  // --- References to the HTML elements of this component
  let panelEl;
  let screenEl;
  let shadowScreenEl;

  // --- The ZX Spectrum virtual machine
  let spectrum;

  // --- ZX Spectrum screen dimensions
  let screenWidth = 0;
  let screenHeight = 0;

  // --- Dimensions of the canvas displaying the ZX Spectrum screen
  let canvasWidth;
  let canvasHeight;

  // --- Dimensions of this panel
  let clientWidth;
  let clientHeight;

  // --- Buffers for holding screen data
  let imageBuffer;
  let imageBuffer8;
  let pixelData;

  // --- Text and visibility of execution status overlay
  let overlay = "Not started yet";
  let overlayHidden = false;

  // --- Current execution state
  let execState;

  // --- Should the beam position be displayed?
  let showBeam;
  let tactsInFrame;
  let tactToDisplay;
  let keyboardVisible;

  // --- Bounding renctangle information to display beam position
  let panelRectangle;
  let screenRectangle;

  // --- Initialize the component when mounted
  onMount(async () => {
    // --- Access the spectrum engine
    spectrum = await getSpectrumEngine();

    // --- Refresh the screen when there's a new frame
    spectrum.screenRefreshed.on(() => displayScreenData());

    // --- Change the execution state overlay text on change
    spectrum.executionStateChanged.on((arg) => {
      execState = arg.newState;
      switch (arg.newState) {
        case 1:
          overlay = arg.isDebug ? "Debug mode" : "";
          break;
        case 3:
          overlay = "Paused";
          const state = spectrum.getMachineState();
          tactsInFrame = state.tactsInFrame;
          tactToDisplay = state.lastRenderedUlaTact % tactsInFrame;
          displayScreenData();
          break;
        case 5:
          overlay = "Stopped";
          break;
        default:
          overlay = "";
          break;
      }
    });

    // --- Catch the state of beam position indicator visibility
    stateAware.stateChanged.on((state) => {
      showBeam = state.beamPosition;
      keyboardVisible = state.keyboardPanel;
    });

    // --- Calculate the initial dimensions
    screenWidth = spectrum.screenWidth;
    screenHeight = spectrum.screenHeight;
    calculateDimensions(clientWidth, clientHeight, screenWidth, screenHeight);
    calculateBoundariesForBeam();

    // --- Prepare displayiong the screen and playing the sound
    configureScreen();
    configureSound();
  });

  // --- Respond to panel size changes
  $: {
    calculateDimensions(clientWidth, clientHeight, screenWidth, screenHeight);
  }

  afterUpdate(() => {
    calculateBoundariesForBeam();
  });

  // --- Calculates boundaries for the beam position
  function calculateBoundariesForBeam() {
    if (!screenEl) return;

    screenRectangle = screenEl.getBoundingClientRect();
    panelRectangle = panelEl.getBoundingClientRect();
  }

  // --- Setup the screen buffers
  function configureScreen() {
    const dataLen = screenWidth * screenHeight * 4;
    imageBuffer = new ArrayBuffer(dataLen);
    imageBuffer8 = new Uint8Array(imageBuffer);
    pixelData = new Uint32Array(imageBuffer);
  }

  // --- Setup the audio sample rate
  function configureSound() {
    const audioCtx = new AudioContext();
    const sampleRate = audioCtx.sampleRate;
    audioCtx.close();
    spectrum.setAudioSampleRate(sampleRate);
  }

  // --- Calculate the dimensions so that the ZX Spectrum display fits the screen
  function calculateDimensions(clientWidth, clientHeight, width, height) {
    let widthRatio = Math.floor((clientWidth - 8) / width);
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((clientHeight - 8) / height);
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    stateAware.dispatch(emulatorSetZoomAction(ratio)());
    canvasWidth = width * ratio;
    canvasHeight = height * ratio;

    if (!shadowScreenEl || !screenEl) return;
    shadowScreenEl.width = width;
    shadowScreenEl.height = height;
    const shadowCtx = shadowScreenEl.getContext("2d");
    if (shadowCtx) {
      shadowCtx.canvas.width = width;
      shadowCtx.canvas.height = height;
    }
    const screenCtx = screenEl.getContext("2d");
    if (screenCtx) {
      screenCtx.canvas.width = width * ratio;
      screenCtx.canvas.height = height * ratio;
    }
  }

  // --- Displays the ZX Spectrum screen
  function displayScreenData() {
    const shadowCtx = shadowScreenEl.getContext("2d");
    if (!shadowCtx) return;
    const shadowImageData = shadowCtx.getImageData(
      0,
      0,
      shadowScreenEl.width,
      shadowScreenEl.height
    );
    const screenCtx = screenEl.getContext("2d");
    let j = 0;

    const screenData = spectrum.getScreenData();
    for (let i = 0; i < screenWidth * screenHeight; i++) {
      pixelData[j++] = screenData[i];
    }
    shadowImageData.data.set(imageBuffer8);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(
        shadowScreenEl,
        0,
        0,
        screenEl.width,
        screenEl.height
      );
    }
  }

  // --- Handles key presses
  function handleKey(e, status) {
    const key = pcKeyNames.get(e.code);
    if (!key) return;
    const mapping = currentKeyMappings.get(key);
    if (mapping) {
      spectrum.setKeyStatus(mapping.zxPrimary, status);
      if (mapping.zxSecondary) {
        spectrum.setKeyStatus(mapping.zxSecondary, status);
      }
    }
  }
</script>

<style>
  .emulator-panel {
    display: flex;
    overflow: hidden;
    flex-shrink: 1;
    flex-grow: 1;
    height: 100%;
    width: 100%;
    /*padding: 8px 12px; */
    background-color: var(--emulator-background-color);
    box-sizing: border-box;
    justify-content: center;
    align-items: center;
    outline: none;
  }

  .emulator-screen {
    background-color: yellow;
  }
</style>

<svelte:window
  on:keydown={(e) => handleKey(e, true)}
  on:keyup={(e) => handleKey(e, false)} />
<div
  tabindex="-1"
  class="emulator-panel"
  bind:clientWidth
  bind:clientHeight
  bind:this={panelEl}>
  <div
    class="emulator-screen"
    style={`width:${canvasWidth}px; height:${canvasHeight}px`}
    on:click={() => (overlayHidden = false)}>
    {#if execState === 3 && showBeam}
      <BeamOverlay
        {panelRectangle}
        {screenRectangle}
        width={clientWidth}
        height={clientHeight}
        {tactToDisplay} />
    {/if}
    {#if !overlayHidden}
      <ExecutionStateOverlay
        text={overlay}
        on:hide={() => (overlayHidden = true)} />
    {/if}
    <canvas bind:this={screenEl} />
    <canvas bind:this={shadowScreenEl} style="display:none" />
  </div>
</div>
