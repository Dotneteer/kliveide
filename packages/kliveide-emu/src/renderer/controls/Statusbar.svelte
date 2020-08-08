<script>
  import { onMount } from "svelte";
  import SvgIcon from "./SvgIcon.svelte";
  import { themeStore } from "../stores/theme-store";
  import { getSpectrumEngine } from "../spectrum-loader";

  const fillValue = themeStore.getProperty("--statusbar-foreground-color");

  let spectrum;
  onMount(async () => {
    spectrum = await getSpectrumEngine();
    spectrum.screenRefreshed.on(onScreenRefreshed);
  });

  let lastEngineTimeStr = "---";
  let avgEngineTimeStr = "---";
  let lastFrameTimeStr = "---";
  let avgFrameTimeStr = "---";
  function onScreenRefreshed() {
    const {
      lastEngineTime,
      avgEngineTime,
      lastFrameTime,
      avgFrameTime,
      renderedFrames,
    } = spectrum.getFrameTimes();
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
    align-content: start;
    align-items: center;
    justify-items: start;
  }
</style>

<div class="statusbar">
  <div class="section">
    <SvgIcon iconName="vm-running" width="16" height="16" fill={fillValue} />
    {#if spectrum}
      <span class="label">{avgEngineTimeStr} / {lastEngineTimeStr}</span>
    {/if}
  </div>
  <div class="section">
    <SvgIcon iconName="vm" width="16" height="16" fill={fillValue} />
    {#if spectrum}
      <span class="label">{avgFrameTimeStr} / {lastFrameTimeStr}</span>
    {/if}
  </div>
</div>
