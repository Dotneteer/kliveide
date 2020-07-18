<script>
  import { onMount } from "svelte";
  import Sp48Key from "./Sp48Key.svelte";

  import { getSpectrumEngine } from "../spectrum-loader";

  export let clientWidth;
  export let clientHeight;

  let zoom = 1.0;
  const defaultWidth = 10 * 104 + 130 + 48;
  const defaultHeight = 4 * (128 + 8) + 48;
  let row1Shift;
  let row2Shift;

  let spectrum;

  onMount(async () => {
    calculateDimensions(clientWidth, clientHeight, defaultWidth, defaultHeight);
    spectrum = await getSpectrumEngine();
  });

  // --- Respond to panel size changes
  $: {
    calculateDimensions(clientWidth, clientHeight, defaultWidth, defaultHeight);
  }

  function calculateDimensions(clientWidth, clientHeight, width, height) {
    if (!clientWidth || !clientHeight) return;
    let widthRatio = (clientWidth - 24) / width;
    let heightRatio = (clientHeight - 32) / height;
    zoom = Math.min(widthRatio, heightRatio);
    row1Shift = 80 * zoom;
    row2Shift = 110 * zoom;
  }

  function handleKey(e) {
    if (spectrum.getKeyQueueLength() > 0) return;
    const ev = e.detail;
    const state = spectrum.getMachineState();
    console.log(ev);
    switch (ev.keyCategory) {
      case "main":
        spectrum.queueKeyStroke(
          state.frameCount,
          2,
          ev.code,
          ev.button === 0 ? undefined : 0 /* CShift */
        );
        break;
      case "symbol":
        spectrum.queueKeyStroke(state.frameCount, 2, ev.code, 36 /* SShift */);
        break;
      case "above":
        spectrum.queueKeyStroke(
          state.frameCount,
          2,
          0 /* CShift */,
          36 /* SShift */
        );
        spectrum.queueKeyStroke(
          state.frameCount + 3,
          2,
          ev.code,
          ev.button === 0 ? undefined : 0 /* CShift */
        );
        break;
      case "below":
        spectrum.queueKeyStroke(
          state.frameCount,
          2,
          0 /* CShift */,
          36 /* SShift */
        );
        spectrum.queueKeyStroke(
          state.frameCount + 3,
          2,
          ev.code,
          36 /* SShift */
        );
        break;
      case "topNum":
        spectrum.queueKeyStroke(
          state.frameCount + 3,
          2,
          ev.code, 0);
        break;
      case "glyph":
        if (spectrum.getCursorMode() & 0x02 !== 0) return;
        spectrum.queueKeyStroke(
          state.frameCount,
          2,
          21 /* N9 */, 0 /* CShift */);
        spectrum.queueKeyStroke(
          state.frameCount + 3,
          2,
          ev.code, ev.button === 0 ? undefined : 0 /* CShift */);
        spectrum.queueKeyStroke(
          state.frameCount + 6,
          2,
          21 /* N9 */, 0 /* CShift */);
        break;
    }
  }
</script>

<style>
  .keyboard {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    flex-grow: 0;
    height: 100%;
    background-color: transparent;
    box-sizing: border-box;
    align-content: start;
    justify-items: start;
    justify-content: center;
    overflow: hidden;
  }

  .key-row {
    padding: 0px 0px;
  }
</style>

<div class="keyboard">
  <div class="key-row">
    <Sp48Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      topNum="BLUE"
      topNumColor="#0030ff"
      key="1"
      symbol="!"
      above="EDIT"
      below="DEF FN"
      glyph="1" />
    <Sp48Key
      {zoom}
      code={16}
      on:clicked={handleKey}
      topNum="RED"
      topNumColor="#ff0000"
      key="2"
      symbol="@"
      above="CAPS LOCK"
      below="FN"
      glyph="2" />
    <Sp48Key
      {zoom}
      code={17}
      on:clicked={handleKey}
      topNum="MAGENTA"
      topNumColor="#e000e0"
      key="3"
      symbol="#"
      above="TRUE VID"
      below="LINE"
      glyph="3" />
    <Sp48Key
      {zoom}
      code={18}
      on:clicked={handleKey}
      topNum="GREEN"
      topNumColor="#00c000"
      key="4"
      symbol="$"
      above="INV.VIDEO"
      below="OPEN"
      glyph="4" />
    <Sp48Key
      {zoom}
      code={19}
      on:clicked={handleKey}
      topNum="CYAN"
      topNumColor="#00c0c0"
      key="5"
      symbol="%"
      above={'\u140a'}
      below="CLOSE"
      glyph="5" />
    <Sp48Key
      {zoom}
      code={24}
      on:clicked={handleKey}
      topNum="YELLOW"
      topNumColor="#fff000"
      key="6"
      symbol={'&'}
      above={'\u1401'}
      below="MOVE"
      glyph="6" />
    <Sp48Key
      {zoom}
      code={23}
      on:clicked={handleKey}
      topNum="WHITE"
      topNumColor="#ffffff"
      key="7"
      symbol={"'"}
      above={'\u1403'}
      below="ERASE"
      glyph="7" />
    <Sp48Key
      {zoom}
      code={22}
      on:clicked={handleKey}
      topNum="UNBRIGHT"
      topNumColor="#a0a0a0"
      key="8"
      symbol={'('}
      above={'\u1405'}
      below="POINT"
      glyph="16" />
    <Sp48Key
      {zoom}
      code={21}
      on:clicked={handleKey}
      topNum="BRIGHT"
      key="9"
      symbol={')'}
      above="GRAPHICS"
      below="CAT" />
    <Sp48Key
      {zoom}
      code={20}
      on:clicked={handleKey}
      topNum="BLACK"
      topNumColor="#606060"
      key="0"
      symbol={'\uff3f'}
      above="DELETE"
      below="FORMAT" />
  </div>
  <div class="key-row" style="margin-left:{row1Shift}px">
    <Sp48Key
      {zoom}
      code={10}
      on:clicked={handleKey}
      key="Q"
      keyword="PLOT"
      symbol="<="
      above="SIN"
      below="ASN" />
    <Sp48Key
      {zoom}
      code={11}
      on:clicked={handleKey}
      key="W"
      keyword="DRAW"
      symbol="<>"
      above="COS"
      below="ACS" />
    <Sp48Key
      {zoom}
      code={12}
      on:clicked={handleKey}
      key="E"
      keyword="REM"
      symbol=">="
      above="TAN"
      below="ATB" />
    <Sp48Key
      {zoom}
      code={13}
      on:clicked={handleKey}
      key="R"
      keyword="RUN"
      symbol="<"
      above="INT"
      below="VERIFY" />
    <Sp48Key
      {zoom}
      code={14}
      on:clicked={handleKey}
      key="T"
      keyword="RAND"
      symbol=">"
      above="RND"
      below="MERGE" />
    <Sp48Key
      {zoom}
      code={29}
      on:clicked={handleKey}
      key="Y"
      keyword="RETURN"
      symbolWord="AND"
      above="STR$"
      below="[" />
    <Sp48Key
      {zoom}
      code={28}
      on:clicked={handleKey}
      key="U"
      keyword="IF"
      symbolWord="OR"
      above="CHR$"
      below="]" />
    <Sp48Key
      {zoom}
      code={27}
      on:clicked={handleKey}
      key="I"
      keyword="INPUT"
      symbolWord="AT"
      above="CODE"
      below="IN" />
    <Sp48Key
      {zoom}
      code={26}
      on:clicked={handleKey}
      key="O"
      keyword="POKE"
      symbol=";"
      above="PEEK"
      below="OUT" />
    <Sp48Key
      {zoom}
      code={25}
      on:clicked={handleKey}
      key="P"
      keyword="PRINT"
      symbol={'"'}
      above="TAB"
      below="(C)" />
  </div>
  <div class="key-row" style="margin-left:{row2Shift}px">
    <Sp48Key
      {zoom}
      code={5}
      on:clicked={handleKey}
      key="A"
      keyword="NEW"
      symbolWord="STOP"
      above="READ"
      below="~" />
    <Sp48Key
      {zoom}
      code={6}
      on:clicked={handleKey}
      key="S"
      keyword="SAVE"
      symbolWord="NOT"
      above="RESTORE"
      below="|" />
    <Sp48Key
      {zoom}
      code={7}
      on:clicked={handleKey}
      key="D"
      keyword="DIM"
      symbolWord="STEP"
      above="DATA"
      below="\" />
    <Sp48Key
      {zoom}
      code={8}
      on:clicked={handleKey}
      key="F"
      keyword="FOR"
      symbolWord="TO"
      above="SGN"
      below={'{'} />
    <Sp48Key
      {zoom}
      code={9}
      on:clicked={handleKey}
      key="G"
      keyword="GOTO"
      symbolWord="THEN"
      above="ABS"
      below="}" />
    <Sp48Key
      {zoom}
      code={34}
      on:clicked={handleKey}
      key="H"
      keyword="GOSUB"
      symbol={'\u2191'}
      above="SQR"
      below="CIRCLE" />
    <Sp48Key
      {zoom}
      code={33}
      on:clicked={handleKey}
      key="J"
      keyword="LOAD"
      symbol={'\u2212'}
      above="VAL"
      below="VAL$" />
    <Sp48Key
      {zoom}
      code={32}
      on:clicked={handleKey}
      key="K"
      keyword="LIST"
      symbol="+"
      above="LEN"
      below="SCREEN$" />
    <Sp48Key
      {zoom}
      code={31}
      on:clicked={handleKey}
      key="L"
      keyword="LET"
      symbol="="
      above="USR"
      below="ATTR" />
    <Sp48Key {zoom} code={30} on:clicked={handleKey} center="ENTER" />
  </div>
  <div class="key-row">
    <Sp48Key
      {zoom}
      code={0}
      on:clicked={handleKey}
      xwidth="130"
      top="CAPS"
      bottom="SHIFT" />
    <Sp48Key
      {zoom}
      code={1}
      on:clicked={handleKey}
      key="Z"
      keyword="COPY"
      symbol=":"
      above="LN"
      below="BEEP" />
    <Sp48Key
      {zoom}
      code={2}
      on:clicked={handleKey}
      key="X"
      keyword="CLEAR"
      symbol={'\u00a3'}
      above="EXP"
      below="INK" />
    <Sp48Key
      {zoom}
      code={3}
      on:clicked={handleKey}
      key="C"
      keyword="CONT"
      symbol="?"
      above="LPRINT"
      below="PAPER" />
    <Sp48Key
      {zoom}
      code={4}
      on:clicked={handleKey}
      key="V"
      keyword="CLS"
      symbol="/"
      above="LLIST"
      below="FLASH" />
    <Sp48Key
      {zoom}
      code={39}
      on:clicked={handleKey}
      key="B"
      keyword="BORDER"
      symbol="*"
      above="BIN"
      below="BRIGHT" />
    <Sp48Key
      {zoom}
      code={38}
      on:clicked={handleKey}
      key="N"
      keyword="NEXT"
      symbol=","
      above="INKEY$"
      below="OVER" />
    <Sp48Key
      {zoom}
      code={37}
      on:clicked={handleKey}
      key="M"
      keyword="PAUSE"
      symbol="."
      above="INVERSE"
      below="PI" />
    <Sp48Key
      {zoom}
      code={36}
      on:clicked={handleKey}
      top="SYMBOL"
      bottom="SHIFT"
      useSymColor={true} />
    <Sp48Key
      {zoom}
      code={35}
      on:clicked={handleKey}
      xwidth="180"
      top="BREAK"
      center="SPACE" />
  </div>
</div>
