<script>
  // ==========================================================================
  // Represents a virualized list. Only the items visible within the currently
  // displayed viewport are rendered.

  import { onMount, createEventDispatcher } from "svelte";
  import { writable } from "svelte/store";
  import FloatingScrollbar from "./FloatingScrollbar.svelte";
  import { VirtualizedListManager } from "./VirtualizedList";

  // ==========================================================================
  // Component parameters
  // --- The items within the list
  export let items;

  // --- The heights of the child items
  export let itemHeight;

  // --- Indicates if wheel actions are enabled
  export let enableWheel = true;

  // --- When Ctrl is pressed with wheel, this is a multiplier
  export let fastWheel = 3;

  // --- Indicates if scroll unit is the heights of items
  export let itemScroll = false;

  // --- The tab index of the virtual list
  export let tabOrder = -1;

  // ==========================================================================
  // Component logic

  const dispatch = createEventDispatcher();

  // --- The root HTML element of this component
  let hostElement;

  // --- The HTML element that holds the visible part of the list
  let contentElement;

  // --- The component that manages the logic
  let listManager;

  // --- The scroller component
  let scroller;

  // --- Viewport ratio, we use it for scrolling with mouse wheel
  let viewportRatio;

  // --- The store that holds the state of the virtual component
  let virtualListStore = writable({
    topPosition: 0,
    displayedItems: [],
  });

  // --- Set up the manager as soon as the component has been rendered
  onMount(() => {
    //setTimeout(() => scroller.scrollWithDelta(60), 0);
    listManager = new VirtualizedListManager(
      hostElement,
      contentElement,
      virtualListStore
    );
    listManager.childHeight = Number(itemHeight);
    listManager.itemScroll = itemScroll;
    listManager.requestRefresh();
  });

  // --- Allow responding to the changes of the list
  $: {
    if (listManager && items) {
      listManager.itemsSource = items;
    }
  }

  // --- Handles when wheel is used
  function handleWheel(ev) {
    if (!enableWheel) return;

    scroller.scrollWithDelta(
      -ev.wheelDelta * viewportRatio * (ev.ctrlKey ? fastWheel : 1)
    );
  }
</script>

<style>
  .list-container {
    display: block;
    overflow: hidden;
    height: 100%;
    position: relative !important;
    outline: none;
  }

  .virtualized-list {
    display: block;
    overflow: hidden;
    overflow-y: hidden;
    position: relative !important;
    -webkit-overflow-scrolling: touch;
  }

  .list-placeholder {
    visibility: hidden;
  }

  .list-content {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    position: absolute;
    color: white;
  }
</style>


<svelte:window
  on:resize={() => {
    if (listManager) listManager.refreshView();
  }} />
<div tabindex={tabOrder} class="list-container" on:wheel={handleWheel}>
  <div
    bind:this={hostElement}
    class="virtualized-list"
    on:scroll={() => listManager.refreshView()}>
    <div
      class="list-placeholder"
      style="height:{$virtualListStore.totalListHeight}px" />
    <div
      bind:this={contentElement}
      class="list-content"
      style="top: {itemScroll ? 0 : $virtualListStore.topShift}px">
      {#each $virtualListStore.displayedItems as item, index (item.itemIndex)}
        <div on:click={() => dispatch('item-selected', item.itemIndex)}>
          <slot item={item.data} index={item.itemIndex} />
        </div>
      {/each}
    </div>
  </div>
  <FloatingScrollbar
    bind:this={scroller}
    orientation="vertical"
    scrollSize={$virtualListStore.totalListHeight}
    bind:viewportRatio
    on:slider-moved={(ev) => listManager.scrollTo(ev.detail)} />
</div>
