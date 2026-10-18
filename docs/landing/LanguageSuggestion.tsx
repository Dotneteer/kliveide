/**
 * The banner that offers a visitor the landing page in their own language. "/" never redirects
 * (search engines and shared links must get the page they asked for); instead, when the browser's
 * preferred language has a translation, this offers it - in that language - until dismissed.
 *
 * Server part: gathers each published language's banner text; the client part picks one.
 */
import { DEFAULT_LOCALE, LOCALE_NAMES, LOCALES } from "../i18n/locales.mjs";
import { uiTranslator } from "../i18n/ui";
import LanguageSuggestionBanner from "./LanguageSuggestionBanner";
import { landingHref } from "./i18n";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function LanguageSuggestion({ current }: Readonly<{ current: string }>) {
  const offers = LOCALES.filter((id: string) => id !== current).map((id: string) => {
    const t = uiTranslator(id);
    const name = (LOCALE_NAMES as Record<string, string>)[id] ?? id;
    return {
      id,
      href: `${basePath}${landingHref(id)}`,
      text: id === DEFAULT_LOCALE ? "" : t("suggest.text"),
      switchLabel: t("suggest.switch", { language: name }),
      dismiss: t("suggest.dismiss")
    };
  });
  return <LanguageSuggestionBanner offers={offers.filter((o) => o.text)} />;
}
