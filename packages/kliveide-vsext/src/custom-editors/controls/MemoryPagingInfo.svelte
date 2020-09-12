<script>
  // ==========================================================================
  // This component implements a header that displays memory paging information

  // --- The ROM page to display in ROM view mode
  export let displayedRom = 0;

  // --- The BANK to display in BANK view mode
  export let displayedBank = 0;
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

  .placeholder {
    width: 100%;
    flex-grow: 1;
    flex-shrink: 1;
  }
</style>

<div class="pagingPanel">
  <div class="placeholder" />
  <div class="section">
    <span class="label">ROM:</span>
    <span class="idLabel"> {displayedRom} </span>
  </div>
  <div class="section">
    <span class="label">Bank:</span>
    <span class="idLabel"> {displayedBank} </span>
  </div>
</div>
