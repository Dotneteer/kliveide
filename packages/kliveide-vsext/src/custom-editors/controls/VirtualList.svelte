<script>
  import { create, last } from "lodash";

  // ==========================================================================
  // This component implements a virtaulized list where each item has the
  // same height

  import { onMount, tick, createEventDispatcher } from "svelte";

  // --------------------------------------------------------------------------
  // Component input properties

  // --- Data items of the virtual list
  export let items = [];

  // --- The height of the entire components
  export let componentHeight = "100%";

  // --- Height of items given in pixels
  export let itemHeight = 20;

  // --- Tab order to use
  export let tabOrder = 0;

  // --- Number of items rendered above the viewport
  export let topHem = 0;

  // --- Number of items rendered below the viewport
  export let bottomHem = 0;

  // --------------------------------------------------------------------------
  // Bindable component values

  // --- The item index of the first visible item
  export let startItemIndex = 0;

  // --- The item index of the last visible item
  export let endItemIndex = 0;

  // --- The item index of the top hem item
  export let topHemItemIndex = 0;

  // --- The item index of the bottom hem item
  export let bottomHemItemIndex = 0;

  // --- The public API of this component
  export let api;

  // --------------------------------------------------------------------------
  // Internals

  // --- Items to display in the virtual list
  let toDisplay;

  // --- Viewport element
  let viewport;

  // --- Contents element
  let contents;

  // --- Height of the viewport
  let viewportHeight = 0;

  // --- Height of the contents
  let contentsHeight = 0;

  // --- This component will dispatch events
  const dispatch = createEventDispatcher();

  // --- Initialize the API on mount
  onMount(async () => {
    await tick();
    api = {
      refreshContents,
      scrollToItem,
    };
  });

  // --- Whenever items changes, invalidate the current viewport
  $: refresh(items, viewportHeight, itemHeight);

  $: toDisplay = items
    .slice(topHemItemIndex, bottomHemItemIndex + 1)
    .map((data, i) => {
      return { index: i + topHemItemIndex, data };
    });

  // --- Refresh the positions when items change
  async function refresh(items, _viewportHeight, itemHeight, keepPosition) {
    await tick(); // --- Wait until the DOM is up to date
    if (!items || items.length === undefined) return;
    startItemIndex = keepPosition
      ? Math.min(startItemIndex, items.length - 1)
      : 0;
    contentsHeight = itemHeight * items.length;
    calculateVirtualContents();
  }

  // --- Refreshes to contents trying to keep positions
  async function refreshContents() {
    await refresh(items, viewportHeight, itemHeight, true);
    handleScroll();
  }

  // Scrolls to the item with the specified index using an
  // optional gap at the top
  async function scrollToItem(itemIndex, topGap) {
    if (!items || items.length === undefined) return;
    topGap = topGap || 0;
    itemIndex = Math.max(0, Math.min(itemIndex - topGap, items.length - 1));
    viewport.scrollTo(0, itemIndex * itemHeight);
    await tick();
  }

  // --- Handles the scroll event of the viewport
  async function handleScroll() {
    if (!items || items.length === undefined) return;

    const { scrollTop } = viewport;
    startItemIndex = Math.min(
      Math.floor(scrollTop / itemHeight),
      items.length - 1
    );
    calculateVirtualContents();
    dispatch("scrolled");
  }

  // --- Calculates the bottom position given the top position
  function calculateVirtualContents() {
    if (!items || items.length === undefined) return;
    endItemIndex = Math.min(
      startItemIndex + Math.floor(viewportHeight / itemHeight) + 1,
      items.length - 1
    );
    const topItems =
      topHem === null || topHem === undefined
        ? endItemIndex - startItemIndex + 1
        : topHem;
    topHemItemIndex = Math.max(0, startItemIndex - topItems);
    const bottomItems =
      bottomHem === null || bottomHem === undefined
        ? endItemIndex - startItemIndex + 1
        : bottomHem;

    bottomHemItemIndex = Math.min(items.length - 1, endItemIndex + bottomItems);
  }
</script>

<style>
  vl-viewport {
    position: relative;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: block;
    outline: none;
  }

  vl-contents {
    display: block;
  }

  vl-row {
    position: absolute;
    left: 0;
    display: flex;
    width: 100%;
    overflow: hidden;
  }
</style>

<vl-viewport
  tabindex={tabOrder}
  bind:this={viewport}
  bind:offsetHeight={viewportHeight}
  on:scroll={handleScroll}
  style="height:{componentHeight}">
  <vl-contents bind:this={contents} style="height:{contentsHeight}px">
    {#each toDisplay as row (row.index)}
      <vl-row style="top:{row.index * itemHeight}px">
        <slot item={row.data}>[item #{row.index}]</slot>
      </vl-row>
    {/each}
  </vl-contents>
</vl-viewport>
