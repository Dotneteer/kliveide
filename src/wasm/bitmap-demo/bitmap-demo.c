#define BITMAP_WIDTH 256
#define BITMAP_HEIGHT 192
#define BYTES_PER_PIXEL 4

static unsigned char frame_buffer[BITMAP_WIDTH * BITMAP_HEIGHT * BYTES_PER_PIXEL];

int bitmap_width(void) {
  return BITMAP_WIDTH;
}

int bitmap_height(void) {
  return BITMAP_HEIGHT;
}

unsigned char *bitmap_ptr(void) {
  return frame_buffer;
}

void render_frame(unsigned int frame_no) {
  for (int y = 0; y < BITMAP_HEIGHT; y++) {
    for (int x = 0; x < BITMAP_WIDTH; x++) {
      const int offset = (y * BITMAP_WIDTH + x) * BYTES_PER_PIXEL;
      const unsigned int checker = ((x >> 4) ^ (y >> 4) ^ (frame_no >> 4)) & 1;
      const unsigned int wave = (x + frame_no * 2) ^ (y * 3 + frame_no);

      frame_buffer[offset] = checker ? (unsigned char)(wave & 0xff) : (unsigned char)((x + frame_no) & 0xff);
      frame_buffer[offset + 1] = (unsigned char)((y * 2 + frame_no * 3) & 0xff);
      frame_buffer[offset + 2] = checker ? (unsigned char)0xf0 : (unsigned char)((x + y + frame_no) & 0xff);
      frame_buffer[offset + 3] = 0xff;
    }
  }
}
