/*
 * The reverse stepping keys (`.plans/LITE_STEP_BACK_PLAN.md` Q3, T11): the forward step's key plus
 * Alt, one rule rather than a list, every one a setting. GNOME binds Alt+F5/F7/F8/F10 to window
 * actions, so on Linux the defaults use Ctrl+Alt instead.
 */

export type ReverseShortcuts = {
  stepBack: string;
  stepBackOver: string;
  stepBackOut: string;
  reverseContinue: string;
  stepForward: string;
};

export type ShortcutPlatform = "darwin" | "linux" | "win32";

/** The default keys on a platform */
export function defaultReverseShortcuts(platform: ShortcutPlatform): ReverseShortcuts {
  const alt = platform === "linux" ? "Ctrl+Alt" : "Alt";
  // --- The forward keys: Step Into is F12 on macOS (F11 is Show Desktop there), F11 elsewhere
  const into = platform === "darwin" ? "F12" : "F11";
  return {
    stepBack: `${alt}+${into}`,
    stepBackOver: `${alt}+F10`,
    stepBackOut: `${alt}+Shift+${into}`,
    reverseContinue: `${alt}+F5`,
    stepForward: `${alt}+Shift+F10`
  };
}

/** The keys from the settings (`shortcuts.stepBack`, ...), with the platform's defaults */
export function readReverseShortcuts(
  readSetting: (key: string) => string | undefined,
  platform: ShortcutPlatform
): ReverseShortcuts {
  const defaults = defaultReverseShortcuts(platform);
  return {
    stepBack: readSetting("shortcuts.stepBack") ?? defaults.stepBack,
    stepBackOver: readSetting("shortcuts.stepBackOver") ?? defaults.stepBackOver,
    stepBackOut: readSetting("shortcuts.stepBackOut") ?? defaults.stepBackOut,
    reverseContinue: readSetting("shortcuts.reverseContinue") ?? defaults.reverseContinue,
    stepForward: readSetting("shortcuts.stepForward") ?? defaults.stepForward
  };
}
