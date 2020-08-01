<script>
  import Sp48Keyboard from "./Sp48Keyboard.svelte";
  export let visible = true;
  export let initialHeight;
  export let sizedWidth;
  export let sizedHeight;
  export let showPanel = true;
</script>

<style>
  .keyboard-panel {
    display: flex;
    overflow: hidden;
    flex-shrink: 1;
    flex-grow: 1;
    height: 100%;
    background-color: var(--keyboard-background-color);
    padding: 16px 12px 8px 12px;
    box-sizing: border-box;
    align-content: start;
    justify-items: start;
    justify-content: center;
  }
</style>

{#if visible}
  <div
    class="keyboard-panel"
    data-initial-size={initialHeight}
    bind:clientWidth={sizedWidth}
    bind:clientHeight={sizedHeight} >
    {#if showPanel}
      <Sp48Keyboard clientWidth={sizedWidth} clientHeight={sizedHeight} />
    {/if}
  </div>
{/if}
