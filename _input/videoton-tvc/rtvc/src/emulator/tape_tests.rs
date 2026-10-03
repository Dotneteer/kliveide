use super::*;

fn cas_with_payload(payload_size: usize) -> Vec<u8> {
    let dfsize = 144 + payload_size;
    let blocks = dfsize / 128;
    let remainder = dfsize % 128;
    let mut data = vec![0; dfsize];
    data[0] = 0x11;
    data[2] = (blocks & 0xFF) as u8;
    data[3] = (blocks >> 8) as u8;
    data[4] = (remainder & 0xFF) as u8;
    data[5] = (remainder >> 8) as u8;
    data[0x81] = 0x01;
    for (i, byte) in data[144..].iter_mut().enumerate() {
        *byte = i as u8;
    }
    data
}

fn generator() -> TapeBitstreamGenerator {
    TapeBitstreamGenerator::new(&cas_with_payload(1), "TEST").unwrap()
}

#[test]
fn tape_position_advances_only_while_motor_is_on() {
    let mut tape = TapeInterface::new();
    tape.play(generator());

    tape.advance(100);
    assert_eq!(tape.cycles(), 100);
    assert_eq!(tape.state().0, 0);

    tape.set_motor_from_port5(0x40);
    tape.advance(123);
    assert_eq!(tape.cycles(), 223);
    assert_eq!(tape.state().0, 123);

    tape.set_motor_from_port5(0x00);
    tape.advance(50);
    assert_eq!(tape.cycles(), 273);
    assert_eq!(tape.state().0, 123);
}

#[test]
fn tape_progress_tracks_position_and_is_clamped() {
    let mut tape = TapeInterface::new();
    let generator = generator();
    let total_cycles = generator.total_cycles;
    tape.play(generator);

    assert_eq!(tape.progress_percent(), Some(0));

    tape.set_motor_from_port5(0x40);
    tape.advance(total_cycles.div_ceil(2));
    assert_eq!(tape.progress_percent(), Some(50));

    tape.advance(total_cycles);
    assert_eq!(tape.progress_percent(), Some(100));

    tape.stop();
    assert_eq!(tape.progress_percent(), None);
}
