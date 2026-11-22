/** /unraveling-book/: the page of the book the landing page promotes (English only). */
import BookPage, { bookMetadata } from "../../../landing/BookPage";
import "../../../landing/book.css";

export const metadata = bookMetadata();

export default function UnravelingBook() {
  return <BookPage />;
}
