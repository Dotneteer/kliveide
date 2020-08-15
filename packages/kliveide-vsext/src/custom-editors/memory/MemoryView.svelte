<script>
  // ==========================================================================
  // This component implements the view for the Memory editor

  import { onMount, tick, afterUpdate } from "svelte";
  import { vscodeApi } from "../messaging/messaging-core";
  import VirtualList from "../controls/VirtualList.svelte";
  import MemoryEntry from "./MemoryEntry.svelte";
  import { memory } from "./MemoryView";

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

  let scrolling = false;

  onMount(() => {
    // --- Subscribe to the messages coming from the WebviewPanel
    window.addEventListener("message", (ev) => {
      if (ev.data.viewNotification) {
        switch (ev.data.viewNotification) {
          case "doRefresh":
            // --- The Webview sends this request to refresh the view
            refreshed = false;
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
            switch (
              ev.data.state
              // TODO: Implement execution state changes
            ) {
            }
            execState = ev.data.state;
            currentPc = ev.data.pc;
            break;
          case "goToAddress":
            needScroll = ev.data.address;
            scrollGap = 0;
            break;
          case "refreshView":
            // --- Store the current top position to scroll back
            // --- to that after refrehs
            try {
              const item = items[startItemIndex];
              needScroll = item.address;
            } catch (err) {
              // --- This error is intentionally ignored
              needScroll = 0;
            }
            // --- Sign that a refresh is require
            refreshed = false;
            scrollGap = 0;
            break;
        }
      }
    });

    vscodeApi.postMessage({ command: "refresh" });
  });

  $: (async () => {
    if (connected && !refreshed) {
      if (await refreshMemory()) {
        refreshed = true;
      }
    }
  })();

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

  // --- Scroll to the specified address
  async function scrollToAddress(address) {
    if (virtualListApi) {
      let found = items.findIndex((it) => it.address >= address);
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
      console.log(`Saved: ${item.address}`);
    }
  }

  // --- Restores the saved state
  function restoreViewState() {
    const state = vscodeApi.getState();
    if (state) {
      needScroll = state.needScroll;
      console.log(`Restored: ${needScroll}`);
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
      bind:api={virtualListApi}
      bind:start={startItemIndex}
      on:scrolled={async () => {
        if (!scrolling) {
          await saveViewState();
        }
      }}>
      <MemoryEntry {item} />
    </VirtualList>
  {/if}
</div>
