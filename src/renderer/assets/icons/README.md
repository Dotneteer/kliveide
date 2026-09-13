# Drop-in SVG icons

Every `.svg` file in this folder becomes an icon ID. **The file name is the ID.**

```
sun.svg   ->  <Icon iconName="sun" />
```

No registration step, no code to edit. The files are inlined at build time, so
adding one needs nothing beyond dropping it here.

## Rules

- **File name = icon ID.** `chevron-down.svg` registers `chevron-down`. Use
  letters, digits, `.`, `_` and `-`, starting with a letter or digit. A name
  starting with `@` is rejected, because `Icon` already uses `@name` to reach
  the base64 image stock in `image-defs.ts`.
- **Flat folder only.** The loader globs `*.svg`, not subdirectories. One
  folder, one file per ID, so two files can never claim the same name.
- **These icons override the stock ones.** A file named `rocket.svg` wins over
  the `rocket` entry in `icon-defs.ts`. In a dev build the console lists every
  name that shadows a stock icon.
- **Restart or reload to pick up a new file.** `electron-vite dev` invalidates
  the glob when a file is added or removed; refresh the window if the new icon
  does not appear.

## Writing an icon that themes correctly

`Icon` passes the requested colour to the rendered `<svg>` as the CSS `color`
property. Anything painted with `currentColor` therefore follows the theme and
the `fill` prop:

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="4"/>
</svg>
```

That is exactly what [Lucide](https://lucide.dev) icons already look like, so
they can be saved here verbatim.

A **concrete** colour on the root (`fill="#f5f543"`) is kept as the icon's
default colour, and the `fill` prop still overrides it. Colours on inner
elements are always kept as authored, which is how you build a multi-colour
icon that ignores the theme.

## Composing an icon from two glyphs

`debug.svg` is worth reading before you build another composite: it is the
`play.svg` triangle at its original size plus the bug pictogram from the old
stock `debug` icon.

Two things make it work:

- **A mask knockout instead of an overlap.** A full-size triangle and a bug big
  enough to read at 20px cannot both fit in 24x24 without touching, so the
  triangle is drawn through a `<mask>` that punches out the bug's own
  silhouette, stroked to dilate it by one user unit. Using the silhouette rather
  than a circle keeps the gap even around the antennae. A knockout that paints
  the background colour instead would only work on one background - the mask
  works on any.
- **One shared transform for a family.** `play`, `debug`, `debug-continue` and
  `debug-continue-with-bug` swap inside a single toolbar split button, so all
  four wrap the play path in the *identical* group
  (`translate(1.65,1.8) scale(0.85)` with `stroke-width="2.353"`). Only the
  added marks change. A test asserts this; if you retune one, retune all four.
  The 85% is not decoration - at full size the pause bar and the triangle merged
  into one blob at 20px.
- **Watch what the mask eats.** The bug's baseline sits 1.6 units *below* the
  triangle's lowest vertex rather than level with it. Pinned level, a bug this
  size grows upward into the triangle's right vertex and the mask cuts the point
  off the play glyph - the one feature that makes it read as "play". Whenever you
  enlarge a badge, re-check the base glyph at 300px, not just at toolbar size.
- **Stroke weight under a group scale.** A `transform="scale(s)"` scales the
  stroke too, so a scaled group needs `stroke-width` divided by `s` to keep the
  rendered weight at the Lucide standard of 2.

IDs are namespaced per icon (`klive-icon-debug-bug-cutout`), so a mask, gradient
or clip path defined in one icon can never collide with another's.

## What gets stripped

The loader keeps only drawing elements (`path`, `circle`, `ellipse`, `line`,
`polyline`, `polygon`, `rect`, `g`, `defs`, gradients, `clipPath`, `mask`,
`use`, `title`, `desc`, `symbol`). Everything else - `script`, `style`,
`foreignObject`, `image`, `a`, animations - is dropped along with its children,
as are event-handler attributes, external `href`s, and `class` attributes.

Internal IDs are rewritten to `klive-icon-<name>-<id>` so two icons that both
define, say, `id="a"` cannot corrupt each other's gradients.

A file that cannot be parsed is skipped with a console warning; it never breaks
the renderer.

## Related code

- `src/renderer/theming/svg-icon-parser.ts` - parsing and sanitizing
- `src/renderer/theming/file-icon-defs.ts` - the glob that loads this folder
- `src/renderer/theming/icon-registry.ts` - merge and override precedence
- `src/renderer/controls/Icon.tsx` - rendering
