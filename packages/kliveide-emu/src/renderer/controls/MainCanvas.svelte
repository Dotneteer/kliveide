<script>
  import { tick } from "svelte";
  import SplitContainer from "./SplitContainer.svelte";
  import EmulatorPanel from "./EmulatorPanel.svelte";
  import KeyboardPanel from "./KeyboardPanel.svelte";
  import { createRendererProcessStateAware } from "../rendererProcessStore";

  // --- The virtual machine instance
  export let vmEngine;

  let keyboardType = "";
  let keyboardVisible = false;
  let delayIsOver = true;
  const stateAware = createRendererProcessStateAware("emulatorPanelState");
  stateAware.stateChanged.on(async (state) => {
    if (keyboardVisible !== state.keyboardPanel) {
      delayIsOver = false;
      keyboardVisible = state.keyboardPanel;
      await tick();
      delayIsOver = true;
    }
  });

  let keyboardHeight;
  let initialHeight;
  let splitterIsMoving = false;

  $: keyboardType = vmEngine ? vmEngine.keyboardType : "";
</script>

<style>
  .main-panel {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    flex-shrink: 1;
    width: 100%;
  }
</style>

<div class="main-panel">
  <SplitContainer
    direction="vertical"
    refreshTag={keyboardVisible}
    minimumSize={200}
    bind:isMoving={splitterIsMoving}
    on:moved={async () => {
      initialHeight = keyboardHeight;
    }}>
    <EmulatorPanel {vmEngine} />
    {#if keyboardVisible}
      <KeyboardPanel
        type={keyboardType}
        showPanel={delayIsOver}
        visible={keyboardVisible}
        {initialHeight}
        bind:sizedHeight={keyboardHeight} />
    {/if}
  </SplitContainer>
</div>
