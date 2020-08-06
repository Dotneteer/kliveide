<script>
  import { onMount } from "svelte";
  import VirtualizedList from "../controls/VirtualizedList.svelte";
  import { DisassemblyItemList } from "./disassembly-items";
  import { sendMessageToMain } from "../messaging/messaging-core";

  let name = "Klive IDE";

  onMount(async () => {
    window.addEventListener("message", (ev) => {
      if (ev.data.viewNotification) {
        console.log(`Message: ${JSON.stringify(ev.data)}`);
      }
    });
  });

  let items = new DisassemblyItemList();
  let indexData;

  function addItems() {
    const newItems = new DisassemblyItemList(items.items);
    newItems.addItems(10);
    items = newItems;
  }

  async function getMemory() {
    const response = await sendMessageToMain({
      type: "getMemoryContents",
      from: 0,
      to: 9,
    });
    return new Uint8Array(Buffer.from(response.bytes, "base64"));
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

  .item {
    height: 20px;
  }
</style>

<div class="component">
  <h1
    on:click={async () => {
      const mem = await getMemory();
      console.log(mem.length);
    }}>
    {name.toUpperCase()}: Disassembly View
  </h1>
  <VirtualizedList
    {items}
    itemHeight="20"
    itemScroll={true}
    let:item={itemData}
    let:index={indexData}
    on:item-selected={() => addItems()}>
    <div class="item">{indexData}: {itemData.caption}</div>
  </VirtualizedList>
</div>
