/**
 * /unraveling-book/: the English page of the book the landing page promotes. The other languages'
 * pages render the same component under `app/[lang]/unraveling-book`.
 */
import BookPage, { bookMetadata } from "../../../landing/BookPage";
import "../../../landing/book.css";

export const metadata = bookMetadata("en");

export default function UnravelingBook() {
  return <BookPage lang="en" />;
}
