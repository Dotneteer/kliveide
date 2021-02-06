<script>
  // ==========================================================================
  // Displays the overlay with the current Execution state
  import { createEventDispatcher } from "svelte";

  // --- Display this text, provided it's not empty
  export let text = "Overlay";
  export let error = false;

  // --- This control will dispatch a "hide" event on click
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
    margin-right: 16px;
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

  .overlay-error {
    color: coral;
  }
</style>

{#if text}
<div class="play-overlay">
  <span class="overlay-text" class:overlay-error={error} title="Hide overlay (click to show again)"
  on:click|stopPropagation={() => dispatch("hide")}>{text}</span>
</div>
{/if}
