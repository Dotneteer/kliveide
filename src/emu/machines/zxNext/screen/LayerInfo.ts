/**
 * Layer configuration identifier for matrix selection for all the 11 layers.
 */
export const enum LayerConfig {
  ULA_Standard = 0,   // 256×192
  ULA_HiRes = 1,      // 512×192
  ULA_HiColor = 2,    // 256×192
  Layer2_256x192 = 3, // 256×192
  Layer2_320x256 = 4, // 320×256 (including the border)
  Layer2_640x256 = 5, // 640×256 (including the border)
  Sprites = 6,        // 320×256 (including the border)
  Tilemap_40x32 = 7,  // 320×256 (including the border)
  Tilemap_80x32 = 8,  // 640×256 (including the border)
  LoRes_128x96 = 9,   // 128×96
  LoRes_128x48 = 10   // 128×48  
}
