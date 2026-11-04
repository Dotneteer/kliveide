//! Tests for [`Vid`](super::Vid) and the Interleaved pipeline.

use super::*;

const FRAMEBUFFER_WIDTH: usize = 608;
const FRAMEBUFFER_HEIGHT: usize = 288;
const INTERLEAVED_TOP_BORDER: std::ops::RangeInclusive<usize> = 26..=30;

fn gen_address(ma: u16, raster: u8) -> u16 {
    let ma = ma & 0x0fff;
    ((raster as u16 & 3) << 6) | (ma & 0x003f) | ((ma & 0x3fc0) << 2)
}

fn port_to_rgba(value: u8) -> u32 {
    let intensity = if value & 0x40 != 0 { 0xff } else { 0x7f };
    let green = if value & 0x10 != 0 { intensity } else { 0 };
    let red = if value & 0x04 != 0 { intensity } else { 0 };
    let blue = if value & 0x01 != 0 { intensity } else { 0 };
    0xff00_0000 | (blue << 16) | (green << 8) | red
}

fn border_to_rgba(written: u8) -> u32 {
    let latched = ((written & 0xaa) >> 1) | (written & 0xaa);
    port_to_rgba(latched)
}

fn vid_with_regs(pairs: &[(u8, u8)]) -> Vid {
    let mut video = Vid::new();
    for &(register, value) in pairs {
        video.set_reg_idx(register);
        video.set_reg(value);
    }
    video
}

fn firmware_vid() -> Vid {
    let mut video = vid_with_regs(&[
        (0, 99),
        (1, 64),
        (2, 75),
        (3, 0x32),
        (4, 77),
        (5, 2),
        (6, 60),
        (7, 66),
        (8, 0),
        (9, 3),
        (10, 3),
        (11, 3),
        (12, 0),
        (13, 0),
        (14, 0x0e),
        (15, 0xff),
    ]);
    video.set_border(0x1a);
    video.set_palette(0, 0x00);
    video.set_palette(1, 0x3f);
    video.set_palette(2, 0x10);
    video.set_palette(3, 0x15);
    video.set_mode(0);
    video
}

fn interleaved_top_border_ok(count: usize) -> bool {
    INTERLEAVED_TOP_BORDER.contains(&count)
}

#[test]
fn draw_frame_does_not_panic_hd_gt_76() {
    let video = vid_with_regs(&[(0, 99), (1, 100), (4, 77), (6, 60), (9, 3)]);
    let vram = vec![0xaa; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    assert_eq!(framebuffer.len(), FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT);
    assert!(framebuffer.iter().any(|&pixel| pixel != 0));
}

#[test]
fn draw_frame_hd_gt_76_uses_programmed_row_stride() {
    let mut video = vid_with_regs(&[(0, 99), (1, 100), (4, 77), (6, 2), (9, 0)]);
    video.set_palette(0, 0x00);
    video.set_palette(1, 0x3f);
    video.set_border(0x00);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(0, 0) as usize] = 0xff;
    vram[gen_address(100, 0) as usize] = 0xff;
    vram[gen_address(76, 0) as usize] = 0x00;
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    let top = (FRAMEBUFFER_HEIGHT - 2) / 2;
    let white = port_to_rgba(0x3f);
    let black = port_to_rgba(0x00);
    let row1 = framebuffer[(top + 1) * FRAMEBUFFER_WIDTH];
    assert_eq!(
        row1, white,
        "row 1 should fetch start+R1 (100), not clipped 76"
    );
    assert_eq!(framebuffer[top * FRAMEBUFFER_WIDTH], white);
    assert_ne!(row1, black);
}

#[test]
fn draw_frame_does_not_panic_vd_overflow() {
    let video = vid_with_regs(&[(0, 99), (1, 64), (4, 77), (6, 127), (9, 31)]);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    assert_eq!(framebuffer.len(), FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT);
}

#[test]
fn draw_frame_borders_when_active_covers_all() {
    let mut video = vid_with_regs(&[(0, 10), (1, 100), (6, 100), (9, 31)]);
    video.set_border(0xaa);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0xdead_beef; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    assert!(!framebuffer.contains(&0xdead_beef));
}

#[test]
fn stream_some_does_not_panic_hsp_overflow() {
    let mut video = vid_with_regs(&[
        (0, 255),
        (1, 64),
        (2, 250),
        (3, 0x2f),
        (4, 77),
        (6, 60),
        (7, 66),
        (9, 3),
        (10, 0x20),
    ]);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    let _ = video.stream_some(&vram, 200_000);
    let _ = video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH);
    let (_, _, character, _) = video.stream_position();
    assert!(character <= 255);
}

#[test]
fn stream_some_char_x_wraps_correctly_at_ht_255() {
    let mut video = vid_with_regs(&[(0, 255), (1, 64), (6, 60), (9, 3), (10, 0x20)]);
    let vram = vec![0u8; 0x4000];
    video.stream_some(&vram, 300 * 2);
    let (_, raster, character, _) = video.stream_position();
    assert!(raster > 0 || character < 255);
}

#[test]
fn stream_data_overflow_does_not_panic() {
    let mut video = vid_with_regs(&[(0, 99), (1, 64), (4, 77), (6, 60), (9, 3), (10, 0x20)]);
    let vram = vec![0u8; 0x4000];
    for _ in 0..40 {
        video.stream_some(&vram, 62_500);
    }
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    let _ = video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH);
    video.stream_some(&vram, 62_500);
}

#[test]
fn cursor_compare_wraps_mid_row() {
    let mut video = Vid::new();
    video.set_reg_idx(12);
    video.set_reg(0x3f);
    video.set_reg_idx(13);
    video.set_reg(0xf0);
    video.set_reg_idx(1);
    video.set_reg(64);
    video.set_reg_idx(0);
    video.set_reg(99);
    video.set_reg_idx(6);
    video.set_reg(2);
    video.set_reg_idx(9);
    video.set_reg(3);
    video.set_reg_idx(14);
    video.set_reg(0x00);
    video.set_reg_idx(15);
    video.set_reg(0x05);
    video.set_reg_idx(10);
    video.set_reg(0x00);
    let vram = vec![0u8; 0x4000];
    let mut hit = false;
    let mut hit_row = None;
    for _ in 0..2000 {
        if video.stream_some(&vram, 2) {
            hit = true;
            hit_row = Some(video.stream_position().0);
            assert_eq!(hit_row, Some(0), "cursor 0x0005 should fire mid-row 0");
            break;
        }
        let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
        let _ = video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH);
    }
    assert!(hit, "cursor at 0x0005 should fire at character 21 of row 0");
    assert_eq!(hit_row, Some(0));
}

#[test]
fn r12_masked_to_14_bits_and_wrapping_no_panic() {
    let mut video = Vid::new();
    video.set_reg_idx(12);
    video.set_reg(0xff);
    video.set_reg_idx(13);
    video.set_reg(0xff);
    assert_eq!(video.display_start_address(), 0x3fff);
    assert_eq!(video.raw_reg(12), Some(0xff));
    video.set_reg_idx(0);
    video.set_reg(99);
    video.set_reg_idx(1);
    video.set_reg(64);
    video.set_reg_idx(6);
    video.set_reg(2);
    video.set_reg_idx(9);
    video.set_reg(3);
    video.set_reg_idx(10);
    video.set_reg(0x00);
    let vram = vec![0u8; 0x4000];
    for _ in 0..100 {
        let _ = video.stream_some(&vram, 2);
        let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
        let _ = video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH);
    }
    assert_eq!(video.display_start_address(), 0x3fff);
}

#[test]
fn mode0_decoder_golden() {
    let mut video = Vid::new();
    video.set_palette(0, 0x00);
    video.set_palette(1, 0x15);
    video.set_reg_idx(1);
    video.set_reg(1);
    video.set_reg_idx(0);
    video.set_reg(1);
    video.set_reg_idx(6);
    video.set_reg(1);
    video.set_reg_idx(9);
    video.set_reg(0);
    video.set_mode(0);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(video.display_start_address(), 0) as usize] = 0xa5;
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    let row_start = (FRAMEBUFFER_HEIGHT - 1) / 2 * FRAMEBUFFER_WIDTH + 37 * 8;
    let one = port_to_rgba(0x15);
    let zero = port_to_rgba(0x00);
    let bits = [1, 0, 1, 0, 0, 1, 0, 1];
    for (index, bit) in bits.iter().enumerate() {
        let expected = if *bit == 1 { one } else { zero };
        assert_eq!(
            framebuffer[row_start + index],
            expected,
            "mode0 bit {index}"
        );
    }
}

#[test]
fn mode1_decoder_golden() {
    let mut video = Vid::new();
    video.set_palette(0, 0x00);
    video.set_palette(1, 0x04);
    video.set_palette(2, 0x10);
    video.set_palette(3, 0x14);
    video.set_reg_idx(1);
    video.set_reg(1);
    video.set_reg_idx(0);
    video.set_reg(1);
    video.set_reg_idx(6);
    video.set_reg(1);
    video.set_reg_idx(9);
    video.set_reg(0);
    video.set_mode(1);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(video.display_start_address(), 0) as usize] = 0xac;
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    let row_start = (FRAMEBUFFER_HEIGHT - 1) / 2 * FRAMEBUFFER_WIDTH + 37 * 8;
    let expected = [
        port_to_rgba(0x14),
        port_to_rgba(0x14),
        port_to_rgba(0x10),
        port_to_rgba(0x10),
        port_to_rgba(0x04),
        port_to_rgba(0x04),
        port_to_rgba(0x00),
        port_to_rgba(0x00),
    ];
    for (index, color) in expected.iter().enumerate() {
        assert_eq!(
            framebuffer[row_start + index],
            *color,
            "mode1 pixel {index}"
        );
    }
}

#[test]
fn mode2_decoder_golden() {
    let mut video = Vid::new();
    video.set_reg_idx(1);
    video.set_reg(1);
    video.set_reg_idx(0);
    video.set_reg(1);
    video.set_reg_idx(6);
    video.set_reg(1);
    video.set_reg_idx(9);
    video.set_reg(0);
    video.set_mode(2);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(video.display_start_address(), 0) as usize] = 0xd2;
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    let row_start = (FRAMEBUFFER_HEIGHT - 1) / 2 * FRAMEBUFFER_WIDTH + 37 * 8;
    let left = port_to_rgba(0xd2 >> 1);
    let right = port_to_rgba(0xd2);
    for pixel in 0..4 {
        assert_eq!(framebuffer[row_start + pixel], left);
    }
    for pixel in 4..8 {
        assert_eq!(framebuffer[row_start + pixel], right);
    }
}

#[test]
fn border_uses_the_odd_port_bits() {
    let mut video = Vid::new();
    video.set_border(0xaa);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    assert_eq!(framebuffer[0], border_to_rgba(0xaa));
    video.set_border(0x55);
    video.draw_frame(&vram, &mut framebuffer);
    assert_eq!(framebuffer[0], border_to_rgba(0x55));
}

#[test]
fn default_tvc_generates_good_frame() {
    let video = firmware_vid();
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(0, 0) as usize] = 0xff;
    vram[gen_address((60 * 64 - 1) as u16, 3) as usize] = 0xff;
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    let left_border = (76 - 64) / 2;
    let top_border = (FRAMEBUFFER_HEIGHT - 240) / 2;
    let border = border_to_rgba(0x1a);
    let active = port_to_rgba(0x3f);
    assert_eq!(framebuffer[0], border);
    assert_eq!(framebuffer[FRAMEBUFFER_WIDTH * 24 - 1], border);
    let first_active = top_border * FRAMEBUFFER_WIDTH + left_border * 8;
    assert_eq!(framebuffer[first_active], active);
    assert_eq!(framebuffer[first_active - 1], border);
    assert_eq!(framebuffer[FRAMEBUFFER_WIDTH * 287 + 300], border);
    assert!(framebuffer.contains(&border));
    assert!(framebuffer.contains(&active));

    let mut streaming = firmware_vid();
    let streamed = streaming.rendered_frame_for_test(&vram);
    assert_eq!(streamed[0], border, "stream top border lost for default");
    let mid_x = 304;
    let stream_top = (0..30)
        .filter(|&y| streamed[y * FRAMEBUFFER_WIDTH + mid_x] == border)
        .count();
    assert!(
        interleaved_top_border_ok(stream_top),
        "interleaved upper border for default should be {:?}, got {stream_top}",
        INTERLEAVED_TOP_BORDER
    );
}

#[test]
fn laser_squad_r6_48_generates_good_frame() {
    let mut video = firmware_vid();
    video.set_reg_idx(6);
    video.set_reg(48);
    assert_eq!(video.raw_reg(6), Some(48));
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(0, 0) as usize] = 0xff;
    vram[gen_address((48 * 64 - 1) as u16, 3) as usize] = 0xaa;
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    video.draw_frame(&vram, &mut framebuffer);
    let border = border_to_rgba(0x1a);
    let top_border = (FRAMEBUFFER_HEIGHT - 192) / 2;
    let left_border = (76 - 64) / 2;
    assert_eq!(framebuffer[0], border);
    assert_eq!(framebuffer[FRAMEBUFFER_WIDTH * top_border - 1], border);
    assert_eq!(
        framebuffer[top_border * FRAMEBUFFER_WIDTH + left_border * 8],
        port_to_rgba(0x3f)
    );
    let bottom_border_start = top_border + 192;
    assert_eq!(framebuffer[bottom_border_start * FRAMEBUFFER_WIDTH], border);
    let mid_x = 304;
    let border_top_count = (0..top_border)
        .filter(|&y| framebuffer[y * FRAMEBUFFER_WIDTH + mid_x] == border)
        .count();
    assert_eq!(border_top_count, top_border);
    let border_bottom_count = (bottom_border_start..FRAMEBUFFER_HEIGHT)
        .filter(|&y| framebuffer[y * FRAMEBUFFER_WIDTH + mid_x] == border)
        .count();
    assert_eq!(border_bottom_count, 48);

    let mut streaming = firmware_vid();
    streaming.set_reg_idx(6);
    streaming.set_reg(48);
    let streamed = streaming.rendered_frame_for_test(&vram);
    assert_eq!(streamed[0], border, "stream top border lost for R6=48");
    assert!(streamed.contains(&port_to_rgba(0x3f)));
    let stream_top = (0..30)
        .filter(|&y| streamed[y * FRAMEBUFFER_WIDTH + mid_x] == border)
        .count();
    assert!(
        interleaved_top_border_ok(stream_top),
        "interleaved upper border for R6=48 should be {:?}, got {stream_top}",
        INTERLEAVED_TOP_BORDER
    );
    assert!(
        streamed[200 * FRAMEBUFFER_WIDTH + mid_x] != border
            || streamed[250 * FRAMEBUFFER_WIDTH + mid_x] == border
    );
}

#[test]
fn interleaved_acquires_sync_and_completes_frame() {
    let mut video = firmware_vid();
    video.set_reg_idx(10);
    video.set_reg(0x20);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    let mut complete = false;
    for _ in 0..4 {
        video.stream_some(&vram, 62_800);
        complete |= video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH);
        if complete {
            break;
        }
    }
    assert!(complete);
}

fn first_pixel(framebuffer: &[u32], color: u32) -> Option<(usize, usize)> {
    framebuffer
        .iter()
        .position(|&pixel| pixel == color)
        .map(|index| (index % FRAMEBUFFER_WIDTH, index / FRAMEBUFFER_WIDTH))
}

fn no_cursor(video: &mut Vid) {
    video.set_reg_idx(10);
    video.set_reg(0x20);
}

#[test]
fn interleaved_paper_origin_matches_vram() {
    let mut video = firmware_vid();
    no_cursor(&mut video);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(0, 0) as usize] = 0xff;
    let streamed = video.rendered_frame_for_test(&vram);
    let paper = port_to_rgba(0x3f);
    let border = border_to_rgba(0x1a);
    let (x, y) =
        first_pixel(&streamed, paper).expect("interleaved frame should show the VRAM paper byte");
    assert!(x > 0, "paper should sit to the right of a left border");
    assert_eq!(streamed[y * FRAMEBUFFER_WIDTH + x - 1], border);
    for pixel in 0..8 {
        assert_eq!(
            streamed[y * FRAMEBUFFER_WIDTH + x + pixel],
            paper,
            "mode-0 0xFF should be eight paper pixels at ({x}, {y})"
        );
    }
}

#[test]
fn interleaved_laser_squad_extra_area_is_border() {
    let mut video = firmware_vid();
    no_cursor(&mut video);
    video.set_reg_idx(6);
    video.set_reg(48);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(0, 0) as usize] = 0xff;
    let streamed = video.rendered_frame_for_test(&vram);
    let paper = port_to_rgba(0x3f);
    let border = border_to_rgba(0x1a);
    let black = 0xff00_0000;
    let (x, y) = first_pixel(&streamed, paper).expect("R6=48 paper should be visible");
    let below = y + 192;
    assert!(
        below < FRAMEBUFFER_HEIGHT,
        "192 paper lines starting at {y} should leave a lower region in the 288-line surface"
    );
    let extra = streamed[below * FRAMEBUFFER_WIDTH + x];
    assert_eq!(
        extra, border,
        "area below 192 paper lines should be border, not paper"
    );
    assert_ne!(extra, paper);
    assert_ne!(
        extra, black,
        "extra Laser Squad area should be border, not NVRCL black"
    );
}

#[test]
fn queued_paper_uses_palette_from_emit_time() {
    let mut video = firmware_vid();
    no_cursor(&mut video);
    let mut vram = vec![0u8; 0x4000];
    vram[gen_address(0, 0) as usize] = 0xff;
    for _ in 0..3 {
        video.stream_some(&vram, 62_800);
    }
    video.set_palette(1, 0x00);
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    let mut complete = false;
    for _ in 0..4 {
        complete |= video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH);
        if complete {
            break;
        }
    }
    assert!(complete);
    let paper = port_to_rgba(0x3f);
    assert!(
        framebuffer.contains(&paper),
        "queued samples must keep the palette that was current when they were emitted"
    );
}

#[test]
fn missing_hsync_does_not_complete_a_frame() {
    let mut video = firmware_vid();
    no_cursor(&mut video);
    video.set_reg_idx(1);
    video.set_reg(40);
    video.set_reg_idx(0);
    video.set_reg(49);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    for _ in 0..8 {
        video.stream_some(&vram, 62_800);
        assert!(
            !video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH),
            "VS without reachable HS must not fabricate a frame"
        );
    }
}

#[test]
fn line_period_outside_pal_tolerance_does_not_complete_a_frame() {
    let mut video = firmware_vid();
    no_cursor(&mut video);
    video.set_reg_idx(2);
    video.set_reg(60);
    video.set_reg_idx(0);
    video.set_reg(79);
    let vram = vec![0u8; 0x4000];
    let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
    for _ in 0..8 {
        video.stream_some(&vram, 62_800);
        assert!(
            !video.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH),
            "80-clock lines are outside the 90-110 PAL lock window"
        );
    }
}
