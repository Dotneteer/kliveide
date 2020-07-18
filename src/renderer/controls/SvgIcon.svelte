<script>
  // ==========================================================================
  // Represents an SVG icon
  import { themeStore } from "../stores/theme-store";

  // ==========================================================================
  // Component parameters
  // --- Extra class names(s)
  export let xclass = "";

  // --- Name of the icon in the registry
  export let iconName;

  // --- Viewport width
  export let width;

  // --- Viewport height
  export let height;

  // --- Fill color
  export let fill;

  // --- Rotation in degrees
  export let rotate = 0;

  // ==========================================================================
  // Component logic
  $: fillValue =
    fill === null || fill === undefined
      ? "white"
      : fill.startsWith("--")
      ? themeStore.getProperty(fill)
      : fill;
  $: styleValue =
    `width:${
      width === undefined
        ? themeStore.getProperty("--icon-default-size")
        : width
    }px;` +
    `height:${
      height === undefined
        ? themeStore.getProperty("--icon-default-size")
        : height
    }px;` +
    `fill:${fillValue};` +
    `transform:rotate(${rotate}deg)`;
  $: iconInfo = themeStore.getIcon(iconName);
</script>

<style>
  svg {
    display: flex;
  }
</style>

<svg
  class={xclass}
  xmlns="http://www.w3.org/2000/svg"
  style={styleValue}
  viewBox="0 0 {iconInfo.width}
  {iconInfo.height}">
  <path
    d={iconInfo.path}
    fill-rule={iconInfo['fill-rule']}
    clip-rule={iconInfo['clip-rule']} />
</svg>
