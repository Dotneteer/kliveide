<script>
  import { onMount } from "svelte";
  import { disassembly } from "./DisassemblyView";
  import VirtualList from "../controls/VirtualList.svelte";
  import DisassemblyEntry from "./DisassemblyEntry.svelte";

  let name = "Klive IDE";

  let refreshed = false;
  let connected = true;
  let execState;
  let items = [];

  onMount(async () => {
    window.addEventListener("message", (ev) => {
      if (ev.data.viewNotification) {
        console.log(JSON.stringify(ev.data));
        switch (ev.data.viewNotification) {
          case "connectionState":
            connected = ev.data.state;
            if (!connected) {
              refreshed = false;
            }
            break;
          case "execState":
            if (!execState) {
              refreshed = false;
            }
            execState = ev.data.execState;
            break;
        }
        console.log(`Refreshed? ${refreshed}`);
      }
    });
  });

  $: {
    if (!refreshed && connected) {
      console.log(`Not refreshed: ${execState}`);
      if (execState !== "none") {
        console.log("Time to refresh");
        refreshDisassembly();
      }
    }
  }

  async function refreshDisassembly() {
    const disass = await disassembly(0, 0x3fff);
    items = disass.outputItems;
    refreshed = true;
    console.log(`Refreshed: ${items.length}`);
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

  .disconnected {
    padding: 8px;
  }

  .message {
    color: var(--vscode-terminal-ansiWhite);
    padding: 0px 2px;
    line-height: 1em;
  }
  
  .title {
    color: var(--vscode-terminal-ansiRed);
    padding: 0px 2px;
    line-height: 1em;
  }
</style>

<div class="component">
  {#if !connected}
    <div class="disconnected">
      <p class="title"><strong>Disconnected from Klive Emulator.</strong></p>
      <p class="message">You can click the Klive icon in the status bar to start Klive Emulator.</p>
    </div>
  {:else}
    <VirtualList {items} let:item>
      <DisassemblyEntry {item} />
    </VirtualList>
  {/if}
</div>
