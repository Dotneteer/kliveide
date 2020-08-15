<script>
    // ==========================================================================
    // Displays a Refreshing message
  
    // --- Display this text, provided it's not empty
    export let text = "Refreshing...";
    export let refreshed = true;
  </script>
  
  <style>
    .overlay {
      position: relative;
      flex-shrink: 0;
      flex-grow: 0;
      height: 0;
      left: 8px;
      top: 8px;
    }
  
    .overlay-text {
      display: inline-block;
      background-color: #404040;
      color: var(--vscode-terminal-ansiBrightGreen);
      opacity: 0.9;
      padding: 2px 10px 4px 10px;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>
  
  {#if !refreshed && text}
  <div class="overlay">
    <span class="overlay-text">{text}</span>
  </div>
  {/if}
  