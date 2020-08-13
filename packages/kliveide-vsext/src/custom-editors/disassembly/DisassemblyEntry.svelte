<script>
  import { afterUpdate, tick, createEventDispatcher } from "svelte";
  import BreakpointPlaceholder from "./BreakPointPlaceholder.svelte";
  import BreakPointPlaceholder from "./BreakPointPlaceholder.svelte";
  import { intToX4 } from "../../disassembler/disassembly-helper";

  export let item;
  export let hasBreakpoint = true;
  export let isCurrentBreakpoint = true;
  export let execState;
  export let runsInDebug;

  let referenceWidth = 0;
  let opCodesWidth = 0;
  let labelWidth = 0;
  let instructionWidth = 0;

  const dispatch = createEventDispatcher();

  $: {
    const charWidth = referenceWidth / 5;
    opCodesWidth = 14 * charWidth;
    labelWidth = 17 * charWidth;
    instructionWidth = 65 * charWidth;
  }
</script>

<style>
  .item {
    padding: 1px 8px;
    display: flex;
    flex-direction: row;
    flex-grow: 0;
    flex-shrink: 0;
    font-family: Consolas, "Courier New", monospace;
    font-size: 1.1em;
    overflow-x: hidden;
    align-items: center;
  }
  .address {
    color: var(--vscode-editorLineNumber-foreground);
  }

  .opCodes {
    color: var(--vscode-terminal-ansiBlue);
    overflow-x: hidden;
  }

  .label {
    color: var(--vscode-terminal-ansiBrightMagenta);
    overflow-x: hidden;
  }

  .instruction {
    color: var(--vscode-terminal-ansiBrightCyan);
    overflow-x: hidden;
  }

  .item:hover {
    padding: 0px 7px;
    border: 1px solid var(--vscode-list-hoverBackground);
  }

  .currentBreakpoint {
    background-color: var(--vscode-list-hoverBackground);
  }
</style>

<div class="item" class:currentBreakpoint={isCurrentBreakpoint} on:click={() => dispatch('clicked')}>
  <BreakPointPlaceholder
    address={item.address}
    {hasBreakpoint}
    {isCurrentBreakpoint}
    {execState}
    {runsInDebug} />
  <span class="address" bind:clientWidth={referenceWidth}>
    {intToX4(item.address)}&nbsp;
  </span>
  <span class="opCodes" style="width:{opCodesWidth}px">{item.opCodes}</span>
  <span class="label" style="width:{labelWidth}px">
    {item.hasLabel ? 'L' + intToX4(item.address) : ''}
  </span>
  <span class="instruction" style="width:{instructionWidth}px">
    {item.instruction}
  </span>
</div>
