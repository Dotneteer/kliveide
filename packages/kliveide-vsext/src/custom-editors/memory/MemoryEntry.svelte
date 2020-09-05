<script>
  // ==========================================================================
  // Displays a line (16 bytes) of the memory dump
  // For performance reasons, this components assembles the HTML contents
  // programmatically, instead of using Svelte features.
  // The component uses styles in global.css.

  import { intToX4, intToX2 } from "../../disassembler/disassembly-helper";

  // --- The item that contains the memory line
  export let item;

  // --- Current register values
  export let registers;

  // --- Enables/disables displaying register positions
  export let displayRegisters;

  // --- Type of the ZX Spectrum machine
  export let machineType;

  // --- Current view mode
  export let viewMode;

  // --- The HTML text of the component
  let htmlText;

  $: {
    htmlText =
      '<span class="memory-address ' +
      (isRom(item.address) ? " isRom" : "") +
      (isBank(item.address) ? " isBank" : "") +
      '" title="' +
      intToX4(item.address) +
      " (" +
      item.address +
      ')">' +
      intToX4(item.address) +
      "</span>";
    htmlText += '<span class="separator" />';
    for (let i = 0; i < item.contents.length; i++) {
      htmlText +=
        '<span class="memory-value ' +
        (hasPointingRegs(i, registers) ? "memory-register" : "") +
        '" title="' +
        tooltip(i, registers) +
        '">' +
        intToX2(item.contents[i]) +
        "</span>";
      if (i % 8 === 7) {
        htmlText += '<span class="separator" />';
      }
    }
    htmlText += '<span class="memory-string">' + item.charContents + "</span>";
    console.log(htmlText);
  }

  // --- Create the tooltip for the specified (i) position using the
  // --- register data (regs)
  function tooltip(i, regs) {
    const byte = item.contents[i];
    const address = item.address + i;
    const registerPointsTo = getPointingRegs(i, regs);
    return (
      `$${intToX4(address)} (${address}): ` +
      `$${intToX2(byte)} (${byte}${byte >= 128 ? " / " + (byte - 256) : ""})` +
      (registerPointsTo ? `\r\nPointed by: ${registerPointsTo}` : "")
    );
  }

  // --- Test the specified (i) position is pointed by any registers (regs)
  function hasPointingRegs(i, regs) {
    if (regs && displayRegisters) {
      const address = item.address + i;
      return (
        address === regs.bc ||
        address === regs.de ||
        address === regs.hl ||
        address === regs.pc ||
        address === regs.sp ||
        address === regs.ix ||
        address === regs.iy
      );
    }
    return false;
  }

  // --- Get the list of registers that point to the specified position
  function getPointingRegs(i, regs) {
    let result = "";
    if (!displayRegisters) {
      return;
    }
    if (regs) {
      const address = item.address + i;
      if (address === regs.bc) {
        result = "BC";
      }
      if (address === regs.de) {
        result += (result.length > 0 ? ", " : "") + "DE";
      }
      if (address === regs.hl) {
        result += (result.length > 0 ? ", " : "") + "HL";
      }
      if (address === regs.pc) {
        result += (result.length > 0 ? ", " : "") + "PC";
      }
      if (address === regs.sp) {
        result += (result.length > 0 ? ", " : "") + "SP";
      }
      if (address === regs.ix) {
        result += (result.length > 0 ? ", " : "") + "IX";
      }
      if (address === regs.iy) {
        result += (result.length > 0 ? ", " : "") + "IY";
      }
    }
    return result;
  }

  // --- Tests if an address is a ROM address
  function isRom(addr) {
    return viewMode === 2 ? false : addr < 0x4000;
  }

  // --- Test if an address is a BANK address
  function isBank(addr) {
    return machineType !== "48" && !viewMode && addr >= 0xc000;
  }
</script>

<style>
  .item {
    padding: 1px 8px;
    height: 20px;
    width: 100%;
    display: flex;
    flex-direction: row;
    flex-grow: 0;
    flex-shrink: 0;
    font-family: Consolas, "Courier New", monospace;
    font-size: 1.1em;
    overflow: hidden;
    align-items: flex-start;
  }
</style>

{#if item}
  <div class="item">
    {#if htmlText}
      {@html htmlText}
    {/if}
  </div>
{/if}
