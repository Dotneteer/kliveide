"use client";
/**
 * The Download button: picks the install kit for the visitor's operating system. The server
 * renders the generic button (the page is static), and the browser swaps in the specific one;
 * without JavaScript, or on a phone, the button opens the releases page.
 */
import { useEffect, useState } from "react";
import type { Downloads } from "./site-info";

type Props = Readonly<{
  downloads: Downloads;
  releasesPage: string;
  /** "Download for {os}", with {os} still in it */
  labelForOs: string;
  labelGeneric: string;
}>;

type Choice = { os: string; href: string };

async function detect(downloads: Downloads): Promise<Choice | undefined> {
  const nav = navigator as Navigator & {
    userAgentData?: { platform: string; getHighEntropyValues(k: string[]): Promise<{ architecture?: string }> };
  };
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return undefined;
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  let arm = /arm|aarch64/i.test(ua);
  if (nav.userAgentData?.getHighEntropyValues) {
    try {
      arm = (await nav.userAgentData.getHighEntropyValues(["architecture"])).architecture === "arm";
    } catch {
      /* keep the guess */
    }
  }
  if (/mac/i.test(platform)) {
    // --- Safari never reports the CPU; Apple silicon is the safe guess for a current Mac
    const href = (arm || !nav.userAgentData ? downloads.macArm64 : downloads.macX64) ?? downloads.macArm64;
    return href ? { os: "macOS", href } : undefined;
  }
  if (/win/i.test(platform)) return downloads.windowsX64 ? { os: "Windows", href: downloads.windowsX64 } : undefined;
  if (/linux/i.test(platform)) {
    const href = arm ? downloads.linuxArm64 : downloads.linuxX64;
    return href ? { os: "Linux", href } : undefined;
  }
  return undefined;
}

export default function DownloadButton({ downloads, releasesPage, labelForOs, labelGeneric }: Props) {
  const [choice, setChoice] = useState<Choice>();
  useEffect(() => {
    detect(downloads).then(setChoice);
  }, [downloads]);
  return (
    <a className="lp-button lp-button-primary" href={choice?.href ?? releasesPage}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {choice ? labelForOs.replace("{os}", choice.os) : labelGeneric}
    </a>
  );
}
