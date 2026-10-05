import classnames from "classnames";
import { Icon } from "@renderer/controls/Icon";
import { useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { reportMessagingError } from "@renderer/reportError";
import { MC_DISK_SUPPORT, MI_TIMEX } from "@common/machines/constants";
import { MEDIA_DOCK, MEDIA_TAPE } from "@common/structs/project-const";
import { getTimexModel } from "@emu/machines/timex/timexModels";
import styles from "./SpectrumMediaToolArea.module.scss";
import { describeSpectrumMedia, SpectrumMediaCard } from "./spectrumMedia";

/**
 * The ZX Spectrum 48K/128K/+2E/+3E media strip under the emulator screen: which tape file and,
 * on models with floppy drives, which disk files are in use.
 *
 * It is the Spectrum counterpart of the Z88's slot strip (`Z88ToolArea`) and is shown only while
 * the View menu's "Show Media Information" setting is on (`EmulatorPanel` gates it). Its insert and
 * eject buttons run the Machine menu's own commands in the main process (`selectMediaFile`,
 * `ejectMediaFile`), so the dialogs, confirmations, menus and project all behave the same.
 */
export const SpectrumMediaToolArea = () => {
  const media = useSelector((s) => s.media);
  const diskDrives = useSelector((s) => s.emulatorState?.config?.[MC_DISK_SUPPORT] ?? 0);
  // --- The Timex 2068s' DOCK
  const dock = useSelector(
    (s) => s.emulatorState?.machineId === MI_TIMEX && getTimexModel(s.emulatorState?.config).is2068
  );
  const cards = describeSpectrumMedia(media, diskDrives as number, dock);
  return (
    <div className={styles.mediaTools}>
      {cards.map((card) => (
        <MediaCard key={card.mediaId} card={card} />
      ))}
    </div>
  );
};

const MediaCard = ({ card }: { card: SpectrumMediaCard }) => {
  const mainApi = useMainApi();
  const inserted = !!card.fileName;
  const kind = card.mediaId === MEDIA_TAPE ? "tape" : card.mediaId === MEDIA_DOCK ? "cartridge" : "disk";

  const insert = async () => {
    try {
      await mainApi.selectMediaFile(card.mediaId);
    } catch (err) {
      reportMessagingError(`Inserting a ${kind} failed: ${err}`);
    }
  };
  const eject = async () => {
    try {
      await mainApi.ejectMediaFile(card.mediaId);
    } catch (err) {
      reportMessagingError(`Ejecting the ${kind} failed: ${err}`);
    }
  };

  return (
    <div className={styles.mediaCard}>
      <span className={styles.mediaIcon} title={card.title} aria-label={card.title}>
        <Icon
          iconName={card.mediaId === MEDIA_TAPE ? "cassette-tape" : card.mediaId === MEDIA_DOCK ? "chip" : "floppy"}
          width={14}
          height={14}
          fill="--color-display"
        />
        {/* --- The drive letter, on the disk cards only */}
        {card.mediaId !== MEDIA_TAPE && card.mediaId !== MEDIA_DOCK && (
          <span className={styles.driveLetter}>{card.title.slice(-1)}</span>
        )}
      </span>
      {/*
       * Truncated at the *start*: the end of a name (and its extension) is the part that tells
       * files apart. `direction: rtl` puts the ellipsis on the left; the inner `<bdi>` keeps the
       * name itself laid out left to right, so its dots and brackets stay where they belong.
       */}
      <span
        className={classnames(styles.fileName, { [styles.empty]: !inserted })}
        title={card.fullPath ?? card.emptyText}
      >
        <bdi>{card.fileName ?? card.emptyText}</bdi>
      </span>
      {card.writeProtected && (
        <span className={styles.badge} title="Write-protected">
          <Icon iconName="lock" width={12} height={12} fill="--color-display-hilite" />
        </span>
      )}
      {inserted && (
        <button
          type="button"
          className={styles.button}
          title={`Eject ${kind}`}
          aria-label={`Eject ${kind} (${card.title})`}
          onClick={eject}
        >
          <Icon iconName="@eject" width={14} height={14} />
        </button>
      )}
      <button
        type="button"
        className={styles.button}
        title={inserted ? `Change ${kind}...` : `Insert ${kind}...`}
        aria-label={`${inserted ? "Change" : "Insert"} ${kind} (${card.title})`}
        onClick={insert}
      >
        <Icon iconName={inserted ? "@replace" : "@upload"} width={14} height={14} />
      </button>
    </div>
  );
};
