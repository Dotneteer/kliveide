import { useCallback, useEffect, useRef, useState } from "react";

import {
  JOYSTICK_BUTTONS,
  JOYSTICK_BUTTON_LABELS,
  JOYSTICK_SIDES,
  JOYSTICK_SIDE_LABELS,
  JOYSTICK_SOURCES,
  normalizeJoystickBindings,
  type JoystickBindings,
  type JoystickButton,
  type JoystickSide
} from "@common/settings/joystick-bindings";
import {
  assignKey,
  clearKey,
  describeKeyCode,
  machineKeysTakenBy,
  resetSide
} from "@common/settings/joystick-binding-edit";
import { SETTING_EMU_JOYSTICK_BINDINGS } from "@common/settings/setting-const";
import { useGlobalSetting } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { Modal } from "@renderer/controls/Modal";

import styles from "./JoystickBindingsDialog.module.scss";

export type JoystickBindingsDialogResult = JoystickBindings | undefined;

type Props = {
  onSave: (result: JoystickBindings) => void;
  onClose: () => void;
};

/**
 * Which host key drives each pin of the two joystick connectors.
 *
 * Plain dialog pattern, not MVC: there is no async orchestration here to isolate - the editing
 * rules are pure functions in `joystick-binding-edit.ts` and tested there, so this component is a
 * form with no decisions in it.
 *
 * The dialog edits a draft and writes it once on Save. Writing each keystroke straight to the
 * setting would re-bind the live joystick mid-capture, which is how you end up holding a pin down
 * by assigning it.
 */
export const JoystickBindingsDialog = ({ onSave, onClose }: Props) => {
  const mainApi = useMainApi();
  const stored = normalizeJoystickBindings(useGlobalSetting(SETTING_EMU_JOYSTICK_BINDINGS));
  const [draft, setDraft] = useState<JoystickBindings>(stored);

  /** The pin currently listening for a key, if any. */
  const [capturing, setCapturing] = useState<{ side: JoystickSide; button: JoystickButton }>();
  const capturingRef = useRef(capturing);
  capturingRef.current = capturing;

  /*
   * While a row is listening, every key belongs to it.
   *
   * Captured on the window with `capture: true` so it is seen before anything else - including the
   * emulator's own keyboard and joystick hooks, which would otherwise type into the machine behind
   * the dialog while someone is choosing a binding.
   */
  useEffect(() => {
    if (!capturing) return undefined;
    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const target = capturingRef.current;
      if (!target) return;
      setCapturing(undefined);
      // --- Escape backs out of the capture; it is never a sensible binding.
      if (e.code === "Escape") return;
      setDraft((current) => assignKey(current, target.side, target.button, e.code));
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturing]);

  const save = useCallback(async (): Promise<boolean> => {
    await mainApi.setGlobalSettingsValue(SETTING_EMU_JOYSTICK_BINDINGS, draft);
    onSave(draft);
    // --- False lets the modal close; see the note on `onPrimaryClicked`.
    return false;
  }, [draft, mainApi, onSave]);

  return (
    <Modal
      title="Joystick bindings"
      iconName="keyboard"
      isOpen={true}
      width={720}
      onClose={onClose}
      primaryLabel="Save"
      primaryEnabled={!capturing}
      onPrimaryClicked={save}
      /* --- While a row is listening, Escape cancels the capture rather than the dialog. */
      closeOnEscape={!capturing}
      closeOnOutsideClick={!capturing}
    >
      <div className={styles.columns}>
        {JOYSTICK_SIDES.map((side) => (
          <section key={side} className={styles.column}>
            <header className={styles.columnHeader}>
              <span className={styles.sideName}>{JOYSTICK_SIDE_LABELS[side]}</span>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setDraft((current) => resetSide(current, side))}
              >
                Reset
              </button>
            </header>

            <label className={styles.sourceRow}>
              <span className={styles.sourceLabel}>Driven by</span>
              <select
                className={styles.select}
                value={draft[side].source}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    [side]: { ...current[side], source: e.target.value as never }
                  }))
                }
              >
                {JOYSTICK_SOURCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <table className={styles.bindings}>
              <tbody>
                {JOYSTICK_BUTTONS.map((button) => {
                  const code = draft[side].keys[button];
                  const listening =
                    capturing?.side === side && capturing?.button === button;
                  const taken = code ? machineKeysTakenBy(code) : [];
                  return (
                    <tr key={button}>
                      <td className={styles.pin}>{JOYSTICK_BUTTON_LABELS[button]}</td>
                      <td>
                        <button
                          type="button"
                          className={listening ? styles.keyListening : styles.key}
                          onClick={() => setCapturing({ side, button })}
                        >
                          {listening ? "Press a key…" : describeKeyCode(code)}
                        </button>
                      </td>
                      <td className={styles.note}>
                        {/*
                          * Binding is not additive: the emulated keyboard stops seeing the key
                          * entirely. Saying which machine keys are being given up here is much
                          * kinder than letting it be discovered in a BASIC listing.
                          */}
                        {taken.length > 0 && (
                          <span title="This key will no longer reach the machine's keyboard">
                            takes {taken.join(" + ")}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.linkButton}
                          disabled={!code}
                          onClick={() => setDraft((current) => clearKey(current, side, button))}
                        >
                          Clear
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </Modal>
  );
};
