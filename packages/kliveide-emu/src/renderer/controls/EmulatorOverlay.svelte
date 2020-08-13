<script>
  import { createEventDispatcher } from "svelte";

  export let text = "Overlay";

  const dispatch = createEventDispatcher();
</script>

<style>
  .play-overlay {
    position: relative;
    flex-shrink: 0;
    flex-grow: 0;
    height: 0;
    left: 8px;
    top: 8px;
  }

  .overlay-text {
    display: inline-block;
    background-color: #404040;
    color: lightgreen;
    opacity: 0.9;
    padding: 2px 10px 4px 10px;
    border-radius: 4px;
    cursor: pointer;
  }
</style>

{#if text}
<div class="play-overlay">
  <span class="overlay-text" title="Hide overlay (click to show again)"
  on:click|stopPropagation={() => dispatch("hide")}>{text}</span>
</div>
{/if}
