"use client";
/**
 * The hero's carousel: Klive in action, from the IDE to the Next tools.
 *
 * - The first slide is in the static HTML, so the page is complete before any JavaScript runs.
 *   The others load only when they are about to show (their `src` is set then), so a visitor who
 *   never looks at them downloads nothing extra.
 * - Pictures fly in and out sideways: forward, the new one comes from the right and the old one
 *   leaves to the left; backward, the other way round. With reduced motion they simply swap.
 * - It advances by itself every five seconds. Changing the picture by hand restarts the count; the
 *   pause button stops it until it is pressed again (WCAG 2.2.2: moving content can be paused).
 *   Nothing else stops it: pausing on hover or on focus made it look broken, because the pointer
 *   often rests on it and a clicked arrow keeps the focus.
 * - Buttons, dots and the arrow keys change slides; each slide has a caption, which is also the
 *   image's description for screen readers.
 */
import { useCallback, useEffect, useState } from "react";

export type Slide = { src: string; alt: string; caption: string; width: number; height: number };

type Props = Readonly<{
  slides: Slide[];
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** "Slide {n} of {count}", with the placeholders still in it */
  slideLabel: string;
  pauseLabel: string;
  playLabel: string;
}>;

const INTERVAL_MS = 5000;

type Move = { from: number; dir: "forward" | "backward" };

export default function HeroCarousel({ slides, label, previousLabel, nextLabel, slideLabel, pauseLabel, playLabel }: Props) {
  const [index, setIndex] = useState(0);
  // --- The slide that is leaving, and which way, while the fly-out runs
  const [move, setMove] = useState<Move | undefined>();
  // --- Slides whose image may load: the current one and its neighbours
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]));
  const [paused, setPaused] = useState(false);
  // --- Bumped by every change of picture, so the timer always restarts from a full interval
  const [tick, setTick] = useState(0);

  const go = useCallback(
    (target: number, dir?: Move["dir"]) => {
      const next = (target + slides.length) % slides.length;
      if (next === index) return;
      setMove({ from: index, dir: dir ?? (target > index ? "forward" : "backward") });
      setIndex(next);
      // --- The neighbours too, so the next move in either direction finds its picture loaded
      setLoaded((prev) => new Set([...prev, next, (next + 1) % slides.length, (next - 1 + slides.length) % slides.length]));
      setTick((t) => t + 1);
    },
    [slides.length, index]
  );

  useEffect(() => {
    // --- Preload the second slide once the page is idle
    const id = setTimeout(() => setLoaded((prev) => new Set([...prev, 1 % slides.length])), 1500);
    return () => clearTimeout(id);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const id = setTimeout(() => go(index + 1, "forward"), INTERVAL_MS);
    return () => clearTimeout(id);
  }, [index, tick, paused, go, slides.length]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1, "forward");
    else if (e.key === "ArrowLeft") go(index - 1, "backward");
  };

  return (
    <div className="lp-carousel" role="region" aria-roledescription="carousel" aria-label={label} onKeyDown={onKey}>
      <div className="lp-carousel-frame">
        {slides.map((slide, i) => (
          <figure
            key={slide.src}
            className={slideClass(i, index, move)}
            onAnimationEnd={() => i === move?.from && setMove(undefined)}
            role="group"
            aria-roledescription="slide"
            aria-label={slideLabel.replace("{n}", String(i + 1)).replace("{count}", String(slides.length))}
            aria-hidden={i !== index}
          >
            <img
              src={loaded.has(i) ? slide.src : undefined}
              data-src={slide.src}
              alt={slide.alt}
              width={slide.width}
              height={slide.height}
              decoding="async"
            />
          </figure>
        ))}
      </div>
      <div className="lp-carousel-bar">
        <button type="button" className="lp-carousel-arrow" aria-label={previousLabel} onClick={() => go(index - 1, "backward")}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="lp-carousel-caption" aria-live={paused ? "polite" : "off"}>
          <span>{slides[index].caption}</span>
        </p>
        <button
          type="button"
          className="lp-carousel-arrow"
          aria-label={paused ? playLabel : pauseLabel}
          title={paused ? playLabel : pauseLabel}
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M7 5v14l12-7z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="lp-carousel-dots">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              aria-label={slideLabel.replace("{n}", String(i + 1)).replace("{count}", String(slides.length))}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="lp-carousel-arrow" aria-label={nextLabel} onClick={() => go(index + 1, "forward")}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** A slide's classes: the one showing flies in, the one leaving flies out, the rest are hidden. */
function slideClass(i: number, index: number, move: Move | undefined): string {
  if (i === index) return `lp-slide lp-slide-on${move ? ` lp-slide-in-${move.dir}` : ""}`;
  if (move && i === move.from) return `lp-slide lp-slide-out-${move.dir}`;
  return "lp-slide";
}
