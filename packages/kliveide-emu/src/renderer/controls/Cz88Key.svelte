<script>
  // ==========================================================================
  // Represents a key in the ZX Spectrum 48 keyboard

  import { createEventDispatcher } from "svelte";
  import { themeStore } from "../stores/theme-store";

  // --- Current zoom factor
  export let zoom = 1.0;

  // --- Layout information
  export let layoutInfo;

  // --- Number of clickable icons
  export let iconCount;

  // --- Z88 key code
  export let code;

  // --- Main text to be put to the top of the key
  export let top;

  // --- Main text to be put to the bottom of the key
  export let bottom;

  // --- Extra width to use instead of the default
  export let xwidth;

  // --- Extra height to use instead of the default
  export let xheight;

  // --- Extra verical shift;
  export let vshift;

  // --- Extra font size for keywords
  export let fontSize;

  export let isEnter = false;

  // --- Dimensions
  const normalWidth = 100;
  let mouseOverKey = false;
  let mouseOverSymbol = false;
  let mouseOverSecondSymbol = false;

  // --- Key icons to display
  let key;
  let keyword;
  let symbol;
  let secondSymbol;

  // --- Colors
  const keyBackground = themeStore.getProperty("--key-cz88-background-color");
  const mainKeyColor = themeStore.getProperty("--key-cz88-main-color");
  const keyStrokeColor = themeStore.getProperty("--key-cz88-stroke-color");
  const symbolKeyColor = themeStore.getProperty("--key-cz88-main-color");
  const highlightKeyColor = themeStore.getProperty(
    "--key-cz88-highlight-color"
  );

  // --- Reactive expressions for layout
  $: {
    if (layoutInfo) {
      keyword = layoutInfo.keyword;
      key = layoutInfo.key;
      symbol = layoutInfo.symbol;
      secondSymbol = layoutInfo.secondSymbol;
    }
    iconCount = 0;
    if (key) iconCount++;
    if (symbol) iconCount++;
    if (secondSymbol) iconCount++;
  }

  // --- Reactive expressions for button dimensions
  $: normalHeight = 100;
  $: currentWidth = zoom * (xwidth || normalWidth);
  $: currentHeight = zoom * (xheight || normalHeight);
  $: mainFillColor = mouseOverKey ? highlightKeyColor : mainKeyColor;
  $: mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  $: symbolFillColor = mouseOverSymbol ? highlightKeyColor : symbolKeyColor;
  $: symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : "transparent";
  $: secondSymbolFillColor = mouseOverSecondSymbol
    ? highlightKeyColor
    : symbolKeyColor;
  $: secondSymbolStrokeColor = mouseOverSecondSymbol
    ? highlightKeyColor
    : "transparent";
  $: cursor = mouseOverKey | mouseOverSymbol ? "pointer" : "default";

  // --- This component raises a "clicked" event
  const dispatch = createEventDispatcher();

  // --- Notify parent about the key action
  function keyAction(e, target, isDown) {
    dispatch("do", {
      code,
      target,
      isDown,
      isLeft: e.button === 0,
      iconCount
    });
  }
</script>

<svg
  width={currentWidth}
  height={currentHeight}
  viewBox="0 0 {parseInt(xwidth || normalWidth) + 20} {parseInt(
    xheight || normalHeight
  ) + 20}"
  style="margin:0"
  preserveAspectRatio="none"
  xmlns="http://www.w3.org/2000/svg">
  <rect
    x="2"
    y="2"
    rx="12"
    ry="12"
    width={xwidth || normalWidth}
    height={xheight || normalHeight}
    fill={keyBackground}
    stroke={keyStrokeColor}
    stroke-width="4"
    {cursor}
    on:mouseenter={() => (mouseOverKey = true)}
    on:mouseleave={() => (mouseOverKey = false)}
    on:mousedown={(e) => keyAction(e, "key", true)}
    on:mouseup={(e) => keyAction(e, "key", false)}
  />
  {#if key}
    <text
      x="14"
      y="88"
      font-size="36"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}>
      {key}
    </text>
  {/if}
  {#if symbol}
    <rect
      x="48"
      y="16"
      width={54}
      height={40}
      fill="transparent"
      {cursor}
      on:mouseenter={() => (mouseOverSymbol = true)}
      on:mouseleave={() => (mouseOverSymbol = false)}
      on:mousedown={(e) => keyAction(e, "symbol", true)}
      on:mouseup={(e) => keyAction(e, "symbol", false)}>
      {symbol}
    </rect>
    <text
      x="68"
      y="36"
      font-size={32}
      text-anchor="middle"
      fill={symbolFillColor}
      stroke={symbolStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverSymbol = true)}
      on:mouseleave={() => (mouseOverSymbol = false)}
      on:mousedown={(e) => keyAction(e, "symbol", true)}
      on:mouseup={(e) => keyAction(e, "symbol", false)}>
      {symbol}
    </text>
  {/if}
  {#if secondSymbol}
    <rect
      x="48"
      y="68"
      width={54}
      height={40}
      fill="transparent"
      {cursor}
      on:mouseenter={() => (mouseOverSecondSymbol = true)}
      on:mouseleave={() => (mouseOverSecondSymbol = false)}
      on:mousedown={(e) => keyAction(e, "secondSymbol", true)}
      on:mouseup={(e) => keyAction(e, "secondSymbol", false)}>
      {symbol}
    </rect>
    <text
      x="68"
      y="88"
      font-size={32}
      text-anchor="middle"
      fill={secondSymbolFillColor}
      stroke={secondSymbolStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverSecondSymbol = true)}
      on:mouseleave={() => (mouseOverSecondSymbol = false)}
      on:mousedown={(e) => keyAction(e, "secondSymbol", true)}
      on:mouseup={(e) => keyAction(e, "secondSymbol", false)}>
      {secondSymbol}
    </text>
  {/if}
  {#if keyword}
    <text
      x={(xwidth || 100) / 2}
      y={62 + (vshift || 0)}
      font-size={fontSize ? fontSize : 28}
      text-anchor="middle"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}>
      {keyword}
    </text>
  {/if}
  {#if top}
    <text
      x={(xwidth || 100) / 2}
      y={48}
      font-size="28"
      text-anchor="middle"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}>
      {top}
    </text>
  {/if}
  {#if bottom}
    <text
      x={(xwidth || 100) / 2}
      y={76}
      font-size="28"
      text-anchor="middle"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}>
      {bottom}
    </text>
  {/if}
  {#if isEnter}
    <text
      x={(xwidth || 100) / 2 - 6}
      y={54}
      font-size="28"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}> E </text>
    <text
      x={(xwidth || 100) / 2 - 6}
      y={84}
      font-size="28"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}> N </text>
    <text
      x={(xwidth || 100) / 2 - 6}
      y={114}
      font-size="28"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}> T </text>
    <text
      x={(xwidth || 100) / 2 - 6}
      y={144}
      font-size="28"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}> E </text>
    <text
      x={(xwidth || 100) / 2 - 6}
      y={174}
      font-size="28"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => keyAction(e, "key", true)}
      on:mouseup={(e) => keyAction(e, "key", false)}> R </text>
  {/if}
</svg>
