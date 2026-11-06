# Knight Lore: code-level reference

This extends [03_KNIGHT_LORE_ENGINE.md](03_KNIGHT_LORE_ENGINE.md) with routine-level detail from Jon Sole's public
[RAM disassembly](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/), read on 2026-11-06. It is in this pack's own
words. Addresses and labels are the disassembly's, and each address below links to its routine page.

**What is deliberately not here:** the instruction listings, game bytes, sprites, recordings or room dumps. Knight Lore is marked
distribution denied, and a saved copy of the listing could rebuild the game, so read those on the site. Jon Sole's project applies
the same idea and commits no game bytes. The site's [routines map](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/maps/routines.html)
lists all 622 routine entries, and its [data map](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/maps/data.html) lists
the data.

**How much was read:** the prose notes of the routines linked here, and the maps. The routine notes are the site author's reading, and they
flag some points as inferred or untraced. Instruction bodies were not checked line by line.

## Where to start reading the code

1. [`$AFBD`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/44989.html) `onscreen_loop`, the frame's start, then [`$B000`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/45056.html) `end_of_frame`.
2. [`$D59F`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54687.html) `render_dynamic_objects`, the whole redraw.
3. [`$CEBB`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52923.html) `calc_display_order_and_render`, the depth search.
4. [`$D718`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55064.html) `print_sprite`, the sprite drawer.
5. [`$CB45`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52037.html) `adj_for_out_of_bounds`, collision.
6. [`$D3C6`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54214.html) `retrieve_screen`, room building.

## Routines by subsystem

### Frame and objects

| Address | Label | Does |
|---|---|---|
| [`$AF88`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/44936.html) | `main` | Sets up and plays |
| [`$AFBA`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/44986.html) | `game_loop` | Enters a room |
| [`$AFBD`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/44989.html) | `onscreen_loop` | Walks the object table |
| [`$AFC7`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/44999.html) | `update_sprite_loop` | Saves the old rectangle, moves to the next object |
| [`$AFD5`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/45013.html) | `jump_to_upd_object` | Dispatches on type |
| [`$AFE4`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/45028.html) | `ret_from_tbl_jp` | Where handlers return: stirs the random byte, then steps on |
| [`$B000`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/45056.html) | `end_of_frame` | Redraws, then waits out the remaining time |
| [`$CE49`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52809.html) | `save_2d_info` | Keeps a copy of the picture rectangle |

### Marking and redraw

| Address | Label | Does |
|---|---|---|
| [`$C692`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/50834.html) | `set_wipe_and_draw_flags` | Marks an object for wipe and draw; nearly every moving handler ends here |
| [`$CD33`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52531.html) | `calc_2d_info` | Works out an object's screen rectangle |
| [`$CD4D`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52557.html) | `set_draw_objs_overlapped` | Forms the old and new union and flags everything it touches |
| [`$CE62`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52834.html) | `list_objects_to_draw` | Builds the draw list |
| [`$D59F`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54687.html) | `render_dynamic_objects` | Wipes, draws, copies |
| [`$D62C`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54828.html) | `wipe_rect` | Clears an area in the buffer and pushes it |
| [`$D653`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54867.html) | `draw_and_copy_rects` | Draws objects, then copies wiped areas |
| [`$D67C`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54908.html) | `blit_to_screen` | Copies a buffer rectangle to the display |
| [`$D56F`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54639.html) | `update_screen` | Copies the whole buffer, clearing it on the way |

### Depth

| Address | Label | Does |
|---|---|---|
| [`$CEBB`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52923.html) | `calc_display_order_and_render` | The search for the next object to draw |
| [`$CEDB`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52955.html) | `compare_next_obj` | Compares the candidate with the next undrawn object |
| [`$CF62`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53090.html) | `act_on_comparison` | Jumps through the 27-entry table |
| [`$CFA5`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53157.html) | `iy_goes_first` | The other object must go first |
| [`$CFCE`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53198.html) | `break_order_cycle` | Draws at once to break a cycle |
| [`$CFE1`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53217.html) | `objs_coincide` | Handles intersecting boxes, and destroys charms |
| [`$D003`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53251.html) | `render_obj` | Draws one object and starts the next pass |

### Projection and sprites

| Address | Label | Does |
|---|---|---|
| [`$D6C9`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54985.html) | `calc_pixel_XY` | The isometric projection |
| [`$C72B`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/50987.html) | `set_pixel_adj` | Sets a per-object picture offset |
| [`$D6EF`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55023.html) | `flip_sprite` | Finds a sprite and makes it face correctly |
| [`$D704`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55044.html) | `calc_pixel_XY_and_render` | Draws one object from the list |
| [`$D718`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55064.html) | `print_sprite` | The sprite drawer |
| [`$D73C`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55100.html) | `patch_sprite_rows` | Patches the row loop for this width |
| [`$D76F`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55151.html) | `sprite_aligned` | The byte-aligned unrolled run |
| [`$D7AC`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55212.html) | `sprite_row_jump` | The shifted unrolled run |
| [`$D811`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55313.html) | `calc_vidbuf_addr` | Pixel position to buffer address |
| [`$D865`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55397.html) | `vflip_sprite_data` | Turns stored data upside down |
| [`$D8A2`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55458.html) | `hflip_sprite_data` | Mirrors stored data |
| [`$D69E`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54942.html) | `build_lookup_tbls` | Builds the reverse and shift tables |

### Movement and collision

| Address | Label | Does |
|---|---|---|
| [`$C700`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/50944.html) | `dec_dZ_and_update_XYZ` | Applies gravity and moves |
| [`$C706`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/50950.html) | `add_dXYZ` | Adds the velocity |
| [`$CB45`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52037.html) | `adj_for_out_of_bounds` | Cuts a move short against the room and objects |
| [`$CA89`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51849.html) | `shorten_delta` | Shortens a move by one unit |
| [`$CB9A`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52122.html) | `adj_dX_for_obj_intersect` | Shortens X against objects; [`$CBE9`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52201.html) Y and [`$CC38`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52280.html) Z work the same way |
| [`$CC9D`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52381.html) | `do_objs_intersect_on_x` | Axis overlap test; [`$CCB2`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52402.html) Y and [`$CCC7`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52423.html) Z too |
| [`$B4FD`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/46333.html) | `do_any_objs_intersect` | Does this object overlap any other? |

### Player

| Address | Label | Does |
|---|---|---|
| [`$C82B`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51243.html) | `upd_player_bottom` | The legs' handler, which runs the player |
| [`$CDE2`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52706.html) | `upd_player_top` | The head follows the legs |
| [`$C83E`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51262.html) | `player_controls` | Reads and acts on the controls |
| [`$C9A1`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51617.html) | `move_player` | Moves the player |
| [`$C948`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51528.html) | `handle_jump` | Starts a jump |
| [`$CA70`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51824.html) | `handle_exit_screen` | Has the player walked out of the room? |
| [`$CABA`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51898.html) | `exit_screen` | Goes into the next room |
| [`$D022`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53282.html) | `check_user_input` | Reads keyboard or joysticks |

### Rooms

| Address | Label | Does |
|---|---|---|
| [`$D1E6`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53734.html) | `build_screen_objects` | Builds the player's room |
| [`$D3C6`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54214.html) | `retrieve_screen` | Turns a room record into object records |
| [`$D3CF`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54223.html) | `find_screen` | Walks the records to find a room |
| [`$D432`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54322.html) | `next_bg_obj_sprite` | Copies a background template to a record |
| [`$D46C`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54380.html) | `next_fg_obj_sprite` | Builds a record from a template and a location |
| [`$D320`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54048.html) | `adjust_plyr_xyz_for_room_size` | Puts the player in the doorway he came through |
| [`$C785`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/51077.html) | `arch_nudge_to_centre` | Nudges the player towards the middle of an arch |

### Main data tables

These are data, so they are listed on the
[data map](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/maps/data.html) rather than as routine pages.

| Address | Label | Holds |
|---|---|---|
| `$6108` | `font` | The font, directly after the object table |
| `$6248` | `room_size_tbl` | Room shapes |
| `$6251` | `location_tbl` | Room records |
| `$6BD1` | `block_type_tbl` | Foreground templates |
| `$6CE2` | `background_type_tbl` | Backgrounds |
| `$6FF2` | `special_objs_tbl` | Where charms lie |
| `$7112` | `sprite_tbl` | A sprite for each type |
| `$B096` | `upd_sprite_jmp_tbl` | A handler for each type |
| `$B332` | `freq_tbl` | Notes |
| `$C27D` | `objects_required` | The charm order |
| `$CE8B` | `objects_to_draw` | This frame's draw list |
| `$CF69` | `depth_order_tbl` | The 27-entry comparison table |
| `$D01A` | `candidate_chain` | The chain used to detect cycles |
| `$D8F3` | `screen_buffer` | The drawing buffer |
| `$F100` | `reverse_bits_tbl` | Bit reversal, built at start-up |
| `$F200` | `shift_tbls` | Shift tables, built at start-up |

## Details the overview left out

### The sprite drawer

From [`$D718`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55064.html), [`$D76F`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55151.html), [`$D7AC`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55212.html) and [`$D69E`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54942.html):

- **The stack pointer reads the sprite.** SP is pointed at the data, and each POP fetches a mask byte and an image byte together. The real SP is
  kept in a variable, and interrupts stay off, so nothing can push onto the sprite meanwhile.
- **Two unrolled loops, patched at run time.** Each is written for the widest sprite, five bytes. The drawer patches a jump offset so that a row enters
  the right distance from the end, and patches the step to the next row.
- **Pixel shifting uses tables.** For each shift of 1 to 7, one page holds every byte shifted right and the next page holds the bits falling into the next
  byte, both complemented. That is 14 pages (3.5K), plus 256 bytes for bit reversal, all built at start-up, so they cost no loading space. So Knight Lore
  places pictures at any pixel, and a shifted sprite touches one extra byte per row.
- **One table value does two jobs**: ANDed with the background to clear under the mask, then XORed and complemented to add the image.
- **The buffer is upside down** relative to the display: its first row is the screen's bottom line, matching a Y that counts up.

### Flipping in place

From [`$D865`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55397.html) and [`$D8A2`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55458.html): two bits in the sprite's header say how the stored data lies, and bits 7 and 6 of the object's `+$07` say how it should be drawn. An
object that keeps facing one way pays nothing after the first frame. Two objects sharing a sprite and facing opposite ways turn it back and forth on every
draw. This trades time for memory, and the Next's sprite hardware has mirroring built in.

### The overlap rule has limits

From [`$CD4D`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52557.html):

- Rectangles are compared in byte columns across and pixel rows up.
- Only the **moving** object's rectangle marks others. An object redrawn because of an overlap does not mark what it overlaps in turn. This is safe because only
  the wiped rectangles are copied out, as [`$D59F`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54687.html) explains.
- [`$CD33`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/52531.html): a shifted sprite is one byte wider. Also, a vanishing object uses the empty sprite, which keeps its last rectangle, so the area it covered still gets cleared.

### Vanishing

From [`$D704`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/55044.html): type 1 draws nothing and frees the record after one last wipe, so removing an object needs no special case in the renderer.

### Picture offsets

From [`$C72B`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/50987.html) and [`$D6C9`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54985.html): `+$12` and `+$13` shift a picture without moving the object, for artwork that does not sit where the object stands. Handlers such as
[`$C4E3`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/50403.html) for types 6 and 7 set them. The depth sort ignores them.

### Foreground template bits

From [`$D46C`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/54380.html): the template's last byte holds half-cell nudges in its low two bits and a height, in multiples of 4, in the rest. This lets something stand on a block or sit between
two cells.

### Pacing

From [`$B000`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/45056.html): a unit of waiting is about 33,300 T-states, just under half a 50 Hz frame. The game waits six units, less one for each object drawn and rectangle wiped. So
fewer than six changes run at one speed, and a busier room runs slower. *Inference:* the fixed floor is near 200,000 T-states, about three TV frames, so the game
runs at about 17 updates a second at best. A smooth Next version could use a fixed frame interrupt instead.

### Starting and ending

- [`$D12A`](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/asm/53546.html) `lose_life` restores the player as saved on entering the room, in a materialising type, and picks knight or werewolf from the time of day.
- A random source: there is no generator. A byte is stirred with the refresh register after each object, and the seed comes from the ROM's frame counter and time on the menu
  ([Architecture](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Architecture.html),
  [Trivia](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/reference/facts.html)).

## Game systems

Less relevant to rendering, but useful for designing a game on this kind of engine. Each is on its own page, in more detail.

### Day and night

[DayNight](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/DayNight.html):

- The sun or moon is a 32-byte record outside the object table, laid out so the same sprite printer can draw it. It moves a pixel every eighth frame, and swaps after 49 steps: 392 frames. A day
  has no fixed length in seconds, because frame length varies.
- A pending change waits until the player is neither jumping nor walking into a room. It then takes 32 frames, during which the controls do nothing.
- Werewolf types are the knight's plus 32, so changing body flips one bit and keeps frame and facing. A handler can test "which body" from a type range.
- The bouncing balls patch their own jumps to chase or flee, based on the player's body. Bubbles over the cauldron turn deadly for the werewolf.
- The 40th dawn ends the game.

### Charms

[Charms](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Charms.html):

- A 32-entry table of nine-byte records holds type, start position and room, and current position. Places are fixed, and kinds are dealt in rotation from a seed, each kind four times.
- Types 96 to 102 are the seven charms and 103 an extra life. Only objects 2 and 3 can hold charms in a room.
- **Dropping lifts the player**, by a charm's height of 12 units, so charms become steps. It is refused if there is no headroom.
- Each game asks for 14 charms, each kind twice, by rotating a fixed list that is never reset.
- Delivering a wrong charm loses it. Intersecting anything else also destroys it, which happens in the depth sort.
- The score is rooms visited plus twice the charms delivered, out of 156. The percentage needs no divide: a 16-bit fraction is added per point.

### Sound

[Sounds](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Sounds.html): one-bit beeper, timed loops, and nothing else runs while a sound plays. A tune is note bytes ended by `$FF`: the
low six bits index a note table of five octaves from G#1 to G6, and the top two bits give the length. Some effects are pitched by an object's position or height. The page has recordings.

### Known bugs

[Bugs](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/reference/bugs.html):

- The block type called moveable clears its velocity before moving, so it never moves.
- Ten lives would print as a letter, which a normal game cannot reach.
- The depth search's chain has no length check. See [02_DEPTH_SORTING.md](02_DEPTH_SORTING.md#cycles).

## What this suggests for a Next engine

*Inference:*

- **Keep:** one record format, type-driven handlers, boxes for everything, three-axis collision, templates and a cell grid for rooms, and a vanishing type.
- **Consider keeping:** walls as ordinary sorted objects. It is why Knight Lore needs no hand-made fix like the one Head over Heels uses for doors. On the Next, though, it costs
  sprites or redraws for static scenery.
- **Replace:** the upside-down buffer, shift tables, stack-pointer reads and in-place flipping, since Layer 2 or the sprite hardware makes them unnecessary. Stay wary of the type-doubles-as-frame
  trick: it is compact, but types here already run to at least 187, and a richer game will want a separate frame number.
- **Fix:** bound the candidate chain, use a real random source, and do not lose objects silently when boxes intersect.
