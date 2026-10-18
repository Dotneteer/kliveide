"use client";
import { useEffect, useState } from "react";

type Offer = { id: string; href: string; text: string; switchLabel: string; dismiss: string };

const KEY = "klive-language-suggestion";

/** Shows the offer matching the browser's languages, unless the visitor dismissed it before. */
export default function LanguageSuggestionBanner({ offers }: Readonly<{ offers: Offer[] }>) {
  const [offer, setOffer] = useState<Offer>();
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "dismissed") return;
    } catch {
      /* no storage: offer anyway */
    }
    for (const wanted of navigator.languages ?? [navigator.language]) {
      const lower = wanted.toLowerCase();
      const match =
        offers.find((o) => o.id.toLowerCase() === lower) ?? offers.find((o) => o.id.toLowerCase().split("-")[0] === lower.split("-")[0]);
      if (match) {
        setOffer(match);
        return;
      }
      // --- The visitor's first choice is already this page's language: offer nothing
      if (lower.startsWith(document.documentElement.lang.toLowerCase().split("-")[0])) return;
    }
  }, [offers]);
  if (!offer) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "dismissed");
    } catch {
      /* the banner closes for this page only */
    }
    setOffer(undefined);
  };
  return (
    <div className="lp-suggest" lang={offer.id} role="region" aria-label={offer.text}>
      <span>{offer.text}</span>
      <a className="lp-button lp-button-primary" href={offer.href} hrefLang={offer.id}>
        {offer.switchLabel}
      </a>
      <button type="button" className="lp-button" onClick={dismiss}>
        {offer.dismiss}
      </button>
    </div>
  );
}
