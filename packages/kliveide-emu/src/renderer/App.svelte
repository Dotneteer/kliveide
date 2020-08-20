<script>
  // ==========================================================================
  // This copmonent represents the entire application
  // Responsibilities:
  // * Managing themes and theme changes
  import Toolbar from "./controls/Toolbar.svelte";
  import Statusbar from "./controls/Statusbar.svelte";
  import MainCanvas from "./controls/MainCanvas.svelte";

  import { onMount, onDestroy } from "svelte";
  import { themeStore } from "./stores/theme-store";
  import { darkTheme } from "./themes/dark-theme";

  import { getSpectrumEngine, changeSpectrumEngine } from "./spectrum-loader";
  import { createRendererProcessStateAware } from "./rendererProcessStore";
  import { emulatorSetupTypeAction } from "../shared/state/redux-emulator-state";

  // --- Manage themes and theme changes
  let themeStyle = "";
  let themeClass = "";
  let updatingMachineType;

  // --- Respond to theme changes
  const unsubscribe = themeStore.subscribe((theme) => {
    let styleValue = "";
    for (const key in theme.properties) {
      styleValue += `${key}:${theme.properties[key]};`;
    }
    themeStyle = styleValue.trimRight();
    themeClass = `${theme.name}-theme`;
  });

  // --- The ZX Spectrum machine
  let spectrum;
  onMount(async () => {
    spectrum = await getSpectrumEngine();
  });

  // --- Cleanup subscriptions
  onDestroy(unsubscribe);

  // --- Start with the dark theme
  themeStore.registerTheme(darkTheme);
  themeStore.setTheme("dark");

  const stateAware = createRendererProcessStateAware();
  stateAware.stateChanged.on(async (state) => {
    // --- Change the UI according to state change
    const emuUi = state.emulatorPanelState;
    if (
      emuUi.requestedType &&
      emuUi.requestedType !== emuUi.currentType &&
      !updatingMachineType
    ) {
      updatingMachineType = true;
      try {
        // --- Update the machine type
        await changeSpectrumEngine(emuUi.requestedType);
        stateAware.dispatch(emulatorSetupTypeAction(emuUi.requestedType)());
        // --- Allow redux message cycle to loop back to the renderer
        await new Promise((r) => setTimeout(r, 100));
        spectrum = await getSpectrumEngine();
      } finally {
        updatingMachineType = false;
      }
    }
  });
</script>

<style>
  main {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    height: 100%;
    flex-shrink: 0;
    flex-grow: 0;
    user-select: none;
    background-color: var(--shell-canvas-background-color);
    outline: none;
  }
</style>

<main style={themeStyle} class={themeClass} tabindex="0">
  <Toolbar {spectrum} />
  <MainCanvas {spectrum} />
  <Statusbar {spectrum} />
</main>
