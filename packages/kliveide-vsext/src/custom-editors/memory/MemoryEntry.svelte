<script>
  import { intToX4, intToX2 } from "../../disassembler/disassembly-helper";

  export let item;
  export let registers;
  export let displayRegisters;
  export let machineType;

  let referenceWidth = 0;
  let memByteWidth = 0;
  let memByteMargin = 0;
  let stringWidth = 0;

  $: {
    const charWidth = referenceWidth / 4;
    memByteWidth = 3 * charWidth;
    memByteMargin = charWidth;
    stringWidth = 17 * charWidth;
  }

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
    return addr < 0x4000;
  }

  // --- Test if an address is a BANK address
  function isBank(addr) {
    return machineType !== "48" && addr >= 0xc000;
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

  .isRom {
    color: var(--vscode-terminal-ansiRed);
  }

  .isBank {
    color: var(--vscode-terminal-ansiYellow);
  }

  .value {
    color: var(--vscode-terminal-ansiBrightCyan);
    padding: 0px 2px;
    overflow: hidden;
    flex-grow: 0;
    flex-shrink: 0;
    text-align: center;
  }

  .value:hover {
    background: var(--vscode-list-hoverBackground);
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

  .register {
    background: var(--vscode-terminal-ansiMagenta);
    color: var(--vscode-terminal-ansiBrightWhite);
  }

  .register:hover {
    background: var(--vscode-terminal-ansiMagenta);
  }
</style>

<div class="item">
  <span
    class="address"
    class:isRom={isRom(item.address)}
    class:isBank={isBank(item.address)}
    bind:clientWidth={referenceWidth}
    title="{intToX4(item.address)} ({item.address})">
    {intToX4(item.address)}
  </span>
  <span class="separator" style="width:{2 * memByteMargin}px" />
  {#each item.contents as byte, i}
    <span
      class="value"
      class:register={hasPointingRegs(i, registers)}
      style="width:{memByteWidth}px"
      title={tooltip(i, registers)}>
      {intToX2(byte)}
    </span>
    {#if i % 8 === 7}
      <span class="separator" style="width:{memByteMargin}px" />
    {/if}
  {/each}
  <span class="string" style="width:{stringWidth}px">{item.charContents}</span>
</div>
