<script>
  import { onMount, tick } from "svelte";
  import VirtualList from "../controls/VirtualList.svelte";

  // --- Access the API of the virtual list
  let virtualListApi;

  let items = [];
  for (let i = 0; i < 50000; i++) {
    items.push({
      seqNo: i,
      label: `Sequential Item #${i}`,
    });
  }

  let startItemIndex;
  let endItemIndex;

  async function handleClick() {
    for (let i = 0; i < 10; i++) {
      items[i].label = `Date: ${Date.now()}`;
    }
    await virtualListApi.refreshContents();
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
  <VirtualList
    {items}
    itemHeight={24}
    topHem={10}
    bottomHem={0}
    bind:api={virtualListApi}
    bind:startItemIndex
    bind:endItemIndex
    let:item>
    <div class="row" on:click={handleClick}>{item.seqNo}: {item.label}</div>
  </VirtualList>
</div>
