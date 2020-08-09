<script>
  import { vscodeApi } from "../messaging/messaging-core";

  export let address;
  export let hasBreakpoint;
  export let isCurrentBreakpoint;
  export let size = 16;
  export let execState;

  // --- Notify the webview about a breakpoint toggle
  function sendClickEvent(address) {
    vscodeApi.postMessage({
      command: hasBreakpoint ? "removeBreakpoint" : "setBreakpoint",
      address,
    });
  }
</script>

<style>
  .placeholder {
    display: flex;
    justify-content: start;
    align-items: center;
    width: 16px;
    height: 16px;
    margin-right: 4px;
    flex-grow: 0;
    flex-shrink: 0;
    cursor: pointer;
  }

  .brhover:hover {
    background: var(--vscode-terminal-ansiRed);
    border: 4px solid rgba(255, 0, 0, 0);
    background-clip: padding-box;
    opacity: 0.4;
    border-radius: 50%;
  }

  .breakpoint {
    fill: var(--vscode-terminal-ansiRed);
  }

  .current {
    fill: var(--vscode-terminal-ansiYellow);
  }

  .stopped {
    fill: var(--vscode-terminal-ansiRed);
  }
</style>

<div
  class="placeholder" class:brhover={!hasBreakpoint}
  on:click={() => sendClickEvent(address)}
  title={hasBreakpoint ? 'Remove breakpoint' : 'Set breakpoint'}>
  {#if hasBreakpoint}
    <svg
      class="breakpoint"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 4c.367 0 .721.048 1.063.145a3.943 3.943 0 0 1 1.762 1.031 3.944
        3.944 0 0 1 1.03 1.762c.097.34.145.695.145 1.062 0 .367-.048.721-.145
        1.063a3.94 3.94 0 0 1-1.03 1.765 4.017 4.017 0 0 1-1.762 1.031C8.72
        11.953 8.367 12 8 12s-.721-.047-1.063-.14a4.056 4.056 0 0
        1-1.765-1.032A4.055 4.055 0 0 1 4.14 9.062 3.992 3.992 0 0 1 4
        8c0-.367.047-.721.14-1.063a4.02 4.02 0 0 1 .407-.953A4.089 4.089 0 0 1
        5.98 4.546a3.94 3.94 0 0 1 .957-.401A3.89 3.89 0 0 1 8 4z" />
    </svg>
  {:else}
    <div style="width:{size}px;height:{size}px" />
  {/if}
  {#if isCurrentBreakpoint}
    <svg
      class="current" class:stopped={execState === "stopped"}
      style="margin-left:-{size}px"
      width="16"
      height="16"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.5 7.15l-4.26-4.74L9.31 2H4.25L3 3.25v9.48l1.25 1.25h5.06l.93-.42
        4.26-4.74V7.15zm-5.19 5.58H4.25V3.25h5.06l4.26 4.73-4.26 4.75z" />
    </svg>
  {/if}
</div>
