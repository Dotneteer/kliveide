<script>
  import { onMount } from "svelte";
  import Cz88Key from "./Cz88Key.svelte";

  import { getVmEngine } from "../machine-loader";

  export let clientWidth;
  export let clientHeight;

  let zoom = 1.0;
  const defaultWidth = 15 * 108 + 200 + 48;
  const defaultHeight = 5 * (100 + 8) + 48;

  let cz88;

  onMount(async () => {
    calculateDimensions(clientWidth, clientHeight, defaultWidth, defaultHeight);
    cz88 = await getVmEngine();
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
  }

  function handleKey(e) {
    if (cz88.getKeyQueueLength() > 0) return;
    const ev = e.detail;
    const state = cz88.getMachineState();
    switch (ev.keyCategory) {
      case "main":
        cz88.queueKeyStroke(
          state.frameCount,
          16,
          ev.code,
          ev.button === 0 ? undefined : 54 /* Left shift */
        );
        break;
      case "symbol":
        cz88.queueKeyStroke(state.frameCount, 16, ev.code, 54 /* Left shift */);
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
    flex-grow: 0;
    flex-shrink: 0;
    font-weight: bold;
  }

  .key-row-2-3 {
    display: flex;
    flex-direction: row;
    flex-grow: 0;
    flex-shrink: 0;
    margin: 0;
  }

  .enter {
    display: flex;
    flex-grow: 0;
    flex-shrink: 0;
    font-weight: bold;
    margin: 0;
  }
</style>

<div class="keyboard">
  <div class="key-row">
    <Cz88Key {zoom} code={61} on:clicked={handleKey} keyword="ESC" />
    <Cz88Key {zoom} code={45} on:clicked={handleKey} key="1" symbol="!" />
    <Cz88Key {zoom} code={37} on:clicked={handleKey} key="2" symbol="@" />
    <Cz88Key {zoom} code={29} on:clicked={handleKey} key="3" symbol="#" />
    <Cz88Key {zoom} code={21} on:clicked={handleKey} key="4" symbol="$" />
    <Cz88Key {zoom} code={13} on:clicked={handleKey} key="5" symbol="%" />
    <Cz88Key {zoom} code={5} on:clicked={handleKey} key="6" symbol="^" />
    <Cz88Key {zoom} code={1} on:clicked={handleKey} key="7" symbol="&" />
    <Cz88Key {zoom} code={0} on:clicked={handleKey} key="8" symbol="*" />
    <Cz88Key {zoom} code={24} on:clicked={handleKey} key="9" symbol="(" />
    <Cz88Key {zoom} code={40} on:clicked={handleKey} key="0" symbol=")" />
    <Cz88Key {zoom} code={31} on:clicked={handleKey} key="-" symbol="_" />
    <Cz88Key {zoom} code={23} on:clicked={handleKey} key="=" symbol="+" />
    <Cz88Key {zoom} code={15} on:clicked={handleKey} key="\" symbol="|" />
    <Cz88Key {zoom} code={7} on:clicked={handleKey} keyword="DEL" />
  </div>
  <div class="key-row-2-3">
    <div style="margin:0">
      <div class="key-row">
        <Cz88Key
          {zoom}
          code={53}
          on:clicked={handleKey}
          keyword="TAB"
          xwidth="140" />
        <Cz88Key {zoom} code={44} on:clicked={handleKey} key="Q" />
        <Cz88Key {zoom} code={36} on:clicked={handleKey} key="W" />
        <Cz88Key {zoom} code={28} on:clicked={handleKey} key="E" />
        <Cz88Key {zoom} code={20} on:clicked={handleKey} key="R" />
        <Cz88Key {zoom} code={12} on:clicked={handleKey} key="T" />
        <Cz88Key {zoom} code={4} on:clicked={handleKey} key="Y" />
        <Cz88Key {zoom} code={9} on:clicked={handleKey} key="U" />
        <Cz88Key {zoom} code={8} on:clicked={handleKey} key="I" />
        <Cz88Key {zoom} code={16} on:clicked={handleKey} key="O" />
        <Cz88Key {zoom} code={32} on:clicked={handleKey} key="P" />
        <Cz88Key {zoom} code={47} on:clicked={handleKey} key="[" symbol={'{'} />
        <Cz88Key {zoom} code={39} on:clicked={handleKey} key="]" symbol={'}'} />
      </div>
      <div class="key-row">
        <Cz88Key
          {zoom}
          code={52}
          on:clicked={handleKey}
          keyword={'\u25c7'}
          vshift={8}
          fontSize={60}
          xwidth="180" />
        <Cz88Key {zoom} code={43} on:clicked={handleKey} key="A" />
        <Cz88Key {zoom} code={35} on:clicked={handleKey} key="S" />
        <Cz88Key {zoom} code={27} on:clicked={handleKey} key="D" />
        <Cz88Key {zoom} code={19} on:clicked={handleKey} key="F" />
        <Cz88Key {zoom} code={11} on:clicked={handleKey} key="G" />
        <Cz88Key {zoom} code={3} on:clicked={handleKey} key="H" />
        <Cz88Key {zoom} code={17} on:clicked={handleKey} key="J" />
        <Cz88Key {zoom} code={25} on:clicked={handleKey} key="K" />
        <Cz88Key {zoom} code={41} on:clicked={handleKey} key="L" />
        <Cz88Key {zoom} code={49} on:clicked={handleKey} key=";" symbol=":" />
        <Cz88Key {zoom} code={48} on:clicked={handleKey} key="'" symbol={'"'} />
        <Cz88Key
          {zoom}
          code={56}
          on:clicked={handleKey}
          key={'\u00a3'}
          symbol="~" />
      </div>
    </div>
    <div class="enter">
      <Cz88Key
        {zoom}
        code={6}
        on:clicked={handleKey}
        isEnter={true}
        xwidth={122}
        xheight={200} />
    </div>
  </div>
  <div class="key-row">
    <Cz88Key
      {zoom}
      code={54}
      on:clicked={handleKey}
      keyword="SHIFT"
      xwidth="240" />
    <Cz88Key {zoom} code={42} on:clicked={handleKey} key="Z" />
    <Cz88Key {zoom} code={34} on:clicked={handleKey} key="X" />
    <Cz88Key {zoom} code={26} on:clicked={handleKey} key="C" />
    <Cz88Key {zoom} code={18} on:clicked={handleKey} key="V" />
    <Cz88Key {zoom} code={10} on:clicked={handleKey} key="B" />
    <Cz88Key {zoom} code={2} on:clicked={handleKey} key="N" />
    <Cz88Key {zoom} code={33} on:clicked={handleKey} key="M" />
    <Cz88Key {zoom} code={50} on:clicked={handleKey} key="," symbol="<" />
    <Cz88Key {zoom} code={58} on:clicked={handleKey} key="." symbol=">" />
    <Cz88Key {zoom} code={57} on:clicked={handleKey} key="/" symbol="?" />
    <Cz88Key
      {zoom}
      code={63}
      on:clicked={handleKey}
      keyword="SHIFT"
      xwidth="160" />
    <Cz88Key
      {zoom}
      code={14}
      on:clicked={handleKey}
      keyword={'\u21e7'}
      vshift={8}
      fontSize={60} />
  </div>
  <div class="key-row">
    <Cz88Key {zoom} code={60} on:clicked={handleKey} keyword="INDEX" />
    <Cz88Key {zoom} code={51} on:clicked={handleKey} keyword="MENU" />
    <Cz88Key {zoom} code={55} on:clicked={handleKey} keyword="HELP" />
    <Cz88Key
      {zoom}
      code={62}
      on:clicked={handleKey}
      keyword={'\u25fb'}
      vshift={8}
      fontSize={60} />
    <Cz88Key
      {zoom}
      code={46}
      on:clicked={handleKey}
      keyword="SPACE"
      xwidth="702" />
    <Cz88Key {zoom} code={59} on:clicked={handleKey} top="CAPS" bottom="LOCK" />
    <Cz88Key
      {zoom}
      code={38}
      on:clicked={handleKey}
      keyword={'\u21e6'}
      fontSize={60}
      vshift={8} />
    <Cz88Key
      {zoom}
      code={30}
      on:clicked={handleKey}
      keyword={'\u21e8'}
      vshift={8}
      fontSize={60} />
    <Cz88Key
      {zoom}
      code={22}
      on:clicked={handleKey}
      keyword={'\u21e9'}
      vshift={8}
      fontSize={60} />
  </div>
</div>
