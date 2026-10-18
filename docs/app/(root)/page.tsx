/** The English landing page at "/". */
import LandingPage, { landingMetadata } from "../../landing/LandingPage";

export const metadata = landingMetadata("en");

export default function Home() {
  return <LandingPage lang="en" />;
}
