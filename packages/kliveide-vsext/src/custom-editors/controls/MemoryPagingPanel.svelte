<script>
  // ==========================================================================
  // This component implements a header that displays memory paging information
  import { createEventDispatcher } from "svelte";

  // --- Paging information
  export let pageInfo;

  // --- Current view mode: 0=Full, 1=ROM, 2 =BANK
  export let viewMode = 0;

  // --- The ROM page to display in ROM view mode
  export let displayedRom = 0;

  // --- The BANK to display in BANK view mode
  export let displayedBank = 0;

  // --- This component will raise events
  const dispatch = createEventDispatcher();

  // --- Helpre ranges to display ROMs and BANKs
  $: romIDs = createRange(0, pageInfo.roms);
  $: bankIDs = createRange(0, pageInfo.banks);

  // --- Creates a range [from, to)
  function createRange(from, to) {
    const range = [];
    for (let i = 0; i < to; i++) {
      range.push(i);
    }
    return range;
  }

  // --- Label of the current view mode
  $: viewModeLabel =
    viewMode === 0
      ? "Full"
      : viewMode === 1
      ? `ROM ${displayedRom}`
      : `Bank ${displayedBank}`;
</script>

<style>
  .pagingPanel {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    height: 28px;
    width: 100%;
    padding: 8px 8px;
    box-sizing: border-box;
    align-content: start;
    align-items: center;
    justify-items: start;
    font-size: 0.9em;
  }

  .shadowed {
    width: 100%;
    box-shadow: #000000 0 6px 6px -6px inset;
    flex-grow: 0;
    flex-shrink: 0;
    position: absolute;
    top: 28px;
    left: 0;
    height: 6px;
    z-index: 10;
  }

  .section {
    display: flex;
    flex-shrink: 0;
    flex-grow: 0;
    margin: 0 4px;
    align-content: flex-start;
    align-items: center;
    justify-items: start;
    font-size: 1.1em;
  }

  .label {
    margin: 0px 8px;
  }

  .idLabel {
    padding: 0px 4px;
    text-align: center;
    cursor: pointer;
  }

  .idLabel:hover {
    background-color: var(--vscode-list-hoverBackground);
  }

  .idLabel.selected {
    background-color: var(--vscode-list-activeSelectionBackground);
  }

  .pointable {
    cursor: pointer;
  }

  .placeholder {
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;
  }
</style>

<div class="pagingPanel">
  <div class="section">
    <span
      class="label"
      class:pointable={viewMode}
      title="The current view mode{viewMode ? '. Click to change to Full view' : ''}"
      on:click={() => {
        viewMode = 0;
        dispatch('fullView');
      }}>
      {viewModeLabel} View
    </span>
  </div>
  <div class="placeholder" />
  {#if !viewMode}
  <div class="section">
    <span class="label">ROM:</span>
    {#each romIDs as romID}
      <span
        class="idLabel"
        class:selected={pageInfo.selectedRom === romID}
        title="Click to view ROM {romID}"
        on:click={() => {
          viewMode = 1;
          displayedRom = romID;
          dispatch('romSelected', { romID });
        }}>
        {romID}
      </span>
    {/each}
  </div>
  <div class="section">
    <span class="label">Bank:</span>
    {#each bankIDs as bankID}
      <span
        class="idLabel"
        class:selected={pageInfo.selectedBank === bankID}
        title="Click to view Bank {bankID}"
        on:click={() => {
          viewMode = 2;
          displayedBank = bankID;
          dispatch('bankSelected', { bankID });
        }}>
        {bankID}
      </span>
    {/each}
  </div>
  {/if}
</div>
<div class="shadowed" />
