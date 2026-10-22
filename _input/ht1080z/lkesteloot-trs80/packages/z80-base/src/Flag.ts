/**
 * The flag bits in the F register.
 */
export enum Flag {
    /**
     * Carry and borrow. Indicates that the addition or subtraction did not
     * fit in the register.
     */
    C = 0x01,
    /**
     * Set if the last operation was a subtraction.
     */
    N = 0x02,
    /**
     * Parity: Indicates that the result has an even number of bits set.
     */
    P = 0x04,
    /**
     * Overflow: Indicates that two's complement does not fit in register.
     */
    V = P,
    /**
     * Undocumented bit, but internal state can leak into it.
     */
    X3 = 0x08,
    /**
     * Half carry: Carry from bit 3 to bit 4 during BCD operations.
     */
    H = 0x10,
    /**
     * Undocumented bit, but internal state can leak into it.
     */
    X5 = 0x20,
    /**
     * Set if value is zero.
     */
    Z = 0x40,
    /**
     * Set if value is negative.
     */
    S = 0x80,
}
