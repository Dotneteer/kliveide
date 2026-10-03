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
    data[0x80] = 0x00;
    data[0x83] = 0x00;
    for (i, byte) in data[144..].iter_mut().enumerate() {
        *byte = i as u8;
    }
    data
}

#[test]
fn exact_sector_sized_payload_does_not_overrun() {
    let generator = TapeBitstreamGenerator::new(&cas_with_payload(256), "TEST");

    assert!(generator.is_ok());
}
