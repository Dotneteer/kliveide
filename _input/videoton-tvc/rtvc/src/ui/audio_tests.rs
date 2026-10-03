use super::AudioSample;

#[test]
fn converts_float_samples_to_unsigned_eight_bit_pcm() {
    assert_eq!(u8::from_f32(-1.0), 0);
    assert_eq!(u8::from_f32(0.0), 128);
    assert_eq!(u8::from_f32(1.0), 255);
}
