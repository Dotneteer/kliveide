<script>
  import { onMount } from "svelte";
  import VirtualList from "../controls/VirtualList.svelte";
  import { disassembly } from "./DisassemblyView";

  let name = "Klive IDE";

  onMount(async () => {
    window.addEventListener("message", (ev) => {
      if (ev.data.viewNotification) {
        console.log(`Message: ${JSON.stringify(ev.data)}`);
      }
    });
  });

  let items = [];

  async function getDisassembly() {
    return await disassembly(0, 0x3fff);
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
      const disass = await getDisassembly();
      items = disass.outputItems;
      console.log(disass.outputItems.length);
    }}>
    {name.toUpperCase()}: Disassembly View
  </h1>
  <VirtualList {items} let:item>
    <div class="item">
      {item.address}|{item.opCodes}|{item.hasLable}|{item.instruction}
    </div>
  </VirtualList>
</div>
