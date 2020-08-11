<script>
  import { onMount, tick, afterUpdate } from "svelte";
  import { disassembly } from "./DisassemblyView";
  import VirtualList from "../controls/VirtualList.svelte";
  import DisassemblyEntry from "./DisassemblyEntry.svelte";
  import { vscodeApi } from "../messaging/messaging-core";

  let name = "Klive IDE";

  let connected = true;
  let refreshed = false;
  let disassembling = false;
  let needScroll = null;
  let scrollGap = 0;
  let execState;
  let items = [];
  let breakpoints;
  let currentPc;

  let virtualList;
  let itemHeight;
  let api;

  onMount(async () => {
    // --- Subscribe to the messages coming from the WebviewPanel
    window.addEventListener("message", (ev) => {
      if (ev.data.viewNotification) {
        switch (ev.data.viewNotification) {
          case "connectionState":
            // --- Refresh after reconnection
            connected = ev.data.state;
            if (!connected) {
              refreshed = false;
            }
            break;
          case "execState":
            // --- Respond to vm execution state changes
            const oldState = execState;
            if (!execState) {
              refreshed = false;
            }
            switch (ev.data.state) {
              case "paused":
              case "stopped":
                needScroll = ev.data.pc;
                scrollGap = 3;
                break;
              case "running":
                if (oldState === "stopped" || oldState === "none") {
                  needScroll = 0;
                  scrollGap = 0;
                }
                break;
              case "none":
                needScroll = 0;
                scrollGap = 0;
                currentPc = -1;
                break;
            }
            execState = ev.data.state;
            currentPc = ev.data.pc;
            break;
          case "breakpoints":
            // --- Receive breakpoints set in the emulator
            breakpoints = new Set(ev.data.breakpoints);
            break;
          case "pc":
            currentPc = ev.data.pc;
            break;
          case "goToAddress":
            console.log(`Go To Address ${ev.data.address}`);
            needScroll = ev.data.address;
            scrollGap = 0;
            break;
        }
      }
    });

    vscodeApi.postMessage({ command: "refresh" });
  });

  $: if (connected) {
    refreshDisassembly();
  }

  $: if (needScroll !== null && refreshed) {
    scrollToAddress(needScroll);
  }

  // --- Initiate refreshing the disassembly view
  // --- Take care not to start disassembling multiple times
  async function refreshDisassembly() {
    if (refreshed || disassembling) {
      return;
    }
    disassembling = true;
    try {
      const disass = await disassembly(0, 0xffff);
      items = disass.outputItems;
    } finally {
      disassembling = false;
    }
    await tick();
    await new Promise((r) => setTimeout(r, 50));
    refreshed = true;
    if (needScroll !== null) {
      await scrollToAddress(needScroll);
    }
  }

  // --- Scroll to the specified address
  async function scrollToAddress(address) {
    if (api) {
      let found = items.findIndex((it) => it.address >= address);
      found = Math.max(0, found - scrollGap);
      api.scrollToItem(found);
      needScroll = null;
      scrollGap = 0;
    }
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
      <p class="title">
        <strong>Disconnected from Klive Emulator.</strong>
      </p>
      <p class="message">
        You can click the Klive icon in the status bar to start Klive Emulator.
      </p>
    </div>
  {:else}
    <VirtualList {items} itemHeight={20} let:item bind:api>
      <DisassemblyEntry
        {item}
        hasBreakpoint={breakpoints.has(item.address)}
        isCurrentBreakpoint={currentPc === item.address}
        {execState} />
    </VirtualList>
  {/if}
</div>
