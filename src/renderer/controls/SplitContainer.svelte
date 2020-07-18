<script>
  // ==========================================================================
  // Generic container for panels that have splitters (gutters) among them.

  import {
    onMount,
    onDestroy,
    afterUpdate,
    createEventDispatcher
  } from "svelte";
  import Split from "./Splitter";
  import {
    splitterMoved,
    raiseSplitterMoved,
    filterChildren,
    calculateInitialSizes,
    removeGutters
  } from "./SplitContainer";
  import { isDescendant } from "../../shared/utils/html-utils";

  // ==========================================================================
  // Component parameters
  // --- Component split direction: "horizontal"/"vertical"
  export let direction = "horizontal";

  // --- Size of the gutter
  export let gutterSize = 8;

  // --- This tag can have any value. The component refreshes itself when this
  // --- get changed.
  export let refreshTag;

  // --- Signs if the splitter is moving
  export let isMoving = false;

  // --- The minimum size of panels
  export let minimumSize = 200;

  // ==========================================================================
  // Internal variables
  // --- Reference to the host element
  let hostElement;

  // ==========================================================================
  // Component logic
  const dispatch = createEventDispatcher();

  let flexDir;
  let size;
  let refreshRequest = false;

  // --- Calculated properties used for styling
  $: {
    (() => {
      if (!hostElement) return;
      flexDir = `flex-direction: ${
        direction === "horizontal" ? "row" : "column"
      }`;
      size = direction === "horizontal" ? "clientWidth" : "clientHeight";
      refreshRequest = true;
    })(direction, gutterSize, refreshTag);
  }

  afterUpdate(() => {
    if (refreshRequest) {
      refreshRequest = false;
      setupSplitter(true);
    }
  });

  // --- Initialize the component visuals
  onMount(() => {
    // --- Resize the splitter every time the component is rendered
    setupSplitter(true);
    // --- Notify child splitters when this one is moved
    splitterMoved.on(onSplitterMoved);
  });

  // --- Clean up resources
  onDestroy(() => {
    // --- Unsubscribe from movement events
    splitterMoved.off(onSplitterMoved);
  });

  // --- Set up the size of the splitter and its panels
  function setupSplitter(isInitial) {
    removeGutters(hostElement);
    let children = hostElement.querySelectorAll("div");
    children = filterChildren(hostElement, children);

    const sizes = calculateInitialSizes(
      direction,
      hostElement,
      minimumSize,
      children,
      isInitial
    );

    Split(children, {
      sizes,
      gutterSize,
      minSize: minimumSize,
      direction,
      floatingGutter: true,
      onDrag: () => {
        isMoving = true;
      },
      onDragEnd: () => {
        raiseSplitterMoved(hostElement);
        isMoving = false;
      }
    });
  }

  // --- Notify child splitters
  function onSplitterMoved(node) {
    if (node === hostElement) {
      dispatch("moved", node);
    }
    if (isDescendant(node, hostElement)) {
      setupSplitter(false);
    }
  }
</script>

<style>
  .split-container {
    display: flex;
    flex-grow: 1;
    flex-shrink: 1;
    height: 100%;
    width: 100%;
  }
</style>

<svelte:window on:resize={() => setupSplitter(false)} />
<div bind:this={hostElement} class="split-container" style={flexDir}>
  <slot />
</div>
