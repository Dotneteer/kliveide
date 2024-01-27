/**
 * Hardware card (types), manufactured for the Cambridge Z88
 */
export enum CardType {
  None = 0x00,
  Rom = 0x01, // were used occasionally as 128K size for slot 0 in V2.2 and V3.0 "OZ" releases (1987-1988)
  Ram = 0x02, // exists as 32K, 128K, 512K and 1Mb cards, available for slot 0 as 128K and 512K SRAM chips

  // Define 32K UV Eprom Card the Blink and slot 3 hardware is capable of writing to
  EpromVpp32KB = 0x007e,
  // Define 128K and 256K UV Eprom Card (sizes) the Blink and slot 3 hardware is capable of writing to
  // (motherboards have been seen with NEC 128K Uv Eproms fitted in slot 0 for "OZ" ROM V2.2 release)
  EpromVpp128KB = 0x007c,

  // Manufacturer+Device Code for Intel Flash 512Kb memory, 8 x 64K erasable sectors, 32 x 16K banks
  FlashIntel28F004S5 = 0x89a7,
  // Manufacturer+Device Code for Intel Flash 1Mb memory, 16 x 64K erasable sectors, 64 x 16K banks
  FlashIntel28F008S5 = 0x89a6,

  // Manufacturer+Device code for AMD Flash 512Kb memory, 8 x 64K erasable sectors, 32 x 16K banks
  FlashAmd29F040B = 0x01a4,
  // Device code for AMD Flash 1Mb memory, 16 x 64K erasable sectors, 64 x 16K banks
  FlashAmd29F080B = 0x01d5,
  // Device code for AMIC Flash 512Kb memory (100% compatible with AMD 29F040B), 8 x 64K erasable sectors, 32 x 16K banks
  FlashAmic29F040B = 0x3786,
  // Manufacturer+Device code for Macronix Flash 512Kb memory (100% compatible with AMD 29F040B), 8 x 64K erasable sectors, 32 x 16K banks
  FlashMacronix29F040C = 0x0c2a4,
  // Manufacturer+Device code for STM Flash 512Kb memory (100% compatible with AMD 29F040B), 8 x 64K erasable sectors, 32 x 16K banks
  FlashSTM29F040B = 0x020e2,
  // Manufacturer+Device code for STM Flash 1Mb memory (100% compatible with AMD 29F080B), 16 x 64K erasable sectors, 64 x 16K banks
  FlashSTM29F080D = 0x020f1,
  // Manufacturer+Device code for Microchip SST39FS040 Flash 512K memory, 128 x 4K erasable sectors, 32 x 16K banks
  FlashSST39FS040 = 0xbfb7
}
