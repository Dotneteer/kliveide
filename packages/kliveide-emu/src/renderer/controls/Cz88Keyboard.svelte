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
  export let layout;

  let zoom = 1.0;
  const defaultWidth = 15 * 108 + 200 + 48;
  const defaultHeight = 5 * (100 + 8) + 48;

  // --- Special key codes
  const LEFT_SHIFT_KEY = 54;
  const SQUARE_KEY = 62;
  const DIAMOND_KEY = 52;

  let cz88;
  let clo;

  onMount(async () => {
    calculateDimensions(clientWidth, clientHeight, defaultWidth, defaultHeight);
    cz88 = await getVmEngine();
  });

  // --- Respond to panel size changes
  $: {
    calculateDimensions(clientWidth, clientHeight, defaultWidth, defaultHeight);
  }

  $: {
    switch (layout) {
      case "es":
        clo = esZ88KeyboardLayout;
        break;
      case "fr":
        clo = frZ88KeyboardLayout;
        break;
      case "de":
        clo = deZ88KeyboardLayout;
        break;
      case "dk":
        clo = dkZ88KeyboardLayout;
        break;
      case "se":
        clo = seZ88KeyboardLayout;
        break;
      default:
        clo = defaultZ88KeyboardLayout;
        break;
    }
  }

  function calculateDimensions(clientWidth, clientHeight, width, height) {
    if (!clientWidth || !clientHeight) return;
    let widthRatio = (clientWidth - 24) / width;
    let heightRatio = (clientHeight - 32) / height;
    zoom = Math.min(widthRatio, heightRatio);
  }

  // --- Handles the mouse action
  function handleMouse(e) {
    // --- Set status of the primary key
    const ev = e.detail;
    cz88.setKeyStatus(ev.code, ev.isDown);

    // --- Set status of the secondary key
    switch (ev.iconCount) {
      case 1:
        if (!ev.isLeft) {
          cz88.setKeyStatus(LEFT_SHIFT_KEY, ev.isDown);
        }
        break;
      case 2:
        if (ev.target === "symbol") {
          cz88.setKeyStatus(ev.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, ev.isDown);
        }
        break;
      case 3:
      if (ev.target === "key" && !ev.isLeft) {
          cz88.setKeyStatus(LEFT_SHIFT_KEY, ev.isDown);
        } else if (ev.target === "symbol") {
          if (ev.special === "dk") {
            cz88.setKeyStatus(SQUARE_KEY, ev.isDown);
          } else {
            cz88.setKeyStatus(ev.isLeft ? LEFT_SHIFT_KEY : SQUARE_KEY, ev.isDown);
          }
        } else if (ev.target === "secondSymbol" && ev.isLeft) {
          cz88.setKeyStatus(DIAMOND_KEY, ev.isDown);
        }
        break;
    }
  }
</script>

<div class="keyboard">
  <div class="key-row">
    <Cz88Key {zoom} code={61} layoutInfo={clo.Escape} on:do={handleMouse} />
    <Cz88Key {zoom} code={45} layoutInfo={clo.N1} on:do={handleMouse} />
    <Cz88Key {zoom} code={37} layoutInfo={clo.N2} on:do={handleMouse} />
    <Cz88Key {zoom} code={29} layoutInfo={clo.N3} on:do={handleMouse} />
    <Cz88Key {zoom} code={21} layoutInfo={clo.N4} on:do={handleMouse} />
    <Cz88Key {zoom} code={13} layoutInfo={clo.N5} on:do={handleMouse} />
    <Cz88Key {zoom} code={5} layoutInfo={clo.N6} on:do={handleMouse} />
    <Cz88Key {zoom} code={1} layoutInfo={clo.N7} on:do={handleMouse} />
    <Cz88Key {zoom} code={0} layoutInfo={clo.N8} on:do={handleMouse} />
    <Cz88Key {zoom} code={24} layoutInfo={clo.N9} on:do={handleMouse} />
    <Cz88Key {zoom} code={40} layoutInfo={clo.N0} on:do={handleMouse} />
    <Cz88Key {zoom} code={31} layoutInfo={clo.Minus} on:do={handleMouse} />
    <Cz88Key {zoom} code={23} layoutInfo={clo.Equal} on:do={handleMouse} />
    <Cz88Key {zoom} code={15} layoutInfo={clo.Backslash} on:do={handleMouse} />
    <Cz88Key {zoom} code={7} layoutInfo={clo.Delete} on:do={handleMouse} />
  </div>
  <div class="key-row-2-3">
    <div style="margin:0">
      <div class="key-row">
        <Cz88Key
          {zoom}
          code={53}
          layoutInfo={clo.Tab}
          on:do={handleMouse}
          xwidth="140"
        />
        <Cz88Key {zoom} code={44} layoutInfo={clo.Q} on:do={handleMouse} />
        <Cz88Key {zoom} code={36} layoutInfo={clo.W} on:do={handleMouse} />
        <Cz88Key {zoom} code={28} layoutInfo={clo.E} on:do={handleMouse} />
        <Cz88Key {zoom} code={20} layoutInfo={clo.R} on:do={handleMouse} />
        <Cz88Key {zoom} code={12} layoutInfo={clo.T} on:do={handleMouse} />
        <Cz88Key {zoom} code={4} layoutInfo={clo.Y} on:do={handleMouse} />
        <Cz88Key {zoom} code={9} layoutInfo={clo.U} on:do={handleMouse} />
        <Cz88Key {zoom} code={8} layoutInfo={clo.I} on:do={handleMouse} />
        <Cz88Key {zoom} code={16} layoutInfo={clo.O} on:do={handleMouse} />
        <Cz88Key {zoom} code={32} layoutInfo={clo.P} on:do={handleMouse} />
        <Cz88Key
          {zoom}
          code={47}
          layoutInfo={clo.SBracketL}
          on:do={handleMouse}
        />
        <Cz88Key
          {zoom}
          code={39}
          layoutInfo={clo.SBracketR}
          on:do={handleMouse}
        />
      </div>
      <div class="key-row">
        <Cz88Key
          {zoom}
          code={52}
          layoutInfo={clo.Diamond}
          on:do={handleMouse}
          vshift={8}
          fontSize={60}
          xwidth="180"
        />
        <Cz88Key {zoom} code={43} layoutInfo={clo.A} on:do={handleMouse} />
        <Cz88Key {zoom} code={35} layoutInfo={clo.S} on:do={handleMouse} />
        <Cz88Key {zoom} code={27} layoutInfo={clo.D} on:do={handleMouse} />
        <Cz88Key {zoom} code={19} layoutInfo={clo.F} on:do={handleMouse} />
        <Cz88Key {zoom} code={11} layoutInfo={clo.G} on:do={handleMouse} />
        <Cz88Key {zoom} code={3} layoutInfo={clo.H} on:do={handleMouse} />
        <Cz88Key {zoom} code={17} layoutInfo={clo.J} on:do={handleMouse} />
        <Cz88Key {zoom} code={25} layoutInfo={clo.K} on:do={handleMouse} />
        <Cz88Key {zoom} code={41} layoutInfo={clo.L} on:do={handleMouse} />
        <Cz88Key
          {zoom}
          code={49}
          layoutInfo={clo.Semicolon}
          on:do={handleMouse}
        />
        <Cz88Key {zoom} code={48} layoutInfo={clo.Quote} on:do={handleMouse} />
        <Cz88Key {zoom} code={56} layoutInfo={clo.Pound} on:do={handleMouse} />
      </div>
    </div>
    <div class="enter">
      <Cz88Key
        {zoom}
        code={6}
        on:do={handleMouse}
        isEnter={true}
        xwidth={122}
        xheight={200}
      />
    </div>
  </div>
  <div class="key-row">
    <Cz88Key
      {zoom}
      code={54}
      layoutInfo={clo.ShiftL}
      on:do={handleMouse}
      xwidth="240"
    />
    <Cz88Key {zoom} code={42} layoutInfo={clo.Z} on:do={handleMouse} />
    <Cz88Key {zoom} code={34} layoutInfo={clo.X} on:do={handleMouse} />
    <Cz88Key {zoom} code={26} layoutInfo={clo.C} on:do={handleMouse} />
    <Cz88Key {zoom} code={18} layoutInfo={clo.V} on:do={handleMouse} />
    <Cz88Key {zoom} code={10} layoutInfo={clo.B} on:do={handleMouse} />
    <Cz88Key {zoom} code={2} layoutInfo={clo.N} on:do={handleMouse} />
    <Cz88Key {zoom} code={33} layoutInfo={clo.M} on:do={handleMouse} />
    <Cz88Key {zoom} code={50} layoutInfo={clo.Comma} on:do={handleMouse} />
    <Cz88Key {zoom} code={58} layoutInfo={clo.Period} on:do={handleMouse} />
    <Cz88Key {zoom} code={57} layoutInfo={clo.Slash} on:do={handleMouse} />
    <Cz88Key
      {zoom}
      code={63}
      layoutInfo={clo.ShiftR}
      on:do={handleMouse}
      xwidth="160"
    />
    <Cz88Key
      {zoom}
      code={14}
      layoutInfo={clo.Up}
      on:do={handleMouse}
      vshift={8}
      fontSize={60}
    />
  </div>
  <div class="key-row">
    <Cz88Key {zoom} code={60} layoutInfo={clo.Index} on:do={handleMouse} />
    <Cz88Key {zoom} code={51} layoutInfo={clo.Menu} on:do={handleMouse} />
    <Cz88Key {zoom} code={55} layoutInfo={clo.Help} on:do={handleMouse} />
    <Cz88Key
      {zoom}
      code={62}
      layoutInfo={clo.Square}
      on:do={handleMouse}
      vshift={8}
      fontSize={60}
    />
    <Cz88Key
      {zoom}
      code={46}
      layoutInfo={clo.Space}
      on:do={handleMouse}
      xwidth="702"
    />
    <Cz88Key {zoom} code={59} on:do={handleMouse} top="CAPS" bottom="LOCK" />
    <Cz88Key
      {zoom}
      code={38}
      layoutInfo={clo.Left}
      on:do={handleMouse}
      fontSize={60}
      vshift={8}
    />
    <Cz88Key
      {zoom}
      code={30}
      layoutInfo={clo.Right}
      on:do={handleMouse}
      vshift={8}
      fontSize={60}
    />
    <Cz88Key
      {zoom}
      code={22}
      layoutInfo={clo.Down}
      on:do={handleMouse}
      vshift={8}
      fontSize={60}
    />
  </div>
</div>

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
