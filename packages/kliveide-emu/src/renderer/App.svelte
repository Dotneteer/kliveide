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

  import { getVmEngine, changeVmEngine, setEmulatorAppConfig } from "./machine-loader";
  import { createRendererProcessStateAware } from "./rendererProcessStore";
  import { emulatorSetupTypeAction } from "../shared/state/redux-emulator-state";
  import { sendMessageToMain } from "../shared/messaging/renderer-to-main-comm";
  import "./rendererMessageProcessor";

  // --- Manage themes and theme changes
  let themeStyle = "";
  let themeClass = "";
  let updatingMachineType;
  let statusbarVisible;

  // --- Respond to theme changes
  const unsubscribe = themeStore.subscribe((theme) => {
    let styleValue = "";
    for (const key in theme.properties) {
      styleValue += `${key}:${theme.properties[key]};`;
    }
    themeStyle = styleValue.trimRight();
    themeClass = `${theme.name}-theme`;
  });

  // --- The virtual machine instance
  let vmEngine;
  onMount(async () => {
    // --- Create the virtual machine engine
    vmEngine = await getVmEngine();

    // --- Sign that the rendered has been started. The response
    // --- contains the application configuration, save it
    const configResponse = await sendMessageToMain({ type: "rendererStarted" });
    setEmulatorAppConfig(configResponse.config);
  });

  // --- Cleanup subscriptions
  onDestroy(unsubscribe);

  // --- Start with the dark theme
  themeStore.registerTheme(darkTheme);
  themeStore.setTheme("dark");

  // --- Prepare to watch application state changes
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
        await changeVmEngine(emuUi.requestedType);
        stateAware.dispatch(emulatorSetupTypeAction(emuUi.requestedType)());
        // --- Allow redux message cycle to loop back to the renderer
        await new Promise((r) => setTimeout(r, 100));
        vmEngine = await getVmEngine();
      } finally {
        updatingMachineType = false;
      }
    }
    statusbarVisible = emuUi.statusbar;
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
  <Toolbar {vmEngine} />
  <MainCanvas {vmEngine} />
  {#if statusbarVisible}
    <Statusbar {vmEngine} />
  {/if}
</main>
