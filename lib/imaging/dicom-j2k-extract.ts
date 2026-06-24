/**
 * Extraction des métadonnées VOI et du codestream JPEG 2000 d'un fichier DICOM,
 * pour le viewer de repli OpenJPEG.
 */

import { DicomParser } from "dwv";

/** Transfer syntaxes JPEG 2000 (lossless / lossy). */
export const JPEG2000_TRANSFER_SYNTAXES = [
  "1.2.840.10008.1.2.4.90",
  "1.2.840.10008.1.2.4.91",
] as const;

export type DicomFallbackData = {
  transferSyntax: string;
  isJpeg2000: boolean;
  photometric: string;
  isMonochrome1: boolean;
  rows: number;
  columns: number;
  bitsStored: number;
  pixelRepresentation: number;
  windowCenter?: string | number;
  windowWidth?: string | number;
  codestream: Uint8Array;
};

type DicomElement = { value?: unknown; vl?: number };

function readValue(els: Record<string, DicomElement>, key: string): unknown {
  return els[key]?.value;
}

function readString(els: Record<string, DicomElement>, key: string): string {
  const v = readValue(els, key);
  if (Array.isArray(v)) return String(v[0] ?? "").trim();
  return v === undefined || v === null ? "" : String(v).trim();
}

function readNumber(els: Record<string, DicomElement>, key: string): number {
  const s = readString(els, key);
  const n = Number(s.split("\\")[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Concatène les fragments du PixelData encapsulé en un seul codestream. */
function concatFragments(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) {
    const frags = value.filter(
      (f): f is Uint8Array => f instanceof Uint8Array,
    );
    if (frags.length === 1) return frags[0]!;
    const total = frags.reduce((sum, f) => sum + f.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const f of frags) {
      out.set(f, offset);
      offset += f.length;
    }
    return out;
  }
  return new Uint8Array(0);
}

/**
 * Parse un fichier DICOM et renvoie les infos nécessaires au rendu de repli.
 * Renvoie null si le PixelData est absent.
 */
export function parseDicomForFallback(
  buffer: ArrayBuffer,
): DicomFallbackData | null {
  const parser = new DicomParser();
  parser.parse(buffer);
  const els = parser.getDicomElements() as Record<string, DicomElement>;

  const pixelData = readValue(els, "7FE00010");
  const codestream = concatFragments(pixelData);
  if (codestream.length === 0) return null;

  const transferSyntax = readString(els, "00020010");
  const photometric = readString(els, "00280004") || "MONOCHROME2";

  const wc = readString(els, "00281050");
  const ww = readString(els, "00281051");

  return {
    transferSyntax,
    isJpeg2000: (JPEG2000_TRANSFER_SYNTAXES as readonly string[]).includes(
      transferSyntax,
    ),
    photometric,
    isMonochrome1: photometric === "MONOCHROME1",
    rows: readNumber(els, "00280010"),
    columns: readNumber(els, "00280011"),
    bitsStored: readNumber(els, "00280101"),
    pixelRepresentation: readNumber(els, "00280103"),
    windowCenter: wc || undefined,
    windowWidth: ww || undefined,
    codestream,
  };
}
