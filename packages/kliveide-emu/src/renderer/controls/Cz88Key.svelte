<script>
  // ==========================================================================
  // Represents a key in the ZX Spectrum 48 keyboard

  import { createEventDispatcher } from "svelte";
  import { themeStore } from "../stores/theme-store";

  // --- Current zoom factor
  export let zoom = 1.0;

  // --- Z88 key code
  export let code;

  // --- Key to display
  export let key;

  // --- Keyword to display
  export let keyword;

  // --- Symbol to display
  export let symbol;

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

  // --- Colors
  const keyBackground = themeStore.getProperty("--key-cz88-background-color");
  const mainKeyColor = themeStore.getProperty("--key-cz88-main-color");
  const keyStrokeColor = themeStore.getProperty("--key-cz88-stroke-color");
  const symbolKeyColor = themeStore.getProperty("--key-cz88-main-color");
  const highlightKeyColor = themeStore.getProperty(
    "--key-cz88-highlight-color"
  );

  // --- Reactive expressions for button dimensions
  $: normalHeight = 100;
  $: currentWidth = zoom * (xwidth || normalWidth);
  $: currentHeight = zoom * (xheight || normalHeight);
  $: mainFillColor = mouseOverKey ? highlightKeyColor : mainKeyColor;
  $: mainStrokeColor = mouseOverKey ? highlightKeyColor : "transparent";
  $: symbolFillColor = mouseOverSymbol ? highlightKeyColor : symbolKeyColor;
  $: symbolStrokeColor = mouseOverSymbol ? highlightKeyColor : "transparent";
  $: cursor = mouseOverKey | mouseOverSymbol ? "pointer" : "default";

  // --- Thic component raises a "clicked" event
  const dispatch = createEventDispatcher();

  function raiseClicked(e, code, keyCategory) {
    dispatch("clicked", {
      code,
      keyCategory,
      altKey: e.altKey,
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
    });
  }
</script>

<svg
  width={currentWidth}
  height={currentHeight}
  viewBox="0 0 {parseInt(xwidth || normalWidth) + 20} {parseInt(xheight || normalHeight) + 20}"
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
    on:mousedown={(e) => raiseClicked(e, code, 'main')} />
  {#if key}
    <text
      x="14"
      y="74"
      font-size="36"
      text-anchor="left"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
      {key}
    </text>
  {/if}
  {#if symbol}
    <rect
      x="48"
      y="24"
      width={54}
      height={40}
      fill="transparent"
      {cursor}
      on:mouseenter={() => (mouseOverSymbol = true)}
      on:mouseleave={() => (mouseOverSymbol = false)}
      on:mousedown={(e) => raiseClicked(e, code, 'symbol')}>
      {symbol}
    </rect>
  {/if}
  {#if symbol}
    <text
      x="68"
      y="44"
      font-size={32}
      text-anchor="middle"
      fill={symbolFillColor}
      stroke={symbolStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverSymbol = true)}
      on:mouseleave={() => (mouseOverSymbol = false)}
      on:mousedown={(e) => raiseClicked(e, code, 'symbol')}>
      {symbol}
    </text>
  {/if}
  {#if keyword}
    <text
      x={(xwidth || 100) / 2}
      y={62+(vshift || 0)}
      font-size={fontSize ? fontSize : 28}
      text-anchor="middle"
      fill={mainFillColor}
      stroke={mainStrokeColor}
      {cursor}
      on:mouseenter={() => (mouseOverKey = true)}
      on:mouseleave={() => (mouseOverKey = false)}
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
      E
    </text>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
      N
    </text>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
      T
    </text>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
      E
    </text>
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
      on:mousedown={(e) => raiseClicked(e, code, 'main')}>
      R
    </text>
  {/if}
</svg>
