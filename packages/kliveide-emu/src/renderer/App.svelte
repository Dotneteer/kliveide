<script>
  // ==========================================================================
  // This copmonent represents the entire application
  // Responsibilities:
  // * Managing themes and theme changes
  import Toolbar from "./controls/Toolbar.svelte";
  import Statusbar from "./controls/Statusbar.svelte";
  import MainCanvas from "./controls/MainCanvas.svelte";

  import { onDestroy } from "svelte";
  import { themeStore } from "./stores/theme-store";
  import { darkTheme } from "./themes/dark-theme";

  import { loadSpectrumEngine } from "./spectrum-loader";

  // --- Manage themes and theme changes
  let themeStyle = "";
  let themeClass = "";

  // -- Respond to theme changes
  const unsubscribe = themeStore.subscribe(theme => {
    let styleValue = "";
    for (const key in theme.properties) {
      styleValue += `${key}:${theme.properties[key]};`;
    }
    themeStyle = styleValue.trimRight();
    themeClass = `${theme.name}-theme`;
  });

  // --- Cleanup subscriptions
  onDestroy(unsubscribe);

  // --- Start with the dark theme
  themeStore.registerTheme(darkTheme);
  themeStore.setTheme("dark");
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
  <Toolbar />
  <MainCanvas />
  <Statusbar />
</main>
