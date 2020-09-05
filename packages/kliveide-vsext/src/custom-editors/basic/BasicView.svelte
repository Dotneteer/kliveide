<script>
  import { onMount, tick } from "svelte";
  import VirtualizedList from "../controls/VirtualizedList.svelte";

  // --- Access the API of the virtual list
  let virtualListApi;

  let items = [];
  for (let i = 0; i < 100; i++) {
    items.push({
      seqNo: i,
      label: `Sequential Item #${i}`,
    });
  }

  let startItemIndex;
  let endItemIndex;

  async function handleClick() {
    await virtualListApi.scrollToItem(10, 3);
  }
</script>

<style>
  .component {
    display: flex;
    flex-direction: column;
    flex-grow: 0;
    flex-shrink: 0;
    height: 100%;
    width: 100%;
    position: relative;
    user-select: none;
  }

  .row {
    height: 24px;
  }
</style>

<div class="component">
  <VirtualizedList
    {items}
    itemHeight={24}
    topHem={10}
    bottomHem={0}
    bind:api={virtualListApi}
    bind:startItemIndex
    bind:endItemIndex
    let:item>
    <div class="row" on:click={handleClick}>{item.seqNo}: {item.label}</div>
  </VirtualizedList>
</div>
