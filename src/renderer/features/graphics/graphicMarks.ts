import type { BankAnnotation, BankGraphic } from "@renderer/appIde/annotations/programAnnotations";
import { bankGraphicLength } from "@renderer/appIde/annotations/programAnnotations";
import { DEFAULT_GRAPHICS_LOOK, type GraphicsLook } from "@common/reverse/graphicsDecode";
import type { ByteSpan, GraphicMark } from "./GraphicsView";

/*
 * What the graphics finder draws over the pixels from a bank's annotations
 * (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.4): the named graphics, and the code band.
 */

/** The named graphics of a bank, as overlay marks in bank offsets. */
export function graphicMarksOf(bank: BankAnnotation | undefined): GraphicMark[] {
  return (bank?.graphics ?? []).map((graphic) => ({
    start: graphic.offset,
    end: graphic.offset + bankGraphicLength(graphic) - 1,
    ...(graphic.label ? { label: graphic.label } : {})
  }));
}

/**
 * The spans the listing decodes as code, for the hatched band — only once the bank has been
 * classified at all. A bank with one region is all code by default, and hatching every byte of it
 * would say nothing.
 */
export function listingCodeSpans(bank: BankAnnotation | undefined): ByteSpan[] | undefined {
  if (!bank || bank.regions.length < 2) return undefined;
  return bank.regions
    .filter((region) => region.type === "disassemble")
    .map((region) => ({ start: region.start, end: region.end }));
}

/** The look a named graphic is shown with. */
export function lookOfGraphic(graphic: BankGraphic, base: GraphicsLook = DEFAULT_GRAPHICS_LOOK): GraphicsLook {
  return {
    ...base,
    width: graphic.width,
    height: graphic.height,
    layout: graphic.layout,
    mask: graphic.mask ?? "none",
    showMask: false
  };
}

/** The graphic a span would be named as under the current look: whole frames, at least one. */
export function graphicOfSpan(span: ByteSpan, look: GraphicsLook): Omit<BankGraphic, "label"> {
  const frameBytes = look.width * look.height * (look.mask !== "none" ? 2 : 1);
  const count = Math.max(1, Math.ceil((span.end - span.start + 1) / Math.max(1, frameBytes)));
  return {
    offset: span.start,
    width: look.width,
    height: look.height,
    count,
    layout: look.layout,
    ...(look.mask !== "none" ? { mask: look.mask } : {})
  };
}
