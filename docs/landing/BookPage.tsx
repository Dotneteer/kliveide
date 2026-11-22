/**
 * /unraveling-book/: the page of "Unraveling the ZX Spectrum Next", the book the landing page's card
 * promotes. It wears the landing page's header and footer (SiteChrome.tsx) and its sheet layout:
 * the cover and the downloads first, then the book in numbers, its parts and chapters, the examples
 * and why it was written. The book is English, and so is this page (like the Library's manuals);
 * its facts come from docs/books/unraveling-next/book.json.
 */
import { BOOK_EXAMPLES, BOOK_PDF, COVER_RATIO, bookCover, demoCount, examplesBytes, readBook } from "./book";
import { DOWNLOAD_ICON, FOLDER_ICON } from "./BookCard";
import ImageViewer from "./ImageViewer";
import { SiteFooter, SiteHeader } from "./SiteChrome";
import { landingTranslator } from "./i18n";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** "6.6 MB", "75 KB" */
function size(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** A chapter's short title: its heading before the colon */
function shortTitle(chapter: string): string {
  return chapter.split(": ")[0];
}

function Downloads({ pdf, zip }: Readonly<{ pdf: string; zip: string }>) {
  return (
    <div className="lp-actions">
      <a className="lp-button lp-button-primary" href={BOOK_PDF} download>
        {DOWNLOAD_ICON}
        Download the book <span className="bk-size">PDF, {pdf}</span>
      </a>
      <a className="lp-button" href={BOOK_EXAMPLES} download>
        {FOLDER_ICON}
        Download the examples <span className="bk-size">ZIP, {zip}</span>
      </a>
    </div>
  );
}

export default function BookPage() {
  const t = landingTranslator("en");
  const book = readBook();
  const pdf = size(book.pdfBytes);
  const zip = size(examplesBytes());
  const chapters = book.parts.reduce((n, p) => n + p.chapters.length, 0);
  const demos = demoCount(book);
  return (
    <div className="lp">
      <SiteHeader lang="en" />

      <main id="main" className="lp-main">
        <section className="bk-hero">
          <a
            className="bk-cover"
            href={bookCover(1500)}
            data-viewer="book"
            data-caption={book.title}
            aria-label={t("viewer.open", { title: book.title })}
          >
            <img src={bookCover(720)} alt="" width={COVER_RATIO.width * 360} height={COVER_RATIO.height * 360} decoding="async" />
          </a>
          <div>
            <h1>{book.title}</h1>
            <p className="bk-subtitle">{book.subtitle}</p>
            <p className="bk-by">by {book.author}, the author of Klive IDE</p>
            <p className="lp-lead">
              How the ZX Spectrum Next works inside, and how to program it: the Z80N, memory and NextRegs, the
              display layers, the sound chips and the mixer, and the ports that reach the world. Written while
              building Klive&apos;s Next emulator, from the documentation, the real machine and the FPGA source.
            </p>
            <Downloads pdf={pdf} zip={zip} />
            <p className="lp-fine">
              Free to download. The examples are a Klive IDE project: unzip it, open the <span className="lp-mono">examples</span>{" "}
              folder and choose Run.
            </p>
          </div>
        </section>

        <section className="bk-facts" aria-label="The book in numbers">
          <div>
            <b>{book.pages}</b>
            <span>pages, in colour</span>
          </div>
          <div>
            <b>{book.parts.length} parts</b>
            <span>{chapters} chapters</span>
          </div>
          <div>
            <b>{demos} demos</b>
            <span>
              in one <span className="lp-mono">.nex</span> program
            </span>
          </div>
          <div>
            <b>Klive IDE</b>
            <span>project, ready to run</span>
          </div>
        </section>

        <section className="lp-sec lp-band" aria-labelledby="bk-inside">
          <h2 id="bk-inside">What is inside</h2>
          <div className="bk-parts">
            {book.parts.map((part, i) => (
              <div key={part.title}>
                <h3>
                  <span className={`lp-square lp-square-${i + 1}`} aria-hidden="true" />
                  {part.title}
                </h3>
                <p className="bk-part-count">
                  Part {i + 1}, {part.chapters.length} chapters
                </p>
                <ol>
                  {part.chapters.map((c) => (
                    <li key={c} title={c}>
                      {shortTitle(c)}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-sec bk-two">
          <div>
            <h2>The examples</h2>
            <p>
              Every chapter that has something to show has a demo. They are built into one program,{" "}
              <span className="lp-mono">book-demos.nex</span>: a menu by part, then the part&apos;s demos in book
              order. Each demo puts back what it changed and returns to the menu.
            </p>
            <ol className="bk-steps">
              <li>Download the examples and unzip them.</li>
              <li>
                In Klive IDE, open the <span className="lp-mono">examples</span> folder as a project.
              </li>
              <li>
                Choose <b>Run</b>: Klive builds the program, boots NextZXOS and loads it.
              </li>
            </ol>
            <p>
              On a real Next, copy <span className="lp-mono">book-demos.nex</span> to the SD card and open it from the
              NextZXOS Browser. The demos never write to the SD card, the cores&apos; flash, the Wi-Fi module or the
              clock.
            </p>
            <Downloads pdf={pdf} zip={zip} />
          </div>
          <div>
            <h2>{demos} demos</h2>
            <ul className="bk-demos">
              {book.parts.map((part) => (
                <li key={part.title}>
                  <b>{part.title}</b>
                  <span>{part.demos.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="lp-sec lp-band">
          <h2>Why this book</h2>
          <p className="bk-why">
            The official documentation of the Next says what each register does and leaves the reader to work out
            how the pieces fit. {book.author} worked it out while emulating the machine in Klive IDE: from the
            documents, from experiments on the real hardware and from the public FPGA source. The book shows how
            and why things work, not only what they are, starting with the machine and going on to the picture,
            the sound and the way the Next talks to the world.
          </p>
        </section>

        <section className="lp-end">
          <div>
            <h2>Get the book</h2>
            <p>The PDF and the examples, free.</p>
          </div>
          <Downloads pdf={pdf} zip={zip} />
        </section>
      </main>

      <SiteFooter lang="en" />

      <ImageViewer label={t("viewer.label")} closeLabel={t("viewer.close")} countLabel={t("viewer.count")} />
    </div>
  );
}

export function bookMetadata() {
  const book = readBook();
  const description = `${book.subtitle}. A free ${book.pages}-page book by ${book.author}, with a Klive IDE project of demos.`;
  return {
    title: `${book.title} | Klive IDE`,
    description,
    alternates: { canonical: `${basePath}/unraveling-book/` },
    openGraph: { title: book.title, description, images: [bookCover(720)] },
    icons: { icon: `${basePath}/images/klive-logo.svg` }
  };
}
