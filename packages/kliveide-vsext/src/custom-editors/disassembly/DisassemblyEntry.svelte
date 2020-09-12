<script>
  import { afterUpdate, tick, createEventDispatcher } from "svelte";
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
  let commentWidth = 0;

  const dispatch = createEventDispatcher();

  $: {
    const charWidth = referenceWidth / 5;
    opCodesWidth = 14 * charWidth;
    labelWidth = 17 * charWidth;
    instructionWidth = 54 * charWidth;
    commentWidth = 120 * charWidth;
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

  .prefixComment {
    width: 100%;
    color: var(--vscode-terminal-ansiGreen);
    flex-grow: 0;
    flex-shrink: 0;
  }

  .address {
    color: var(--vscode-editorLineNumber-foreground);
    flex-grow: 0;
    flex-shrink: 0;
  }

  .opCodes {
    color: var(--vscode-terminal-ansiBlue);
    overflow: hidden;
    flex-grow: 0;
    flex-shrink: 0;
  }

  .label {
    color: var(--vscode-terminal-ansiBrightMagenta);
    overflow: hidden;
    flex-grow: 0;
    flex-shrink: 0;
  }

  .instruction {
    color: var(--vscode-terminal-ansiBrightCyan);
    overflow: hidden;
    flex-grow: 0;
    flex-shrink: 0.25;
  }

  .comment {
    color: var(--vscode-terminal-ansiBrightGreen);
    overflow: hidden;
    flex-grow: 1;
    flex-shrink: 1;
  }

  .item:hover {
    padding: 0px 7px;
    border: 1px solid var(--vscode-list-hoverBackground);
  }

  .currentBreakpoint {
    background-color: var(--vscode-list-hoverBackground);
  }
</style>

<div
  class="item"
  class:currentBreakpoint={isCurrentBreakpoint}
  on:click={() => dispatch('clicked')}>
  <BreakPointPlaceholder
    address={item.address}
    {hasBreakpoint}
    {isCurrentBreakpoint}
    {execState}
    {runsInDebug}
    isPrefix={item.isPrefixItem} />
  {#if item.isPrefixItem}
    <span
      class="prefixComment"
      title={item.prefixComment}>{item.prefixComment}</span>
  {:else}
    <span class="address" bind:clientWidth={referenceWidth}>
      {intToX4(item.address)}&nbsp;
    </span>
    <span
      class="opCodes"
      style="width:{opCodesWidth}px">{item.opCodes || ''}</span>
    <span class="label" style="width:{labelWidth}px">
      {item.formattedLabel}
    </span>
    <span class="instruction" style="width:{instructionWidth}px">
      {item.instruction}
    </span>
    <div
      class="comment"
      style="width:{commentWidth}px"
      title={item.formattedComment}>
      {item.formattedComment}
    </div>
  {/if}
</div>
