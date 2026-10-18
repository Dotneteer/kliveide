/** The English landing page at "/". */
import LandingPage, { landingMetadata } from "../../landing/LandingPage";
import LanguageSuggestion from "../../landing/LanguageSuggestion";

export const metadata = landingMetadata("en");

export default function Home() {
  return (
    <>
      <LanguageSuggestion current="en" />
      <LandingPage lang="en" />
    </>
  );
}
