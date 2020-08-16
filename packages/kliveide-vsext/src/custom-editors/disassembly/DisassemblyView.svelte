<script>
  // ==========================================================================
  // This component implements the view for the Disassembly editor

  import { onMount, tick, afterUpdate } from "svelte";
  import { disassembly } from "./DisassemblyView";
  import { vscodeApi } from "../messaging/messaging-core";
  import { DisassemblyAnnotation } from "../../disassembler/annotations";
  import ConnectionPanel from "../controls/ConnectionPanel.svelte";
  import RefreshPanel from "../controls/RefreshPanel.svelte";
  import VirtualList from "../controls/VirtualList.svelte";
  import DisassemblyEntry from "./DisassemblyEntry.svelte";

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

  // --- Indicates the the vm runs in debug mode
  let runsInDebug;

  // --- Breakpoints set
  let breakpoints;

  // --- The current value of the PC register
  let currentPc;

  // --- Disassembly annotations to apply
  let annotations;

  // --- The API of the virtual list component
  let virtualListApi;

  // --- The index of the visible item at the top
  let startItemIndex;

  // --- Handle the event when the component is initialized
  onMount(() => {
    // --- Subscribe to the messages coming from the WebviewPanel
    window.addEventListener("message", (ev) => {
      if (ev.data.viewNotification) {
        // --- We listen only messages sent to this view
        switch (ev.data.viewNotification) {
          case "doRefresh":
            // --- The Webview sends this request to refresh the view
            refreshed = false;
            if (ev.data.annotations) {
              annotations = DisassemblyAnnotation.deserialize(
                ev.data.annotations
              );
            }
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
            runsInDebug = ev.data.runsInDebug;
            switch (ev.data.state) {
              case "paused":
              case "stopped":
                needScroll = ev.data.pc;
                scrollGap = 3;
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
      if (await refreshDisassembly()) {
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
  async function refreshDisassembly() {
    // --- Cancel, if disassembly in progress, and start a new disassembly
    if (refreshToken) {
      refreshToken.cancelled = true;
    }

    // --- Start a new disassembly
    try {
      refreshToken = {
        cancelled: false,
      };
      const disass = await disassembly(0, 0xffff, annotations, refreshToken);
      if (!disass) {
        // --- This disassembly was cancelled
        return false;
      }
      items = disass.outputItems;
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
      virtualListApi.scrollToItem(found);
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
</style>

<div class="component">
  {#if !connected}
    <ConnectionPanel />
  {:else}
    {#if !refreshed}
      <RefreshPanel text="Refreshing Z80 Disassembly view..." />
    {/if}
    <VirtualList
      {items}
      itemHeight={20}
      let:item
      bind:api={virtualListApi}
      bind:start={startItemIndex}>
      <DisassemblyEntry
        {item}
        hasBreakpoint={breakpoints.has(item.address)}
        isCurrentBreakpoint={currentPc === item.address}
        {execState}
        {runsInDebug} />
    </VirtualList>
  {/if}
</div>
