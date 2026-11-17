import { MI_ZXNEXT } from "@common/machines/constants";
import { MEDIA_DIVMMC_SD_CARD, MEDIA_SD_CARD } from "@common/structs/project-const";

/*
 * The DivMMC's SD card moved out of the Next's media slot (`dev/plans/NEXT_SD_CARDS_PLAN.md` D-10).
 * Settings saved before the split keep one card in `MEDIA_SD_CARD`, whichever machine chose it; the
 * machine the settings were saved with says whose it is (the project author's decision, plan Q2): a
 * Next keeps it, any other machine's card moves to the DivMMC's slot.
 */

/**
 * Splits saved media: a card in the Next's slot that was saved with another machine moves to the
 * DivMMC's slot (unless that slot already has one). Returns the media unchanged when nothing moves.
 */
export function splitSavedSdCardSlots(
  media: Record<string, any> | undefined,
  savedMachineId: string | undefined
): Record<string, any> | undefined {
  const card = media?.[MEDIA_SD_CARD];
  if (!media || !card || savedMachineId === MI_ZXNEXT) return media;
  const { [MEDIA_SD_CARD]: _moved, ...rest } = media;
  return { ...rest, [MEDIA_DIVMMC_SD_CARD]: media[MEDIA_DIVMMC_SD_CARD] || card };
}
