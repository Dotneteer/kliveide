<script>
  import { createEventDispatcher } from "svelte";
  import { themeStore } from "../stores/theme-store";

  export let zoom = 1.0;
  export let code;
  export let key;
  export let keyword;
  export let symbol;
  export let symbolWord;
  export let above;
  export let below;
  export let topNum;
  export let topNumColor;
  export let center;
  export let top;
  export let bottom;
  export let xwidth;
  export let useSymColor;
  export let glyph;

  // --- Dimensions
  const normalWidth = 100;
  let mouseOverKey = false;
  let mouseOverSymbol = false;
  let mouseOverAbove = false;
  let mouseOverBelow = false;
  let mouseOverTopNum = false;
  let mouseOverGlyph = false;

  // --- Colors
  const keyBackground = themeStore.getProperty("--key-background-color");
  const mainKeyColor = themeStore.getProperty("--key-main-color");
  const symbolKeyColor = themeStore.getProperty("--key-symbol-color");
  const aboveKeyColor = themeStore.getProperty("--key-above-color");
  const belowKeyColor = themeStore.getProperty("--key-below-color");
  const highlightKeyColor = themeStore.getProperty("--key-highlight-color");

  $: normalHeight = topNum ? 148 : 128;
  $: heightOffset = topNum ? 20 : 0;
  $: currentWidth = zoom * (xwidth || normalWidth);
  $: currentHeight = zoom * normalHeight;
  $: mainFillColor = mouseOverKey ? highlightKeyColor : mainKeyColor;
  $: mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  $: symbolFillColor = mouseOverSymbol ? highlightKeyColor : symbolKeyColor;
  $: symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : "transparent";
  $: aboveFillColor = mouseOverAbove
    ? highlightKeyColor
    : topNum
    ? mainKeyColor
    : aboveKeyColor;
  $: aboveStrokeColor = mouseOverAbove ? highlightKeyColor : "transparent";
  $: belowFillColor = mouseOverBelow ? highlightKeyColor : belowKeyColor;
  $: belowStrokeColor = mouseOverBelow ? highlightKeyColor : "transparent";
  $: topNumFillColor = mouseOverTopNum
    ? highlightKeyColor
    : topNumColor || mainKeyColor;
  $: topNumStrokeColor = mouseOverTopNum ? highlightKeyColor : "transparent";
  $: glyphFillColor = mouseOverGlyph ? highlightKeyColor : mainKeyColor;
  $: cursor =
    mouseOverKey |
    mouseOverSymbol |
    mouseOverAbove |
    mouseOverBelow |
    mouseOverTopNum
      ? "pointer"
      : "default";

  const dispatch = createEventDispatcher();

  function raiseClicked(e, code, keyCategory) {
    dispatch("clicked", {
      code,
      keyCategory,
      altKey: e.altKey,
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey
    })
  }
</script>

<svg
  width={currentWidth}
  height={currentHeight}
  viewBox="0 0 {xwidth || 100}
  {normalHeight}"
  style="margin-right: 4px;"
  xmlns="http://www.w3.org/2000/svg">

  <rect
    x="0"
    y={30 + heightOffset}
    rx="8"
    ry="8"
    width="100%"
    height="70"
    fill={keyBackground}
    {cursor}
    on:mouseenter={() => (mouseOverKey = true)}
    on:mouseleave={() => (mouseOverKey = false)}
    on:mousedown={e => raiseClicked(e, code, "main")} />
  {#if key}
    <text
      x="12"
      y={70 + heightOffset}
      font-size="36"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={e => raiseClicked(e, code, "main")} >
      {key}
    </text>
  {/if}
  {#if keyword}
    <text
      x="88"
      y={92 + heightOffset}
      font-size="22"
      text-anchor="end"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={e => raiseClicked(e, code, "main")} >
      {keyword}
    </text>
  {/if}
  {#if symbol}
    <text
      x="64"
      y={(topNum ? 90 : 64) + heightOffset}
      font-size={topNum ? 24 : 28}
      text-anchor="middle"
      fill={symbolFillColor}
      stroke={symbolStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverSymbol = true)}
      on:mouseleave={() => (mouseOverSymbol = false)}
      on:mousedown={e => raiseClicked(e, code, "symbol")} >
      {symbol}
    </text>
  {/if}
  {#if symbolWord}
    <text
      x="92"
      y={58 + heightOffset}
      font-size="18"
      text-anchor="end"
      fill={symbolFillColor}
      stroke={symbolStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverSymbol = true)}
      on:mouseleave={() => (mouseOverSymbol = false)}
      on:mousedown={e => raiseClicked(e, code, "symbol")}>
      {symbolWord}
    </text>
  {/if}
  {#if above}
    <text
      x="0"
      y={20 + heightOffset}
      font-size="20"
      text-anchor="start"
      fill={aboveFillColor}
      stroke={aboveStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverAbove = true)}
      on:mouseleave={() => (mouseOverAbove = false)}
      on:mousedown={e => raiseClicked(e, code, topNum ? "topNum" : "above")}>
      {above}
    </text>
  {/if}
  {#if below}
    <text
      x="0"
      y={124 + heightOffset}
      font-size="20"
      text-anchor="start"
      fill={belowFillColor}
      stroke={belowStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverBelow = true)}
      on:mouseleave={() => (mouseOverBelow = false)}
      on:mousedown={e => raiseClicked(e, code, "below")}>
      {below}
    </text>
  {/if}
  {#if center}
    <text
      x={(xwidth || 100) / 2}
      y={(top ? 86 : 74) + heightOffset}
      font-size="28"
      text-anchor="middle"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={e => raiseClicked(e, code, "main")}>
      {center}
    </text>
  {/if}
  {#if top}
    <text
      x={(xwidth || 100) / 2}
      y={62 + heightOffset}
      font-size="20"
      text-anchor="middle"
      fill={useSymColor ? (mouseOverKey ? highlightKeyColor : symbolFillColor) : mainFillColor}
      stroke={useSymColor ? (mouseOverKey ? highlightKeyColor : symbolStrokeColor) : mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={e => raiseClicked(e, code, "main")}>
      {top}
    </text>
  {/if}
  {#if bottom}
    <text
      x={(xwidth || 100) / 2}
      y={84 + heightOffset}
      font-size="20"
      text-anchor="middle"
      fill={useSymColor ? (mouseOverKey ? highlightKeyColor : symbolFillColor) : mainFillColor}
      stroke={useSymColor ? (mouseOverKey ? highlightKeyColor : symbolStrokeColor) : mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={e => raiseClicked(e, code, "main")}>
      {bottom}
    </text>
  {/if}
  {#if topNum}
    <text
      x="0"
      y="18"
      font-size="20"
      text-anchor="start"
      fill={topNumFillColor}
      stroke={topNumStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverTopNum = true)}
      on:mouseleave={() => (mouseOverTopNum = false)}
      on:mousedown={e => raiseClicked(e, code, "above")}>
      {topNum}
    </text>
  {/if}
  {#if glyph}
    <rect
      x="50"
      y="62"
      width="24"
      height="24"
      stroke-width="3"
      stroke={glyphFillColor}
      fill={glyphFillColor}
      {cursor}
      on:mouseenter={() => (mouseOverGlyph = true)}
      on:mouseleave={() => (mouseOverGlyph = false)} 
      on:mousedown={e => raiseClicked(e, code, "glyph")} />
    {#if glyph & 0x01}
      <rect
        x="61"
        y="62"
        width="12"
        height="12"
        fill={keyBackground}
        {cursor}
        on:mouseenter={() => (mouseOverGlyph = true)}
        on:mouseleave={() => (mouseOverGlyph = false)} 
        on:mousedown={e => raiseClicked(e, code, "glyph")} />
    {/if}
    {#if glyph & 0x02}
      <rect
        x="50"
        y="62"
        width="12"
        height="12"
        fill={keyBackground}
        {cursor}
        on:mouseenter={() => (mouseOverGlyph = true)}
        on:mouseleave={() => (mouseOverGlyph = false)} 
        on:mousedown={e => raiseClicked(e, code, "glyph")} />
    {/if}
    {#if glyph & 0x04}
      <rect
        x="61"
        y="73"
        width="12"
        height="12"
        fill={keyBackground}
        {cursor}
        on:mouseenter={() => (mouseOverGlyph = true)}
        on:mouseleave={() => (mouseOverGlyph = false)} 
        on:mousedown={e => raiseClicked(e, code, "glyph")} />
    {/if}
  {/if}
</svg>
