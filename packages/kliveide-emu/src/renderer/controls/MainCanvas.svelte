<script>
  import { tick, onDestroy, onMount } from "svelte";
  import SplitContainer from "./SplitContainer.svelte";
  import EmulatorPanel from "./EmulatorPanel.svelte";
  import KeyboardPanel from "./KeyboardPanel.svelte";
  import { createRendererProcessStateAware } from "../rendererProcessStore";
  import { emulatorKeyboardHeightAction } from "../../shared/state/redux-emulator-state";
  import { init } from "svelte/internal";

  // --- The virtual machine instance
  export let vmEngine;
  export let vmEngineError;

  let keyboardType = "";
  let keyboardVisible = false;
  let delayIsOver = true;
  let layout = "";

  const stateAware = createRendererProcessStateAware("emulatorPanelState");
  stateAware.stateChanged.on(async (state) => {
    if (keyboardVisible !== state.keyboardPanel) {
      delayIsOver = false;
      keyboardVisible = state.keyboardPanel;
      await tick();
      delayIsOver = true;
    }
    layout = state.keyboardLayout;
    const height = stateAware.state.keyboardHeight;
    if (height) {
      initialHeight = height;
    }
  });

  let keyboardHeight;
  let initialHeight;
  let splitterIsMoving = false;

  $: keyboardType = vmEngine ? vmEngine.keyboardType : "";

  onMount(() => {});

  // --- Cleanup subscriptions
  onDestroy(() => {
    if (stateAware) {
      stateAware.dispose();
    }
    if (vmEngine) {
      vmEngine.dispose();
    }
  });
</script>

<div class="main-panel">
  <SplitContainer
    direction="vertical"
    refreshTag={keyboardVisible}
    minimumSize={80}
    bind:isMoving={splitterIsMoving}
    on:moved={async () => {
      initialHeight = keyboardHeight;
      stateAware.dispatch(emulatorKeyboardHeightAction(keyboardHeight)());
    }}
  >
    <EmulatorPanel {vmEngine} {vmEngineError} />
    {#if keyboardVisible}
      <KeyboardPanel
        {vmEngine}
        type={keyboardType}
        showPanel={delayIsOver}
        visible={keyboardVisible}
        {initialHeight}
        {layout}
        bind:sizedHeight={keyboardHeight}
      />
    {/if}
  </SplitContainer>
</div>

<style>
  .main-panel {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    flex-shrink: 1;
    width: 100%;
  }
</style>
