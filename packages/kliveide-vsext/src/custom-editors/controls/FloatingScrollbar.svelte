<script>
  // ==========================================================================
  // Represents a scroll bar that floats over its parent container. The
  // scrollbar is invisible unless the mouse enters the container. It provides
  // fade animation when entering and leaving the parent.

  import { onMount, createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";
  import { isMouseOverElement } from "./element-utils";

  // ==========================================================================
  // Component parameters
  // --- The orientation of the scrollbar: "horizontal" | "vertical"
  export let orientation = "vertical";

  // --- Width of the slider
  export let sliderWidth = 10;

  // --- Full size of the scrollbar
  export let scrollSize = 1000;

  // --- The position of the slider
  export let sliderPosition = 100;

  // --- Size of the viewport
  export let viewportSize;

  // --- Viewport ratio
  export let viewportRatio;

  // --- Allows scrolling by other components
  export function scrollWithDelta(delta) {
    sliderPosition += delta;
    normalizeSliderPosition();
    signSliderChange();
  }

  // ==========================================================================
  // Component logic
  const dispatch = createEventDispatcher();

  // --- Element and dimension values
  let hostElement;
  let parentElement;
  let offsetWidth;
  let offsetHeight;

  // --- Property strings that influence the scrollbar style values
  let horizontalCorner;
  let verticalCorner;
  let scrollPosDim;
  let barDimension;
  let scrollDimension;
  let sliderHeight;
  let barStyle;
  let sliderStyle;

  // --- Initialize components and property strings
  onMount(() => {
    if (orientation === "horizontal") {
      horizontalCorner = scrollPosDim = "left";
      verticalCorner = "bottom";
      barDimension = "height";
      scrollDimension = "width";
    } else {
      horizontalCorner = "right";
      verticalCorner = scrollPosDim = "top";
      barDimension = "width";
      scrollDimension = "height";
    }
    parentElement = hostElement.parentElement;
  });

  // --- Update the component style values
  $: barStyle =
    `${horizontalCorner}:0px;` +
    `${verticalCorner}: 0px;` +
    `${barDimension}:${sliderWidth}px;` +
    `${scrollDimension}:100%;` +
    `z-index:${showComponent && sliderVisible ? 15 : -1}`;

  // --- Update sider style values
  $: {
    if (orientation === "horizontal") {
      viewportRatio = offsetWidth / scrollSize;
      viewportSize = offsetWidth;
    } else {
      viewportRatio = offsetHeight / scrollSize;
      viewportSize = offsetHeight;
    }
    sliderHeight = viewportSize * viewportRatio;
    normalizeSliderPosition();

    sliderVisible = sliderHeight < scrollSize;
    sliderStyle =
      `${scrollDimension}:${sliderHeight}px;` +
      `${scrollPosDim}:${sliderPosition}px;` +
      `${barDimension}:100%`;
  }

  // ==========================================================================
  // Element visibility and slider positioning logic
  let sliderVisible;
  let scrollbarVisible;
  let showComponent;
  let isMoving = false;
  let startX;
  let startY;
  let sliderStart;

  // --- Responds to the slider movement start event
  function startMove(ev) {
    isMoving = true;
    startX = ev.clientX;
    startY = ev.clientY;
    sliderStart = sliderPosition;
  }

  // --- Responds to the mouse move event
  function windowDoMove(ev) {
    if (isMoving) {
      let newX = startX;
      let newY = startY;
      let lastPosition = sliderPosition;

      // --- Calculate the new slider position
      if (orientation === "horizontal") {
        sliderPosition =
          Math.abs(ev.clientY - startY) < 80
            ? sliderStart + ev.clientX - startX
            : sliderStart;
      } else {
        sliderPosition =
          Math.abs(ev.clientX - startX) < 80
            ? sliderStart + ev.clientY - startY
            : sliderStart;
      }
      normalizeSliderPosition();

      // --- Notify parent about the move event
      if (sliderPosition != lastPosition) {
        signSliderChange();
      }
    } else {
      if (isMouseOverElement(ev, parentElement)) {
        if (!scrollbarVisible) {
          // --- Mouse entered into the parent element
          showComponent = true;
          scrollbarVisible = true;
        }
      } else {
        if (scrollbarVisible) {
          // --- Mouse left the parent element
          scrollbarVisible = false;
        }
      }
    }
  }

  // --- Responds to the mouse button up event
  function windowStopMove(ev) {
    if (!isMoving) return;

    isMoving = false;
    if (!isMouseOverElement(ev, parentElement)) {
      // --- Hide the scrollbar
      scrollbarVisible = false;
    }
  }

  // --- Keeps slider position within limits
  function normalizeSliderPosition() {
    if (sliderPosition + sliderHeight > viewportSize) {
      sliderPosition = viewportSize - sliderHeight;
    }
    if (sliderPosition < 0) {
      sliderPosition = 0;
    }
  }

  // --- Signs the changes of the scrollbar's position
  function signSliderChange() {
    dispatch("slider-moved", Math.floor(sliderPosition / viewportRatio));
  }

  // --- Tests if the mouse leaves the main window
  function mouseOut(e) {
    e = e ? e : window.event;
    var from = e.relatedTarget || e.toElement;
    if (!from || from.nodeName == "HTML") {
      scrollbarVisible = false;
    }
  }

</script>

<style>
  .scrollbar {
    position: absolute;
  }

  .slider {
    position: relative;
    background-color: var(--vscode-scrollbarSlider-hoverBackground);
  }
  .slider:hover {
    background-color: var(--vscode-scrollbarSlider-hoverBackground);
  }

  .isMoving,
  .isMoving:hover {
    background-color: var(--vscode-scrollbarSlider-activeBackground);
  }
</style>

<svelte:window on:mousemove={windowDoMove} on:mouseup={windowStopMove} on:mouseout={mouseOut}/>
<div
  bind:this={hostElement}
  bind:offsetWidth
  bind:offsetHeight
  class="scrollbar"
  style={barStyle}>
  {#if scrollbarVisible && sliderVisible}
    <div
      class="slider"
      class:isMoving
      style={sliderStyle}
      in:fade={{ duration: 200 }}
      out:fade={{ duration: 800 }}
      on:outroend={() => (showComponent = false)}
      on:mousedown={startMove} />
  {/if}
</div>
