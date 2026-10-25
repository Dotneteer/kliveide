import { NEUTRAL_LANGUAGE, type DebugLanguageSupport } from "../source/language-support";
import { BASIC_LANGUAGE } from "./basic";
import { C_LANGUAGE } from "./c";

/**
 * The source-level debugger's language plugins, by `SourceLevelDebugInfo.language`
 * (`.plans/SHARED_Z80_BACKEND_PLAN.md` §12.4). The only file that imports a plugin: the debugger's
 * core asks here, and a language without a plugin gets the neutral one.
 */
const PLUGINS: Record<string, DebugLanguageSupport> = {
  [BASIC_LANGUAGE.id]: BASIC_LANGUAGE,
  [C_LANGUAGE.id]: C_LANGUAGE
};

/** The plugin of a language, or the neutral language. */
export function debugLanguageOf(language: string | undefined): DebugLanguageSupport {
  return (language !== undefined ? PLUGINS[language] : undefined) ?? NEUTRAL_LANGUAGE;
}
