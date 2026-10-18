"use client";
/**
 * The hero's carousel: Klive in action, from the IDE to the Next tools.
 *
 * - The first slide is in the static HTML, so the page is complete before any JavaScript runs.
 *   The others load only when they are about to show (their `src` is set then), so a visitor who
 *   never looks at them downloads nothing extra.
 * - It advances by itself every few seconds, and stops for good once the visitor uses it. It never
 *   moves while the pointer is over it, while it has the keyboard focus, or when the visitor asked
 *   for reduced motion.
 * - Buttons, dots and the arrow keys change slides; each slide has a caption, which is also the
 *   image's description for screen readers.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = { src: string; alt: string; caption: string; width: number; height: number };

type Props = Readonly<{
  slides: Slide[];
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** "Slide {n} of {count}", with the placeholders still in it */
  slideLabel: string;
}>;

const INTERVAL_MS = 6000;

export default function HeroCarousel({ slides, label, previousLabel, nextLabel, slideLabel }: Props) {
  const [index, setIndex] = useState(0);
  // --- Slides whose image may load: the current one and the next one
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]));
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (target: number, byUser = false) => {
      const next = (target + slides.length) % slides.length;
      setIndex(next);
      setLoaded((prev) => new Set([...prev, next, (next + 1) % slides.length]));
      if (byUser) setStopped(true);
    },
    [slides.length]
  );

  useEffect(() => {
    // --- Preload the second slide once the page is idle
    const id = setTimeout(() => setLoaded((prev) => new Set([...prev, 1 % slides.length])), 1500);
    return () => clearTimeout(id);
  }, [slides.length]);

  useEffect(() => {
    if (paused || stopped || slides.length < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => clearTimeout(id);
  }, [index, paused, stopped, go, slides.length]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") go(index + 1, true);
    else if (e.key === "ArrowLeft") go(index - 1, true);
  };

  return (
    <div
      ref={root}
      className="lp-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setPaused(false);
      }}
      onKeyDown={onKey}
    >
      <div className="lp-carousel-frame">
        {slides.map((slide, i) => (
          <figure
            key={slide.src}
            className={`lp-slide${i === index ? " lp-slide-on" : ""}`}
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
        <button type="button" className="lp-carousel-arrow" aria-label={previousLabel} onClick={() => go(index - 1, true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="lp-carousel-caption" aria-live={stopped ? "polite" : "off"}>
          {slides[index].caption}
        </p>
        <div className="lp-carousel-dots">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              aria-label={slideLabel.replace("{n}", String(i + 1)).replace("{count}", String(slides.length))}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i, true)}
            />
          ))}
        </div>
        <button type="button" className="lp-carousel-arrow" aria-label={nextLabel} onClick={() => go(index + 1, true)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
