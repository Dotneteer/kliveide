/**
 * Special bytes in a floppy's raw track data. The address marks and sync bytes are written
 * with some clock bits missing, which is how the controller tells them apart from data.
 */

/**
 * Starts a sector's ID field: this mark, then cylinder, side, sector, size code, and CRC.
 */
export const ID_ADDRESS_MARK = 0xFE;

/**
 * Marks the start of a track, after the first gap. Optional, and the controller ignores it.
 */
export const INDEX_ADDRESS_MARK = 0xFC;

/**
 * Data address mark of a normal sector.
 */
export const DATA_ADDRESS_MARK = 0xFB;

/**
 * Data address mark of a deleted sector. TRSDOS uses it to mark the directory.
 */
export const DELETED_DATA_ADDRESS_MARK = 0xF8;

/**
 * The other two data address marks, which only single density has. The WD1771 data sheet
 * calls them user-defined. Model I TRSDOS marks its directory with 0xFA, which the Model III's
 * WD1793 can't tell from 0xFB.
 */
export const USER_DATA_ADDRESS_MARK_FA = 0xFA;
export const USER_DATA_ADDRESS_MARK_F9 = 0xF9;

/**
 * In double density, three of these precede every address mark. The CRC includes them.
 */
export const MFM_SYNC = 0xA1;

/**
 * Number of MFM_SYNC bytes before each double-density address mark.
 */
export const MFM_SYNC_COUNT = 3;

/**
 * In double density, the sync byte that precedes the index address mark.
 */
export const MFM_INDEX_SYNC = 0xC2;

/**
 * Bytes that fill the gaps between fields in double and single density.
 */
export const MFM_GAP = 0x4E;
export const FM_GAP = 0xFF;

/**
 * Value that the CRC starts at: the controller presets it at the first sync byte (double
 * density) or address mark (single density).
 */
export const CRC_PRESET = 0xFFFF;

/**
 * Whether the byte is a data address mark: 0xF8 to 0xFB. Single density has two more
 * besides normal and deleted, 0xF9 and 0xFA, which the WD1771 reports in its status.
 */
export function isDataAddressMark(value: number): boolean {
    return value >= DELETED_DATA_ADDRESS_MARK && value <= DATA_ADDRESS_MARK;
}

/**
 * Whether the data address mark means the data is deleted: 0xF8, and also 0xFA, which
 * the Model I's single-density DOSes write on the directory. That's what the WD1771's
 * deleted status bit reports.
 */
export function isDeletedDataAddressMark(value: number): boolean {
    return (value & 0x01) === 0;
}
