use super::{GameEntry, framebuffer_image, normalize_game_name};
use eframe::egui::Color32;

#[test]
fn framebuffer_image_preserves_rgba_channel_order() {
    let image = framebuffer_image(&[0xFF332211, 0x80402010], [2, 1]);

    assert_eq!(
        image.pixels,
        vec![
            Color32::from_rgba_premultiplied(0x11, 0x22, 0x33, 0xFF),
            Color32::from_rgba_premultiplied(0x10, 0x20, 0x40, 0x80),
        ]
    );
}

#[test]
fn game_name_normalization_folds_case_and_hungarian_accents() {
    assert_eq!(
        normalize_game_name("ÁÉÍÓÖŐÚÜŰ áéíóöőúüű"),
        "aeiooouuu aeiooouuu"
    );
}

#[test]
fn game_filter_matches_normalized_name_only() {
    let game: GameEntry =
        serde_json::from_str(r#"{"Name":"Árvíztűrő tükörfúrógép","Genre":"Shooter"}"#).unwrap();

    assert!(game.matches(&normalize_game_name("ARVIZTURO")));
    assert!(game.matches(&normalize_game_name("tukorfurogep")));
    assert!(!game.matches(&normalize_game_name("shooter")));
}
