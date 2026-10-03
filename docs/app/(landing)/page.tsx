/**
 * The Klive IDE landing page - prototype.
 *
 * Static server component. The Documentation button is a `next/link`, so Next applies
 * `basePath` to it; plain <img> sources are not rewritten, so they get the prefix by hand
 * (the same way `app/(docs)/layout.tsx` does for the navbar logo).
 */
import Link from "next/link";

// Must match `basePath` in next.config.mjs; see docs/.env.production.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const DOCS_HOME = "/introduction";
const GITHUB_URL = "https://github.com/Dotneteer/kliveide";
const DOWNLOAD_URL = `${GITHUB_URL}/releases/latest`;

const features = [
  {
    title: "Retro emulators",
    text: "ZX Spectrum 48K, 128K, +2E/+3E and Cambridge Z88, with the ZX Spectrum Next on the way."
  },
  {
    title: "IDE and debugger",
    text: "Breakpoints, stepping, memory and disassembly views, CPU and machine state panels, and a multi-pane code editor."
  },
  {
    title: "Z80 assembler",
    text: "A full-featured Klive Z80 assembler with macros, structs and ZX Spectrum Next extensions."
  },
  {
    title: "ZX BASIC",
    text: "Write, build and debug ZX BASIC programs right next to your assembly code."
  }
];

export default function LandingPage() {
  return (
    <>
      <header className="landing-header">
        <a className="landing-brand" href={`${basePath}/`}>
          <img src={`${basePath}/images/klive-logo.svg`} alt="" width={40} height={40} />
          <span>Klive IDE</span>
        </a>
        <nav className="landing-nav">
          <a className="landing-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link className="landing-button" href={DOCS_HOME}>
            Documentation
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <h1>The retro computer IDE for Z80 machines</h1>
          <p className="landing-lead">
            Klive IDE is a retro computer emulator and Integrated Development Environment running
            on Mac and Windows.
          </p>
          <div className="landing-actions">
            <a className="landing-button landing-button-primary" href={DOWNLOAD_URL}>
              Download
            </a>
            <Link className="landing-button" href={DOCS_HOME}>
              Read the docs
            </Link>
          </div>
          <img
            className="landing-shot"
            src={`${basePath}/images/intro/klive-ide-intro.png`}
            alt="Klive IDE with the emulator and the code editor"
          />
        </section>

        <section className="landing-features" aria-label="Features">
          {features.map((f) => (
            <article key={f.title} className="landing-card">
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing-footer">
        Klive IDE is open source.{" "}
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          View it on GitHub
        </a>
        .
      </footer>
    </>
  );
}
