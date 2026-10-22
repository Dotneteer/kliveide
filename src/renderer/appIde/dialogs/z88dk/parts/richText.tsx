import { Fragment, type ReactNode } from "react";

import type { MessageKey } from "@common/i18n/keys.generated";
import type { TFunction } from "@common/i18n/useT";

const MARK = "\u0000";

/**
 * Formats one whole message and puts React nodes where its placeholders are, so a
 * sentence that wraps part of itself in markup (a `<span>` with a test id, an
 * `<em>`) is still translated as one sentence, with the word order the
 * translation chose.
 */
export function richText(t: TFunction, key: MessageKey, nodes: Readonly<Record<string, ReactNode>>): ReactNode {
  const markers: Record<string, string> = {};
  for (const name of Object.keys(nodes)) markers[name] = `${MARK}${name}${MARK}`;
  const parts = t(key, markers).split(MARK);
  // --- Odd parts are placeholder names, even parts the text between them.
  return parts.map((part, index) =>
    index % 2 === 1 && part in nodes ? (
      <Fragment key={index}>{nodes[part]}</Fragment>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}
