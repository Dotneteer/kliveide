<script>
  import { afterUpdate, tick, createEventDispatcher } from "svelte";
  import { intToX4, intToX2 } from "../../disassembler/disassembly-helper";

  export let item;
  //   export let execState;
  //   export let runsInDebug;

  let referenceWidth = 0;
  let memByteWidth = 0;
  let memByteMargin = 0;
  let stringWidth = 0;

  const dispatch = createEventDispatcher();

  $: {
    const charWidth = referenceWidth / 4;
    memByteWidth = 2 * charWidth;
    memByteMargin = charWidth;
    stringWidth = 16 * charWidth;
  }
</script>

<style>
  .item {
    padding: 1px 8px;
    height: 20px;
    display: flex;
    flex-direction: row;
    flex-grow: 0;
    flex-shrink: 0;
    font-family: Consolas, "Courier New", monospace;
    font-size: 1.1em;
    overflow: hidden;
    align-items: flex-start;
  }

  .item:hover {
    padding: 0px 7px;
    border: 1px solid var(--vscode-list-hoverBackground);
  }

  .address {
    color: var(--vscode-editorLineNumber-foreground);
    flex-grow: 0;
    flex-shrink: 0;
  }

  .value {
    color: var(--vscode-terminal-ansiBrightCyan);
    overflow: hidden;
    flex-grow: 0;
    flex-shrink: 0;
  }

  .separator {
    flex-grow: 0;
    flex-shrink: 0;
  }

  .string {
    color: var(--vscode-terminal-ansiBrightBlue);
    overflow: hidden;
    flex-grow: 0;
    flex-shrink: 0;
  }
</style>

<div class="item" on:click={() => dispatch('clicked')}>
  <span
    class="address"
    bind:clientWidth={referenceWidth}
    title="{intToX4(item.address)} ({item.address})">
    {intToX4(item.address)}
  </span>
  <span class="separator" style="width:{2 * memByteMargin}px" />
  {#each item.contents as byte, i}
    <span
      class="value"
      style="width:{memByteWidth}px"
      title="{intToX4(item.address + i)} ({item.address + i}): ${intToX2(byte)}
      ({byte}{byte >= 128 ? ' / ' + (byte - 256) : ''})">
      {intToX2(byte)}
    </span>
    <span
      class="separator"
      style="width:{i % 8 === 7 ? 2 * memByteMargin : memByteMargin}px" />
  {/each}
  <span class="string" style="width:{stringWidth}px">{item.charContents}</span>
</div>
