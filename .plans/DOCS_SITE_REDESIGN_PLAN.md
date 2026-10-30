# Docs site redesign: B+ type and the data-sheet landing page

Goal: replace the site's generic "AI landing page" look. Reference mockup:
[`mockups/landing-redesign.html`](mockups/landing-redesign.html) — open it in a browser; it is the
spec for everything below. This plan supersedes the type and landing parts of decision D8 in
`DOCS_SITE_MODERNIZATION_PLAN.md`. The colours, the docs-page layout and the Nextra setup stay.

## Decisions

| | Decision |
|---|---|
| R1 | **Type: Overpass** for headings and text, **Overpass Mono** only for code and values (version numbers, file names). They replace Schibsted Grotesk, IBM Plex Sans and JetBrains Mono. |
| R2 | **Type rules:** headings weight 700 with no negative letter spacing; no uppercase or letter-spaced labels; labels are bold Overpass in sentence case; body text in full text colour, grey only for secondary details; links underlined, no "→". |
| R3 | *(Partly superseded by `HALLMARK_SITE_POLISH_PLAN.md`: no label above a feature heading, whose square now sits on the heading itself; the closing bar became the download section "Install Klive"; one section gap; section headings 2rem.)* **Landing layout: the data sheet** — headline and an "At a glance" table, then the carousel full width, Machines and Also-included tables, a Write/Build/Run/Debug table, then the features as two-column rows (text left, picture right, never alternating), and a closing bar. Gone: the stripe band behind the hero, the four colour blocks, the step strip, the pill strip and the centred CTA. The Spectrum colours stay as a 6px four-colour rule at the top and a small square before each feature label. |
| R4 | **The hero carousel stays** (same slides, timing and controls); square dots. *(Extended by `HALLMARK_SITE_POLISH_PLAN.md`: its first item is a reverse-debugging video, played once, then the carousel moves on.)* |
| R5 | **Every landing picture opens full size** in a viewer: an inset panel over the dimmed page, picture always fitted (no scrolling, no "actual size"), caption, n / count, arrow keys, Esc / Close / click outside. Each picture is a real link to its file, so it works without script. The carousel pauses while the viewer is open. |
| R6 | **"Under the hood"** joins the landing header navigation. |

## Steps

1. **Fonts.** Change `FAMILIES` in `scripts/build-doc-fonts.cjs` to Overpass (400–800, upright and
   italic) and Overpass Mono (400–600); run it; delete the old `docs/fonts/*` files and licences.
   `--font-display` and `--font-body` both name Overpass. Update the stacks in `docs/app/tokens.css`.
2. **Site-wide type (R2).** `docs/app/[lang]/(docs)/custom.css` and
   `docs/page-components/Shot.module.scss`: heading weight and letter spacing; labels that use mono
   for decoration move to bold Overpass. Look at a guide page, a reference page and a book page.
3. **Landing page (R3, R6).** Rewrite `docs/landing/LandingPage.tsx` and `docs/landing/landing.css`
   from the mockup. It stays a server component; the version comes from `site-info`, the Download
   button and the `SHOWN_FEATURES` / `since` rule stay. Drop `feature.*.short`, which only the colour
   blocks used.
4. **Carousel and viewer (R4, R5).** Restyle `HeroCarousel.tsx` and make each slide a link. Add
   `docs/landing/ImageViewer.tsx` (client, native `<dialog>`), used by the carousel and the feature
   pictures.
5. **Texts.** New keys in `docs/i18n/landing/en.json`, each with translator context: `nav.underTheHood`,
   the "At a glance" labels and values, "Also included" and its items, the viewer's labels
   (close, open picture, "{n} / {count}"). Remove keys that are no longer used. Other languages come
   through `npm run doc:i18n:todo` / `doc:i18n:merge`, never by hand.
6. **Records.** Mark D8's type and landing parts as superseded by this plan. Add the rules R1–R5 to
   `.ai/ui-theming-intent-and-lessons.md` (the website section). Delete the mockup once shipped.
7. **Verify.** `npm run doc:build && npm run doc:check`. Look at the landing page in light and dark,
   at desktop and phone width, and in German (the longest texts). Confirm the viewer never scrolls
   and the carousel works with the keyboard.

Changeset: the site is not the app, so this is probably `internal`; confirm with the author before
the commit.
