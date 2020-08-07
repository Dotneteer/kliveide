<script>
  import { afterUpdate, tick } from "svelte";
  import BreakpointPlaceholder from "./BreakPointPlaceholder.svelte";
  import BreakPointPlaceholder from "./BreakPointPlaceholder.svelte";
  import { intToX4 } from "../../disassembler/disassembly-helper";

  export let item;

  let referenceWidth = 0;
  let opCodesWidth = 0;
  let labelWidth = 0;
  let instructionWidth = 0;

  $: {
    const charWidth = referenceWidth / 5;
    opCodesWidth = 14 * charWidth;
    labelWidth = 17 * charWidth;
    instructionWidth = 41 * charWidth;
  }
</script>

<style>
  .item {
    padding: 0px 8px;
    display: flex;
    flex-direction: row;
    font-family: Consolas, "Courier New", monospace;
    overflow-x: hidden;
  }
  .address {
    color: var(--vscode-editorLineNumber-foreground);
  }

  .opCodes {
    color: #00afff;
    overflow-x: hidden;
  }

  .label {
    color: #f89406;
    overflow-x: hidden;
  }

  .instruction {
    color: #00afff;
    overflow-x: hidden;
  }

  .item:hover {
    background: var(--vscode-list-hoverBackground);
  }
</style>

<div class="item">
  <BreakPointPlaceholder />
  <span class="address" bind:clientWidth={referenceWidth}>
    {intToX4(item.address)}&nbsp;
  </span>
  <span class="opCodes" style="width:{opCodesWidth}px">{item.opCodes}</span>
  <span class="label" style="width:{labelWidth}px">
    {item.hasLabel ? 'L' + intToX4(item.address) : ''}
  </span>
  <span class="instruction" style="width:{instructionWidth}px">{item.instruction}</span>
</div>
