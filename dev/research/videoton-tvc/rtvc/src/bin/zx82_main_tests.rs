use super::*;

#[test]
fn maps_letters_to_the_spectrum_matrix() {
    assert_eq!(
        host_binding(egui::Key::P, egui::Modifiers::NONE),
        Some(vec![matrix_key(5, 0)])
    );
    assert_eq!(
        host_binding(egui::Key::Z, egui::Modifiers::NONE),
        Some(vec![matrix_key(0, 1)])
    );
}

#[test]
fn maps_modern_editing_keys_to_spectrum_chords() {
    assert_eq!(
        host_binding(egui::Key::Backspace, egui::Modifiers::NONE),
        Some(vec![CAPS_SHIFT, matrix_key(4, 0)])
    );
    assert_eq!(
        host_binding(egui::Key::Quote, egui::Modifiers::NONE),
        Some(vec![SYMBOL_SHIFT, matrix_key(5, 0)])
    );
}
