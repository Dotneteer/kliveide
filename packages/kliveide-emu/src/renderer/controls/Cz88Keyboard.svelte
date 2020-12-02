<script>
  import { onMount } from "svelte";
  import Cz88Key from "./Cz88Key.svelte";

  import { getVmEngine } from "../machine-loader";

  export let clientWidth;
  export let clientHeight;

  let zoom = 1.0;
  const defaultWidth = 15 * 108 + 200 + 48;
  const defaultHeight = 5 * (100 + 8) + 48;
  let row1Shift;
  let row2Shift;

  let spectrum;

  onMount(async () => {
    calculateDimensions(clientWidth, clientHeight, defaultWidth, defaultHeight);
    spectrum = await getVmEngine();
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
    margin: 0;
    display: flex;
    font-weight: bold;
  }

  .key-row-2-3 {
    display: flex;
    flex-direction: row;
  }

  .enter {
    background-color: green;
    width: 100%;
    height: 100%;
    flex-grow: 0;
    flex-shrink: 0;
  }
</style>

<div class="keyboard">
  <div class="key-row">
    <Cz88Key {zoom} code={15} on:clicked={handleKey} keyword="ESC" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="1" symbol="!" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="2" symbol="@" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="3" symbol="#" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="4" symbol="$" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="5" symbol="%" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="6" symbol="^" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="7" symbol="&" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="8" symbol="*" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="9" symbol="(" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="0" symbol=")" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="-" symbol="_" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="=" symbol="+" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="\" symbol="|" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} keyword="DEL" />
  </div>
  <div class=key-row-2-3>
    <div>
    <div class="key-row">
      <Cz88Key
        {zoom}
        code={15}
        on:clicked={handleKey}
        keyword="TAB"
        xwidth="140" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="Q" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="W" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="E" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="R" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="T" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="Y" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="U" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="I" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="O" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="P" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="[" symbol={'{'} />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="]" symbol={'}'} />
    </div>
    <div class="key-row">
      <Cz88Key
        {zoom}
        code={15}
        on:clicked={handleKey}
        keyword={'\u25c7'}
        vshift={8}
        fontSize={60}
        xwidth="180" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="A" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="S" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="D" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="F" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="G" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="H" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="J" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="K" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="L" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key=";" symbol=":" />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="'" symbol={'"'} />
      <Cz88Key {zoom} code={15} on:clicked={handleKey} key="Ł" symbol="~" />
    </div>
    </div>
    <div class="enter">

    </div>
  </div>
  <div class="key-row">
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword="SHIFT"
      xwidth="240" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="Z" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="X" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="C" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="V" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="B" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="N" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="M" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="," symbol="<" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="." symbol=">" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="/" symbol="?" />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword="SHIFT"
      xwidth="160" />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword={'\u21e7'}
      vshift={8}
      fontSize={60} />
  </div>
  <div class="key-row">
    <Cz88Key {zoom} code={15} on:clicked={handleKey} keyword="INDEX" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} keyword="MENU" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} keyword="HELP" />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword={'\u25fb'}
      vshift={8}
      fontSize={60} />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword="SPACE"
      xwidth="702" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} keyword="CAPS" />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword={'\u21e6'}
      fontSize={60}
      vshift={8} />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword={'\u21e8'}
      vshift={8}
      fontSize={60} />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      keyword={'\u21e9'}
      vshift={8}
      fontSize={60} />
  </div>
</div>
