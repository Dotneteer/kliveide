import classnames from "classnames";
import { Icon } from "@renderer/controls/Icon";
import { useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { reportMessagingError } from "@renderer/reportError";
import { useT } from "@common/i18n/useT";
import { MC_DISK_SUPPORT, MC_TVC_HBF, MI_TIMEX } from "@common/machines/constants";
import { MEDIA_DOCK, MEDIA_MICRODRIVES, MEDIA_TAPE } from "@common/structs/project-const";
import { hasInterface1 } from "@common/machines/interface1";
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
  // --- The cards' titles are translated when described, so a language change re-renders them
  useT();
  const media = useSelector((s) => s.media);
  // --- The Videoton TVC's two drives come with its HBF card
  const diskDrives = useSelector(
    (s) => s.emulatorState?.config?.[MC_DISK_SUPPORT] ?? (s.emulatorState?.config?.[MC_TVC_HBF] === true ? 2 : 0)
  );
  // --- The Timex 2068s' DOCK
  const dock = useSelector(
    (s) => s.emulatorState?.machineId === MI_TIMEX && getTimexModel(s.emulatorState?.config).is2068
  );
  // --- The Interface 1's Microdrives, with their motors
  const interface1 = useSelector((s) =>
    hasInterface1(s.emulatorState?.machineId, s.emulatorState?.modelId, s.emulatorState?.config)
  );
  const motors = useSelector((s) => s.emulatorState?.microdriveMotors ?? 0);
  const cards = describeSpectrumMedia(media, diskDrives as number, dock, interface1 ? { motors } : undefined);
  return (
    <div className={styles.mediaTools}>
      {cards.map((card) => (
        <MediaCard key={card.mediaId} card={card} />
      ))}
    </div>
  );
};

const MediaCard = ({ card }: { card: SpectrumMediaCard }) => {
  const t = useT();
  const mainApi = useMainApi();
  const inserted = !!card.fileName;
  const microdrive = (MEDIA_MICRODRIVES as readonly string[]).includes(card.mediaId);
  const kind =
    card.mediaId === MEDIA_TAPE ? "tape" : card.mediaId === MEDIA_DOCK || microdrive ? "cartridge" : "disk";
  const iconTitle = card.motorOn ? t("emu.media.microdrive.running", { drive: card.driveLetter ?? "" }) : card.title;

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
      <span className={styles.mediaIcon} title={iconTitle} aria-label={iconTitle}>
        <Icon
          iconName={
            card.mediaId === MEDIA_TAPE
              ? "cassette-tape"
              : card.mediaId === MEDIA_DOCK
                ? "chip"
                : microdrive
                  ? "microdrive"
                  : "floppy"
          }
          width={14}
          height={14}
          fill={card.motorOn ? "--color-display-hilite" : "--color-display"}
        />
        {/* --- The drive letter (or Microdrive number), on the drive cards only */}
        {card.driveLetter && <span className={styles.driveLetter}>{card.driveLetter}</span>}
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
        <span className={styles.badge} title={t("emu.media.writeProtected")}>
          <Icon iconName="lock" width={12} height={12} fill="--color-display-hilite" />
        </span>
      )}
      {inserted && (
        <button
          type="button"
          className={styles.button}
          title={t("emu.media.eject.title", { kind })}
          aria-label={t("emu.media.eject.label", { kind, card: card.title })}
          onClick={eject}
        >
          <Icon iconName="@eject" width={14} height={14} />
        </button>
      )}
      <button
        type="button"
        className={styles.button}
        title={inserted ? t("emu.media.change.title", { kind }) : t("emu.media.insert.title", { kind })}
        aria-label={
          inserted
            ? t("emu.media.change.label", { kind, card: card.title })
            : t("emu.media.insert.label", { kind, card: card.title })
        }
        onClick={insert}
      >
        <Icon iconName={inserted ? "@replace" : "@upload"} width={14} height={14} />
      </button>
    </div>
  );
};
