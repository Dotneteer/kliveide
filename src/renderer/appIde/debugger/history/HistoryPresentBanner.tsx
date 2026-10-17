import classnames from "classnames";

import { historyStepText } from "@common/history/historyNavigation";
import type { MessageKey } from "@common/i18n/keys.generated";
import { useT } from "@common/i18n/useT";
import { useSelector } from "@renderer/core/RendererProvider";
import styles from "./HistoryBanner.module.scss";

/*
 * The "present" band (`.plans/LITE_STEP_BACK_PLAN.md` D6): its own module, with nothing but the
 * store behind it, so every memory-reading panel can show it without pulling in the IDE services.
 */

/** What a present band talks about: each is a whole translated sentence */
const PRESENT_SUBJECTS = {
  memory: "panels.side.historyPresent.memory",
  systemVariables: "panels.side.historyPresent.systemVariables",
  nextRegisters: "panels.side.historyPresent.nextRegisters",
  watchedMemory: "panels.side.historyPresent.watchedMemory",
  memoryMapping: "panels.side.historyPresent.memoryMapping",
  ula: "panels.side.historyPresent.ula",
  listedBytes: "panels.side.historyPresent.listedBytes",
  variables: "panels.side.historyPresent.variables",
  stackMemory: "panels.side.historyPresent.stackMemory"
} as const satisfies Record<string, MessageKey>;

export type HistoryPresentSubject = keyof typeof PRESENT_SUBJECTS;

/** The English subjects older call sites pass as `what` (kept until they move to `subject`) */
const LEGACY_WHAT: Readonly<Record<string, HistoryPresentSubject>> = {
  Memory: "memory",
  "System variables": "systemVariables",
  "The Next registers": "nextRegisters",
  "Watched memory": "watchedMemory",
  "The memory mapping": "memoryMapping",
  "The ULA": "ula",
  "The listed bytes": "listedBytes",
  Variables: "variables",
  "Stack memory": "stackMemory"
};

/**
 * The band of a view that reads memory or devices: they show the present while the cursor is in
 * the past (D6). Renders nothing at the present, or when memory is historical too.
 *
 * `what`/`plural` are the pre-localization props; `subject` replaces them.
 */
export const HistoryPresentBanner = ({
  subject,
  what,
  plural: _plural
}: {
  subject?: HistoryPresentSubject;
  /** @deprecated pass `subject` */
  what?: string;
  /** @deprecated pass `subject` */
  plural?: boolean;
}) => {
  const t = useT();
  const position = useSelector((s) => s.emulatorState?.historyPosition);
  const historical = useSelector((s) => s.emulatorState?.historyMemoryIsHistorical);
  if (!position || historical) return null;
  const resolved = subject ?? (what !== undefined ? LEGACY_WHAT[what] : undefined) ?? "memory";
  return (
    <div className={classnames(styles.band, styles.present)} role="note">
      <span className={styles.warning}>{t(PRESENT_SUBJECTS[resolved], { step: historyStepText(position) })}</span>
    </div>
  );
};
