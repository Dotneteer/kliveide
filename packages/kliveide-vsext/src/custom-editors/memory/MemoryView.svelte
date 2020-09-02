<script>
  // ==========================================================================
  // This component implements the view for the Memory editor

  import { onMount, tick } from "svelte";
  import { vscodeApi } from "../messaging/messaging-core";
  import ConnectionPanel from "../controls/ConnectionPanel.svelte";
  import RefreshPanel from "../controls/RefreshPanel.svelte";
  import VirtualList from "../controls/VirtualList.svelte";
  import MemoryPagingPanel from "../controls/MemoryPagingPanel.svelte";
  import MemoryEntry from "./MemoryEntry.svelte";
  import { memory, LINE_SIZE } from "./MemoryView";
  import { config } from "process";

  // --- Disassembly items to display
  let items = [];

  // --- Indicates if Klive emulator is connected
  let connected = true;

  // --- Indicates if the view is refreshed
  let refreshed = true;

  // --- Hold a cancellable refresh token while disassembly is being refreshed
  let refreshToken;

  // --- Scroll position to apply after disassembly has been refreshed
  let needScroll = null;

  // --- Gap to apply during scroll operation
  let scrollGap = 0;

  // --- Virtual machine execution state
  let execState;

  // --- The API of the virtual list component
  let virtualListApi;

  // --- The index of the visible item at the top
  let startItemIndex;

  // --- The index of the last visible ite at the bottom
  let endItemIndex;

  // --- Is the view currently scrolling?
  let scrolling = false;

  // --- Current value of registers
  let registers;

  // --- Indicates that the view port is being refreshed
  let viewPortRefreshing;

  // --- Configuration of the current machine
  let machineConfig;

  // --- Memory page information
  let pageInfo;

  onMount(() => {
    // --- Subscribe to the messages coming from the WebviewPanel
    window.addEventListener("message", async (ev) => {
      if (ev.data.viewNotification) {
        switch (ev.data.viewNotification) {
          case "doRefresh":
            // --- The Webview sends this request to refresh the view
            refreshed = false;
            registers = ev.data.registers;
            restoreViewState();
            break;
          case "connectionState":
            // --- Refresh after reconnection
            connected = ev.data.state;
            if (!connected) {
              refreshed = false;
              needScroll = 0;
            }
            break;
          case "execState":
            // --- Respond to vm execution state changes
            switch (ev.data.state) {
              case "paused":
              case "stopped":
                refreshed = false;
                break;
            }
            execState = ev.data.state;
            break;
          case "machineType":
            machineConfig = ev.data.config;
          // --- This case intentionally flows to the next
          case "memoryPaging":
            if (machineConfig) {
              const paging = machineConfig.paging;
              if (paging) {
                pageInfo = {
                  supportsPaging: paging.supportsPaging,
                  roms: paging.roms,
                  banks: paging.banks,
                  selectedRom: ev.data.selectedRom,
                  selectedBank: ev.data.selectedBank,
                };
              }
            }
            break;
          case "registers":
            // --- Register values sent
            registers = ev.data.registers;
            break;
          case "goToAddress":
            needScroll = ev.data.address;
            scrollGap = 0;
            break;
          case "refreshView":
            // --- Store the current top position to scroll back
            // --- to that after refrehs
            try {
              const item = items[startItemIndex + 1];
              needScroll = item.address;
            } catch (err) {
              // --- This error is intentionally ignored
              needScroll = 0;
            }
            // --- Sign that a refresh is require
            refreshed = false;
            scrollGap = 0;
            break;
          case "refreshViewPort":
            await refreshViewPort();
            break;
        }
      }
    });

    // --- No, the component is initialized, notify the Webview
    // --- and ask it to refresh this view
    vscodeApi.postMessage({ command: "refresh" });
  });

  // --- Refresh the view when connection/refresh statte changes
  $: (async () => {
    if (connected && !refreshed) {
      if (await refreshMemory()) {
        refreshed = true;
      }
    }
  })();

  // --- Scroll to the specified location
  $: if (needScroll !== null && refreshed) {
    scrollToAddress(needScroll);
  }

  // --- Initiate refreshing the disassembly view
  // --- Take care not to start disassembling multiple times
  async function refreshMemory() {
    // --- Cancel, if disassembly in progress, and start a new disassembly
    if (refreshToken) {
      refreshToken.cancelled = true;
    }

    // --- Start a new disassembly
    try {
      refreshToken = {
        cancelled: false,
      };
      const lines = await memory();
      if (!lines) {
        return false;
      }
      items = lines;
    } finally {
      // --- Release the cancellation token
      refreshToken = null;
    }

    await tick();
    await new Promise((r) => setTimeout(r, 50));
    if (needScroll !== null) {
      await scrollToAddress(needScroll);
    }
    return true;
  }

  // --- Refresh the specified part of the viewport
  async function refreshViewPort() {
    if (viewPortRefreshing) return;
    viewPortRefreshing = true;
    try {
      const viewPort = await memory(
        LINE_SIZE * startItemIndex,
        LINE_SIZE * endItemIndex
      );
      if (!viewPort) {
        return;
      }
      const newItems = items.slice(0);
      for (let i = 0; i < viewPort.length; i++) {
        newItems[i + startItemIndex] = viewPort[i];
      }
      items = newItems;
    } finally {
      viewPortRefreshing = false;
    }
  }

  // --- Scroll to the specified address
  async function scrollToAddress(address) {
    if (virtualListApi) {
      let found = items.findIndex((it) => it.address >= address);
      if (found && items[found].address > address) {
        found--;
      }
      found = Math.max(0, found - scrollGap);
      scrolling = true;
      virtualListApi.scrollToItem(found);
      await saveViewState();
      scrolling = false;
      needScroll = null;
      scrollGap = 0;
    }
  }

  // --- Save the current view state
  async function saveViewState() {
    await tick();
    const item = items[startItemIndex + 1];
    if (item) {
      vscodeApi.setState({ needScroll: item.address });
      vscodeApi.postMessage({
        command: "viewPortChanged",
        from: startItemIndex * LINE_SIZE,
        to: endItemIndex * LINE_SIZE,
      });
    }
  }

  // --- Restores the saved state
  function restoreViewState() {
    const state = vscodeApi.getState();
    if (state) {
      needScroll = state.needScroll;
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
</style>

<div class="component">
  {#if !connected}
    <ConnectionPanel />
  {:else}
    {#if !refreshed}
      <RefreshPanel {refreshed} text="Refreshing Memory view..." />
    {/if}
    {#if pageInfo && pageInfo.supportsPaging}
      <MemoryPagingPanel {pageInfo} 
        on:romSelected={(ev) => {
          console.log(`ROM view: ${ev.detail.romID}`)
        }}
        on:bankSelected={(ev) => {
          console.log(`BANK view: ${ev.detail.bankID}`)
        }}
        on:fullView={() => {
          console.log("Full view");
        }}/>
    {/if}
    <VirtualList
      {items}
      itemHeight={20}
      let:item
      bind:api={virtualListApi}
      bind:start={startItemIndex}
      bind:end={endItemIndex}
      on:scrolled={async () => {
        if (!scrolling) {
          await saveViewState();
        }
      }}>
      <MemoryEntry {item} {registers} />
    </VirtualList>
  {/if}
</div>
