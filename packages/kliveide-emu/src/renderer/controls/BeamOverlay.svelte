<script>
  // ==========================================================================
  // Displays the beam position overlay

  import { onMount, tick } from "svelte";
  import { getSpectrumEngine } from "../spectrum-loader";

  export let panelRectangle;
  export let screenRectangle;
  export let width;
  export let height;
  export let tactToDisplay;

  // --- The ZX Spectrum virtual machine
  let spectrum;

  // --- Screen attributes
  let verticalSyncLines;
  let nonVisibleBorderTopLines;
  let borderTopLines;
  let displayLines;
  let borderBottomLines;
  let nonVisibleBorderBottomLines;
  let horizontalBlankingTime;
  let nonVisibleBorderRightTime;
  let screenLines;
  let borderLeftPixels;
  let displayWidth;
  let borderRightPixels;
  let screenWidth;
  let screenLineTime;
  let rasterLines;

  let mounted = false;

  // --- Obtain screen parameters when component is mounted
  onMount(async () => {
    // --- Access the spectrum engine
    spectrum = await getSpectrumEngine();
    const state = spectrum.getMachineState();
    verticalSyncLines = state.verticalSyncLines;
    nonVisibleBorderTopLines = state.nonVisibleBorderTopLines;
    borderTopLines = state.borderTopLines;
    displayLines = state.displayLines;
    borderBottomLines = state.borderTopLines;
    nonVisibleBorderBottomLines = state.nonVisibleBorderBottomLines;
    horizontalBlankingTime = state.horizontalBlankingTime;
    nonVisibleBorderRightTime = state.nonVisibleBorderRightTime;
    screenLines = state.screenLines;
    borderLeftPixels = state.borderLeftPixels;
    displayWidth = state.displayWidth;
    borderRightPixels = state.borderRightPixels;
    screenWidth = state.screenWidth;
    screenLineTime = state.screenLineTime;
    rasterLines = state.rasterLines;

    calculateDimensions();

    mounted = true;
  });

  // --- Display area attributes
  let dspLeft;
  let dspTop;
  let dspWidth;
  let dspHeight;

  // --- Non-visible area
  let nvLeft;
  let nvTop;
  let nvWidth;
  let nvHeight;

  // --- Sync area
  let synLeft;
  let synTop;
  let synWidth;
  let synHeight;

  // --- Beam line
  let bmLine;
  let bmLeft;
  let bmRight;
  let bmLineWidth;

  // --- Beam cross
  let bcPos;
  let bcTop;
  let bcBottom;
  let bcLineWidth;

  $: {
    (async () => {
      await tick();
      calculateDimensions();
    })(width, height, tactToDisplay);
  }

  function calculateDimensions() {
    // --- Entire viewport
    const zoom = (screenRectangle.right - screenRectangle.left) / screenWidth;

    // --- Display area
    dspLeft =
      screenRectangle.left - panelRectangle.left + zoom * borderLeftPixels;
    dspTop = screenRectangle.top - panelRectangle.top + zoom * borderTopLines;
    dspWidth = zoom * displayWidth + 1;
    dspHeight = zoom * displayLines + 1;

    // --- Non-visible area
    nvLeft = screenRectangle.left - panelRectangle.left;
    nvTop =
      screenRectangle.top -
      panelRectangle.top -
      zoom * nonVisibleBorderTopLines + 1;
    nvWidth = zoom * (screenWidth + nonVisibleBorderRightTime * 2) + 1;
    nvHeight =
      zoom *
        (screenLines + nonVisibleBorderTopLines + nonVisibleBorderBottomLines) +
      1;

    // --- Sync area
    synLeft = nvLeft;
    synTop = nvTop - zoom * verticalSyncLines + 1 ;
    synWidth = zoom * screenLineTime * 2;
    synHeight = zoom * rasterLines;

    // --- Beam line
    bmLine = synTop + zoom * (Math.floor(tactToDisplay / screenLineTime) + 1);
    bmLeft = synLeft;
    bmRight = synLeft + synWidth;
    bmLineWidth = zoom;

    // --- Beam cross
    bcPos = synLeft + zoom * 2 * Math.floor(tactToDisplay % screenLineTime);
    bcTop = bmLine - 8;
    bcBottom = bmLine + 8;
    bcLineWidth = 2 * zoom;
  }
</script>

<style>
  .overlay {
    position: absolute;
    left: 0;
    top: 0;
  }
</style>

<div class="overlay">
  {#if mounted}
  <svg {width} {height}>
    <rect
      x={dspLeft}
      y={dspTop}
      width={dspWidth}
      height={dspHeight}
      style="stroke:none; fill: rgba(255, 255, 255, 0.1)" />
    <rect
      x={nvLeft}
      y={nvTop}
      width={nvWidth}
      height={nvHeight}
      style="stroke:none; fill: rgba(255, 255, 255, 0.1)" />
    <rect
      x={synLeft}
      y={synTop}
      width={synWidth}
      height={synHeight}
      style="stroke:none; fill: rgba(255, 255, 255, 0.1)" />
    <line
      x1={bmLeft}
      y1={bmLine}
      x2={bmRight}
      y2={bmLine}
      style="stroke:rgb(255,0,128);stroke-width:{bmLineWidth}" />
      <line
      x1={bcPos}
      y1={bcTop}
      x2={bcPos}
      y2={bcBottom}
      style="stroke:rgba(255,0,128, 0.75);stroke-width:{bcLineWidth}" />
  </svg>
  {/if}
</div>
