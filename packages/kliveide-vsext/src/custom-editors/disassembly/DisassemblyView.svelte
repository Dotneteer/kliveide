<script>
  import { onMount } from "svelte";
  import { disassembly } from "./DisassemblyView";
  import VirtualList from "../controls/VirtualList.svelte";
  import DisassemblyEntry from "./DisassemblyEntry.svelte";

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
    <DisassemblyEntry {item} />
  </VirtualList>
</div>
