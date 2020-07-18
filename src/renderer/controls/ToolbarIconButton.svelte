<script>
  // ==========================================================================
  // Represents a toolbar icon button that responds to mouse events
  import SvgIcon from "./SvgIcon.svelte";
  import { createEventDispatcher } from "svelte";

  import { themeStore } from "../stores/theme-store";

  // ==========================================================================
  // Component parameters

  // --- Normal button size
  export let size = 22;

  // --- Highlighted (button down) button isze
  export let highlightSize = 28;

  // --- Name of the icon in the registry
  export let iconName;

  // --- Button tooltip
  export let title;

  // --- Button fill color
  export let fill;

  // --- Is the button enabled?
  export let enable = true;

  // --- Is the button selected?
  export let selected = false;

  // ==========================================================================
  // Component logic

  const dispatch = createEventDispatcher();

  // --- Signs that the mouse is down on this button
  let isMouseDown;
  let fillColor;

  $: currentSize = isMouseDown ? highlightSize : size;
  $: fillColor = enable ? fill : "--toolbar-button-disabled-fill";
  $: buttonClass =
    "button " + (selected ? "selected" : "") + (enable ? "" : " disabled");
</script>

<style>
  .button {
    display: flex;
    width: 36px;
    height: 36px;
    padding: 4px 4px;
    margin: 0px 0px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid transparent
  }

  .disabled {
    cursor: default;
  }

  .selected {
    border: 1px solid #007acc;
  }
</style>

<div
  class={buttonClass}
  {title}
  on:mousedown={ev => {
    if (!enable) return;
    isMouseDown = ev.button === 0;
  }}
  on:mouseleave={() => {
    if (!enable) return;
    isMouseDown = false;
  }}
  on:mouseup={() => {
    if (!enable) return;
    isMouseDown = false;
  }}
  on:click={() => dispatch('clicked')}>
  <SvgIcon
    {iconName}
    fill={fillColor}
    width={currentSize}
    height={currentSize} />
</div>
