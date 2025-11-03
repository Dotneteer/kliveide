const RASTER_CACHE_MAX_TEXTCOLS = 0x100;
const RASTER_CACHE_MAX_SPRITES = 8;

/**
 * This defines the screen cache.  It includes the sprite cache too.
 */
export class RasterCache {
  // --- Number of line shown (referred to drawable area)
  n = 0;

  // --- If nonzero, it means that the cache entry is invalid.
  is_dirty = false;

  // --- This is needed in the VIC-II for the area between the end of the left
  // --- border and the start of the graphics, when the X smooth scroll
  // --- register is > 0.
  xsmooth_color = 0;
  idle_background_color = 0;

  // --- Smooth scroll offset.
  xsmooth = 0;

  // --- Video mode.
  video_mode = 0;

  // --- Blank mode flag.
  blank = false;

  // --- Display borders.
  display_xstart = 0;
  display_xstop = 0;

  // --- Number of columns enabled on this line.
  numcols = 0;

  // --- Number of sprites on this line.
  numsprites = 0;

  // --- Bit mask for the sprites that are visible on this line.
  sprmask = 0;

  // --- Sprite cache.
  sprites: RasterSpriteCache[] = new Array(RASTER_CACHE_MAX_SPRITES);
  gfx_msk: Uint8Array;

  // --- Sprite-sprite and sprite-background collisions that were detected on
  // --- this line.
  sprite_sprite_collisions = 0;
  sprite_background_collisions = 0;

  // --- Character memory pointer
  chargen_ptr: Uint8Array;

  // --- Character row counter
  ycounter = 0;

  // --- Flags for open left/right borders.
  open_right_border = 0;
  open_left_border = 0;

  // --- Color information.
  border_color = 0;
  background_data = new Uint8Array(RASTER_CACHE_MAX_TEXTCOLS);

  // --- Bitmap representation of the graphics in foreground.
  foreground_data = new Uint8Array(RASTER_CACHE_MAX_TEXTCOLS);

  // --- The following are generic and are used differently by the video
  // --- emulators.
  color_data_1 = new Uint8Array(RASTER_CACHE_MAX_TEXTCOLS);
  color_data_2 = new Uint8Array(RASTER_CACHE_MAX_TEXTCOLS);
  color_data_3 = new Uint8Array(RASTER_CACHE_MAX_TEXTCOLS);
}

/**
 * This defines the cache for one sprite line.
 */
export class RasterSpriteCache {
  // --- Sprite colors.
  c1 = 0;
  c2 = 0;
  c3 = 0;

  // --- Data used on the current line.
  data = 0;

  // --- X expansion flag.
  x_expanded = 0;

  // --- X coordinate.  Note: this can be negative, when the sprite "wraps"
  // --- to the left!
  x = 0;

  // --- Activation flag.
  visible = false;

  // --- Priority flag.
  in_background = false;

  // --- Multicolor flag.
  multicolor = false;
}
