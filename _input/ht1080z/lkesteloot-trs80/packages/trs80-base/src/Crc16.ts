
/**
 * Performs CRC-16 operations treating bits as big-endian.
 *
 * https://en.wikipedia.org/wiki/Cyclic_redundancy_check
 * https://en.wikipedia.org/wiki/Computation_of_cyclic_redundancy_checks
 * https://en.wikipedia.org/wiki/Mathematics_of_cyclic_redundancy_checks
 */
export class Crc16 {
    private readonly generator: number;

    /**
     * Specifies the generator, which must be a 16-bit value.
     */
    constructor(generator: number) {
        this.generator = generator;
    }

    /**
     * Update the CRC with the new data, which must be a byte.
     *
     * @return the new CRC.
     */
    public update(crc: number, data: number): number {
        for (let shift = 8; shift < 16; shift++) {
            const isOne = ((crc ^ (data << shift)) & 0x8000) !== 0;
            crc <<= 1;
            if (isOne) {
                crc ^= this.generator;
            }
        }

        return crc & 0xFFFF;
    }
}

/**
 * The CRC-16-CCITT polynomial, used for floppy disks. The polynomial is
 * x^16 + x^12 + x^5 + 1, which maps to 0x11021, but the leading 1 is
 * removed because it doesn't affect the outcome.
 */
export const CRC_16_CCITT = new Crc16(0x1021);
