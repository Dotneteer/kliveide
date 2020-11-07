<script>
  // ==========================================================================
  // This component implements the view for the Disassembly editor

  import { onMount } from "svelte";
  import { vscodeApi } from "../messaging/messaging-core";
  import ConnectionPanel from "../controls/ConnectionPanel.svelte";
  import RefreshPanel from "../controls/RefreshPanel.svelte";
  import HeaderShadow from "../controls/HeaderShadow.svelte";
  import VirtualList from "../controls/VirtualList.svelte";
  import MemoryPagingInfo from "../controls/MemoryPagingInfo.svelte";
  import DisassemblyEntry from "./DisassemblyEntry.svelte";

  // --- Disassembly items to display
  let items = [];

  // --- Indicates if Klive emulator is connected
  let connected = true;

  // --- Indicates if the view is refreshed
  let refreshed = true;

  // --- Virtual machine execution state
  let execState;

  // --- Indicates the the vm runs in debug mode
  let runsInDebug;

  // --- Breakpoints set
  let breakpoints;

  // --- The current value of the PC register
  let currentPc;

  // --- The API of the virtual list component
  let virtualListApi;

  // --- The index of the visible item at the top
  let startItemIndex;

  // --- Type of the current machine
  let machineType;

  // --- Configuration of the current machine
  let machineConfig;

  // --- Memory page information
  let pageInfo;

  // --- View information
  let viewMode;
  let displayedRom;
  let displayedBank;

  // --- Handle the event when the component is initialized
  onMount(() => {
    // --- Subscribe to the messages coming from the WebviewPanel
    window.addEventListener("message", async (ev) => {
      if (ev.data.viewNotification) {
        // --- We listen only messages sent to this view
        switch (ev.data.viewNotification) {
          case "refreshViewport":
            const parsed = JSON.parse(ev.data.fullView);
            items = parsed;
            refreshed = true;
            await new Promise((r) => setTimeout(r, 100));
            await virtualListApi.refreshContents();
            break;
          case "connectionState":
            // --- Refresh after reconnection
            connected = ev.data.state;
            if (!connected) {
              refreshed = false;
            }
            break;
          case "execState":
            // --- Respond to vm execution state changes
            runsInDebug = ev.data.runsInDebug;
            switch (ev.data.state) {
              case "paused":
              case "stopped":
                await scrollToAddress(ev.data.pc, 3);
                break;
              case "none":
                currentPc = -1;
                break;
            }
            execState = ev.data.state;
            currentPc = ev.data.pc;
            break;
          case "machineType":
            machineType = ev.data.type;
            machineConfig = ev.data.config;
            viewMode = 0;
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
          case "breakpoints":
            // --- Receive breakpoints set in the emulator
            breakpoints = new Set(ev.data.breakpoints);
            break;
          case "pc":
            currentPc = ev.data.pc;
            break;
          case "goToAddress":
            await scrollToAddress(ev.data.address || 0);
            break;
          case "refreshView":
            // --- Store the current top position to scroll back
            // --- to that after refrehs
            try {
              const item = items[startItemIndex];
              if (item && item.address !== undefined) {
                await scrollToAddress(item.address);
              }
            } catch (err) {
              // --- This error is intentionally ignored
            }
            // --- Sign that a refresh is require
            refreshed = false;
            vscodeApi.postMessage({ command: "requestViewportRefresh" });        
            break;
        }
      }
    });

    // --- No, the component is initialized, notify the Webview
    // --- and ask it to refresh this view
    vscodeApi.postMessage({ command: "requestRefresh" });
    vscodeApi.postMessage({ command: "requestViewportRefresh" });        
  });

  $: {
    (function () {
      vscodeApi.postMessage({ command: "changeView" });
    })(viewMode, displayedRom, displayedBank);
  }

  // --- Scroll to the specified address
  async function scrollToAddress(address, scrollGap = 0) {
    if (virtualListApi) {
      let found = items.findIndex((it) => it.address >= address);
      found = Math.max(0, found - scrollGap);
      virtualListApi.scrollToItem(found);
      await new Promise((r) => setTimeout(r, 10));
      await virtualListApi.refreshContents();
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
    {#if pageInfo && pageInfo.supportsPaging}
      <MemoryPagingInfo displayedRom={pageInfo.selectedRom} displayedBank={pageInfo.selectedBank}/>
    {/if}
    <HeaderShadow />
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
