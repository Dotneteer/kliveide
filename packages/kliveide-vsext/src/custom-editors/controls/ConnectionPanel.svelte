<script>
  // ==========================================================================
  // Displays a Disconnected message

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

  .overlay-box {
    display: inline-block;
    background-color: #ffffff10;
    color: var(--vscode-terminal-ansiRed);
    padding: 2px 10px 4px 10px;
    border-radius: 4px;
    cursor: pointer;
  }

  .title {
    color: var(--vscode-terminal-ansiBrightRed);
    font-weight: bold;
  }

  .message {
    color: var(--vscode-terminal-ansiBrightWhite);
  }
</style>

<div class="overlay">
  <div class="overlay-box">
    <div class="title">Disconnected from Klive Emulator</div>
    <div class="message">
      Click the Klive icon in the status bar to start Klive Emulator.
    </div>
  </div>
</div>
