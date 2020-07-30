<script>
  import SplitContainer from "./SplitContainer.svelte";
  import EmulatorPanel from "./EmulatorPanel.svelte";
  import KeyboardPanel from "./KeyboardPanel.svelte";

  import { createRendererProcessStateAware } from "../rendererProcessStore";

  let keyboardVisible = false;
  let delayIsOver = true;
  const stateAware = createRendererProcessStateAware("keyboardPanelState");
  stateAware.onStateChanged.on(async state => {
    delayIsOver = false;
    keyboardVisible = state.visible;
    await new Promise(r => setTimeout(r, 10));
    delayIsOver = true;
  });

  let keyboardHeight;
  let initialHeight;
  let splitterIsMoving = false;
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
    <EmulatorPanel />
    {#if keyboardVisible}
      <KeyboardPanel
        showPanel={delayIsOver}
        visible={keyboardVisible}
        {initialHeight}
        bind:sizedHeight={keyboardHeight} />
    {/if}
  </SplitContainer>
</div>
