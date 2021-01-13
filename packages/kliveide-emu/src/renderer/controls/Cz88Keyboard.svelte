<script>
  import { onMount } from "svelte";
  import Cz88Key from "./Cz88Key.svelte";
  import { defaultZ88KeyboardLayout } from "../machines/cz88/key-layout-default";
  import { esZ88KeyboardLayout } from "../machines/cz88/key-layout-es";
  import { frZ88KeyboardLayout } from "../machines/cz88/key-layout-fr";
  import { deZ88KeyboardLayout } from "../machines/cz88/key-layout-de";
  import { dkZ88KeyboardLayout } from "../machines/cz88/key-layout-dk";
  import { seZ88KeyboardLayout } from "../machines/cz88/key-layout-se";

  import { getVmEngine } from "../machine-loader";

  export let clientWidth;
  export let clientHeight;

  let zoom = 1.0;
  const defaultWidth = 15 * 108 + 200 + 48;
  const defaultHeight = 5 * (100 + 8) + 48;

  let cz88;
  // let clo = defaultZ88KeyboardLayout;
  // let clo = esZ88KeyboardLayout;
  // let clo = frZ88KeyboardLayout;
  let clo = deZ88KeyboardLayout;
  // let clo = dkZ88KeyboardLayout;
  // let clo = seZ88KeyboardLayout;

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
    <Cz88Key
      {zoom}
      code={61}
      on:clicked={handleKey}
      keyword={clo.Escape.keyword} />
    <Cz88Key
      {zoom}
      code={45}
      on:clicked={handleKey}
      key={clo.N1.key}
      symbol={clo.N1.symbol}
      secondSymbol={clo.N1.secondSymbol} />
    <Cz88Key
      {zoom}
      code={37}
      on:clicked={handleKey}
      key={clo.N2.key}
      symbol={clo.N2.symbol}
      secondSymbol={clo.N2.secondSymbol} />
    <Cz88Key
      {zoom}
      code={29}
      on:clicked={handleKey}
      key={clo.N3.key}
      symbol={clo.N3.symbol}
      secondSymbol={clo.N3.secondSymbol} />
    <Cz88Key
      {zoom}
      code={21}
      on:clicked={handleKey}
      key={clo.N4.key}
      symbol={clo.N4.symbol}
      secondSymbol={clo.N4.secondSymbol} />
    <Cz88Key
      {zoom}
      code={13}
      on:clicked={handleKey}
      key={clo.N5.key}
      symbol={clo.N5.symbol}
      secondSymbol={clo.N5.secondSymbol} />
    <Cz88Key
      {zoom}
      code={5}
      on:clicked={handleKey}
      key={clo.N6.key}
      symbol={clo.N6.symbol}
      secondSymbol={clo.N6.secondSymbol} />
    <Cz88Key
      {zoom}
      code={1}
      on:clicked={handleKey}
      key={clo.N7.key}
      symbol={clo.N7.symbol}
      secondSymbol={clo.N7.secondSymbol} />
    <Cz88Key
      {zoom}
      code={0}
      on:clicked={handleKey}
      key={clo.N8.key}
      symbol={clo.N8.symbol}
      secondSymbol={clo.N8.secondSymbol} />
    <Cz88Key
      {zoom}
      code={24}
      on:clicked={handleKey}
      key={clo.N9.key}
      symbol={clo.N9.symbol}
      secondSymbol={clo.N9.secondSymbol} />
    <Cz88Key
      {zoom}
      code={40}
      on:clicked={handleKey}
      key={clo.N0.key}
      symbol={clo.N0.symbol}
      secondSymbol={clo.N0.secondSymbol} />
    <Cz88Key
      {zoom}
      code={31}
      on:clicked={handleKey}
      key={clo.Minus.key}
      symbol={clo.Minus.symbol}
      secondSymbol={clo.Minus.secondSymbol} />
    <Cz88Key
      {zoom}
      code={23}
      on:clicked={handleKey}
      key={clo.Equal.key}
      symbol={clo.Equal.symbol}
      secondSymbol={clo.Equal.secondSymbol} />
    <Cz88Key
      {zoom}
      code={15}
      on:clicked={handleKey}
      key={clo.Backslash.key}
      symbol={clo.Backslash.symbol}
      secondSymbol={clo.Backslash.secondSymbol} />
    <Cz88Key
      {zoom}
      code={7}
      on:clicked={handleKey}
      keyword={clo.Delete.keyword} />
  </div>
  <div class="key-row-2-3">
    <div style="margin:0">
      <div class="key-row">
        <Cz88Key
          {zoom}
          code={53}
          on:clicked={handleKey}
          keyword={clo.Tab.keyword}
          xwidth="140" />
        <Cz88Key
          {zoom}
          code={44}
          on:clicked={handleKey}
          key={clo.Q.key}
          symbol={clo.Q.symbol}
          secondSymbol={clo.Q.secondSymbol} />
        <Cz88Key
          {zoom}
          code={36}
          on:clicked={handleKey}
          key={clo.W.key}
          symbol={clo.W.symbol}
          secondSymbol={clo.W.secondSymbol} />
        <Cz88Key
          {zoom}
          code={28}
          on:clicked={handleKey}
          key={clo.E.key}
          symbol={clo.E.symbol}
          secondSymbol={clo.E.secondSymbol} />
        <Cz88Key
          {zoom}
          code={20}
          on:clicked={handleKey}
          key={clo.R.key}
          symbol={clo.R.symbol}
          secondSymbol={clo.R.secondSymbol} />
        <Cz88Key
          {zoom}
          code={12}
          on:clicked={handleKey}
          key={clo.T.key}
          symbol={clo.T.symbol}
          secondSymbol={clo.T.secondSymbol} />
        <Cz88Key
          {zoom}
          code={4}
          on:clicked={handleKey}
          key={clo.Y.key}
          symbol={clo.Y.symbol}
          secondSymbol={clo.Y.secondSymbol} />
        <Cz88Key
          {zoom}
          code={9}
          on:clicked={handleKey}
          key={clo.U.key}
          symbol={clo.U.symbol}
          secondSymbol={clo.U.secondSymbol} />
        <Cz88Key
          {zoom}
          code={8}
          on:clicked={handleKey}
          key={clo.I.key}
          symbol={clo.I.symbol}
          secondSymbol={clo.I.secondSymbol} />
        <Cz88Key
          {zoom}
          code={16}
          on:clicked={handleKey}
          key={clo.O.key}
          symbol={clo.O.symbol}
          secondSymbol={clo.O.secondSymbol} />
        <Cz88Key
          {zoom}
          code={32}
          on:clicked={handleKey}
          key={clo.P.key}
          symbol={clo.P.symbol}
          secondSymbol={clo.P.secondSymbol} />
        <Cz88Key
          {zoom}
          code={47}
          on:clicked={handleKey}
          key={clo.SBracketL.key}
          symbol={clo.SBracketL.symbol}
          secondSymbol={clo.SBracketL.secondSymbol} />
        <Cz88Key
          {zoom}
          code={39}
          on:clicked={handleKey}
          key={clo.SBracketR.key}
          symbol={clo.SBracketR.symbol}
          secondSymbol={clo.SBracketR.secondSymbol} />
      </div>
      <div class="key-row">
        <Cz88Key
          {zoom}
          code={52}
          on:clicked={handleKey}
          keyword={clo.Diamond.keyword}
          vshift={8}
          fontSize={60}
          xwidth="180" />
        <Cz88Key
          {zoom}
          code={43}
          on:clicked={handleKey}
          key={clo.A.key}
          symbol={clo.A.symbol}
          secondSymbol={clo.A.secondSymbol} />
        <Cz88Key
          {zoom}
          code={35}
          on:clicked={handleKey}
          key={clo.S.key}
          symbol={clo.S.symbol}
          secondSymbol={clo.S.secondSymbol} />
        <Cz88Key
          {zoom}
          code={27}
          on:clicked={handleKey}
          key={clo.D.key}
          symbol={clo.D.symbol}
          secondSymbol={clo.D.secondSymbol} />
        <Cz88Key
          {zoom}
          code={19}
          on:clicked={handleKey}
          key={clo.F.key}
          symbol={clo.F.symbol}
          secondSymbol={clo.F.secondSymbol} />
        <Cz88Key
          {zoom}
          code={11}
          on:clicked={handleKey}
          key={clo.G.key}
          symbol={clo.G.symbol}
          secondSymbol={clo.G.secondSymbol} />
        <Cz88Key
          {zoom}
          code={3}
          on:clicked={handleKey}
          key={clo.H.key}
          symbol={clo.H.symbol}
          secondSymbol={clo.H.secondSymbol} />
        <Cz88Key
          {zoom}
          code={17}
          on:clicked={handleKey}
          key={clo.J.key}
          symbol={clo.J.symbol}
          secondSymbol={clo.J.secondSymbol} />
        <Cz88Key
          {zoom}
          code={25}
          on:clicked={handleKey}
          key={clo.K.key}
          symbol={clo.K.symbol}
          secondSymbol={clo.K.secondSymbol} />
        <Cz88Key
          {zoom}
          code={41}
          on:clicked={handleKey}
          key={clo.L.key}
          symbol={clo.L.symbol}
          secondSymbol={clo.L.secondSymbol} />
        <Cz88Key
          {zoom}
          code={49}
          on:clicked={handleKey}
          key={clo.Semicolon.key}
          symbol={clo.Semicolon.symbol}
          secondSymbol={clo.Semicolon.secondSymbol} />
        <Cz88Key
          {zoom}
          code={48}
          on:clicked={handleKey}
          key={clo.Quote.key}
          symbol={clo.Quote.symbol}
          secondSymbol={clo.Quote.secondSymbol} />
        <Cz88Key
          {zoom}
          code={56}
          on:clicked={handleKey}
          key={clo.Pound.key}
          symbol={clo.Pound.symbol}
          secondSymbol={clo.Pound.secondSymbol} />
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
      keyword={clo.ShiftL.keyword}
      xwidth="240" />
    <Cz88Key
      {zoom}
      code={42}
      on:clicked={handleKey}
      key={clo.Z.key}
      symbol={clo.Z.symbol}
      secondSymbol={clo.Z.secondSymbol} />
    <Cz88Key
      {zoom}
      code={34}
      on:clicked={handleKey}
      key={clo.X.key}
      symbol={clo.X.symbol}
      secondSymbol={clo.X.secondSymbol} />
    <Cz88Key
      {zoom}
      code={26}
      on:clicked={handleKey}
      key={clo.C.key}
      symbol={clo.C.symbol}
      secondSymbol={clo.C.secondSymbol} />
    <Cz88Key
      {zoom}
      code={18}
      on:clicked={handleKey}
      key={clo.V.key}
      symbol={clo.V.symbol}
      secondSymbol={clo.V.secondSymbol} />
    <Cz88Key
      {zoom}
      code={10}
      on:clicked={handleKey}
      key={clo.B.key}
      symbol={clo.B.symbol}
      secondSymbol={clo.B.secondSymbol} />
    <Cz88Key
      {zoom}
      code={2}
      on:clicked={handleKey}
      key={clo.N.key}
      symbol={clo.N.symbol}
      secondSymbol={clo.N.secondSymbol} />
    <Cz88Key
      {zoom}
      code={33}
      on:clicked={handleKey}
      key={clo.M.key}
      symbol={clo.M.symbol}
      secondSymbol={clo.M.secondSymbol} />
    <Cz88Key
      {zoom}
      code={50}
      on:clicked={handleKey}
      key={clo.Comma.key}
      symbol={clo.Comma.symbol}
      secondSymbol={clo.Comma.secondSymbol} />
    <Cz88Key
      {zoom}
      code={58}
      on:clicked={handleKey}
      key={clo.Period.key}
      symbol={clo.Period.symbol}
      secondSymbol={clo.Period.secondSymbol} />
    <Cz88Key
      {zoom}
      code={57}
      on:clicked={handleKey}
      key={clo.Slash.key}
      symbol={clo.Slash.symbol}
      secondSymbol={clo.Slash.secondSymbol} />
    <Cz88Key
      {zoom}
      code={63}
      on:clicked={handleKey}
      keyword={clo.ShiftR.keyword}
      xwidth="160" />
    <Cz88Key
      {zoom}
      code={14}
      on:clicked={handleKey}
      keyword={clo.Up.keyword}
      vshift={8}
      fontSize={60} />
  </div>
  <div class="key-row">
    <Cz88Key
      {zoom}
      code={60}
      on:clicked={handleKey}
      keyword={clo.Index.keyword} />
    <Cz88Key
      {zoom}
      code={51}
      on:clicked={handleKey}
      keyword={clo.Menu.keyword} />
    <Cz88Key
      {zoom}
      code={55}
      on:clicked={handleKey}
      keyword={clo.Help.keyword} />
    <Cz88Key
      {zoom}
      code={62}
      on:clicked={handleKey}
      keyword={clo.Square.keyword}
      vshift={8}
      fontSize={60} />
    <Cz88Key
      {zoom}
      code={46}
      on:clicked={handleKey}
      keyword={clo.Space.keyword}
      xwidth="702" />
    <Cz88Key {zoom} code={59} on:clicked={handleKey} top="CAPS" bottom="LOCK" />
    <Cz88Key
      {zoom}
      code={38}
      on:clicked={handleKey}
      keyword={clo.Left.keyword}
      fontSize={60}
      vshift={8} />
    <Cz88Key
      {zoom}
      code={30}
      on:clicked={handleKey}
      keyword={clo.Right.keyword}
      vshift={8}
      fontSize={60} />
    <Cz88Key
      {zoom}
      code={22}
      on:clicked={handleKey}
      keyword={clo.Down.keyword}
      vshift={8}
      fontSize={60} />
  </div>
</div>
