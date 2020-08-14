<script>
    import { onMount, tick, afterUpdate } from "svelte";
    import { vscodeApi } from "../messaging/messaging-core";
    import VirtualList from "../controls/VirtualList.svelte";
    import MemoryEntry from "./MemoryEntry.svelte";

    let items = [];
  
    let connected = true;
    let refreshRequestCount = 0;
    let needScroll = null;
    let scrollGap = 0;
    let execState;
    let runsInDebug;
    let cancellationToken;
  
    let virtualList;
    let itemHeight;
    let api;
    let startItemIndex;
  
    onMount(() => {
      // --- Subscribe to the messages coming from the WebviewPanel
      window.addEventListener("message", (ev) => {
        if (ev.data.viewNotification) {
          switch (ev.data.viewNotification) {
            case "connectionState":
              // --- Refresh after reconnection
              connected = ev.data.state;
              if (!connected) {
                refreshRequestCount++;
              }
              break;
            case "execState":
              // --- Respond to vm execution state changes
              const oldState = execState;
              if (!execState) {
                refreshRequestCount++;
              }
              runsInDebug = ev.data.runsInDebug;
              switch (ev.data.state) {
                  // TODO: Process state change
              }
              execState = ev.data.state;
              break;
            case "goToAddress":
            //   needScroll = ev.data.address;
            //   scrollGap = 0;
              break;
            case "refreshView":
            //   try {
            //     const item = items[startItemIndex];
            //     needScroll = item.address;
            //   } catch (err) {
            //     // --- This error is intentionally ignored
            //     needScroll = 0;
            //   }
            //   refreshRequestCount++;
            //   scrollGap = 0;
              break;
          }
        }
      });
  
      vscodeApi.postMessage({ command: "refresh" });
    });
  
    $: (async () => {
      if (connected && refreshRequestCount) {
        if (await refreshMemory()) {
          refreshRequestCount--;
        }
      }
    })();
  
    $: if (needScroll !== null && refreshRequestCount === 0) {
      scrollToAddress(needScroll);
    }
  
    // --- Initiate refreshing the disassembly view
    // --- Take care not to start disassembling multiple times
    async function refreshMemory() {
      // --- Cancel, if disassembly in progress, and start a new disassembly
      if (cancellationToken) {
        cancellationToken.cancelled = true;
      }
  
      // --- Start a new disassembly
      try {
        cancellationToken = {
          cancelled: false,
        };
        // TODO: Refresh the memory here
      } finally {
        // --- Release the cancellation token
        cancellationToken = null;
      }
  
      await tick();
      await new Promise((r) => setTimeout(r, 50));
      if (needScroll !== null) {
        await scrollToAddress(needScroll);
      }
      return true;
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
    <VirtualList
      {items}
      itemHeight={20}
      let:item
      bind:api
      bind:start={startItemIndex}>
      <MemoryEntry {item} />
    </VirtualList>
    {/if}
  </div>
  