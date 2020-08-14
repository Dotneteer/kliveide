<script>
  import { afterUpdate, tick, createEventDispatcher } from "svelte";
  import { intToX4 } from "../../disassembler/disassembly-helper";

  export let item;
//   export let execState;
//   export let runsInDebug;

  let referenceWidth = 0;

  const dispatch = createEventDispatcher();

  $: {
    const charWidth = referenceWidth / 5;
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

  .address {
    color: var(--vscode-editorLineNumber-foreground);
    flex-grow: 0;
    flex-shrink: 0;
  }

  .item:hover {
    padding: 0px 7px;
    border: 1px solid var(--vscode-list-hoverBackground);
  }
</style>

<div class="item" on:click={() => dispatch('clicked')}>
  <span class="address" bind:clientWidth={referenceWidth}>
    {intToX4(item.address)}&nbsp;
  </span>
</div>
