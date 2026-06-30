import type { App } from "dwv";

/**
 * SYNC: structure alignée sur franchir-patient-tracker/components/patient/dicom-viewer/
 * (pas de package partagé — garder les deux dossiers en parité fonctionnelle).
 */

/** Presets fenêtrage courants en neurochirurgie / IRM rachis. */
export const WL_PRESETS = [
  { id: "soft", label: "Tissus mous", center: 40, width: 400 },
  { id: "bone", label: "Os", center: 300, width: 1500 },
  { id: "brain", label: "Cerveau", center: 40, width: 80 },
] as const;

export type WlPresetId = (typeof WL_PRESETS)[number]["id"];

export type ViewerSeries = {
  id: string;
  label: string;
  urls: string[];
  /** Nombre de fichiers DICOM dans le groupe (peut différer du nombre de coupes dwv). */
  fileCount: number;
};

export type DicomTool = "WindowLevel" | "ZoomAndPan" | "Scroll";

export type DwvLoadEvent = {
  loaded?: number;
  total?: number;
  error?: { message?: string } | string;
};

export type ViewerStatus = "loading" | "rendering" | "ready" | "error";

export type ViewerInfoKind = "loading" | "single" | "stack" | "partial" | "sequential" | "error";

export type NavMode = "stack" | "sequential";

export type PoolEntryStatus = "loading" | "ready" | "error";

export type PoolEntry = {
  app: App;
  container: HTMLDivElement;
  layerGroupId: string;
  status: PoolEntryStatus;
  errorMessage?: string;
};

/** Limite mémoire : une App dwv isolée par fichier en mode séquentiel. */
export const MAX_SEQUENTIAL_POOL = 50;
/** Chargements dwv parallèles max (évite OOM sur séries JPEG volumineuses). */
export const MAX_POOL_LOAD_CONCURRENCY = 4;

export const STACK_LOAD_FAIL_MS = 120_000;
export const STACK_RENDER_READY_MS = 400;
/** Delais progressifs apres load dwv (workers J2K / JPEG-LS). */
export const RENDER_READY_DELAYS_MS = [400, 800, 1500, 3000, 6000, 10000, 15000] as const;
export const STACK_PROGRESS_FALLBACK_MS = 600;
export const LAYOUT_RETRY_DELAYS_MS = [0, 50, 150, 400, 800] as const;

/** dwv refuse d'empiler des coupes dont l'orientation ImageOrientationPatient diffère. */
export function isStackOrientationMismatch(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("different orientation") ||
    lower.includes("orientation mismatch") ||
    lower.includes("orientations différentes")
  );
}

export const SEQUENTIAL_ORIENTATION_FALLBACK_MSG =
  "Orientations d'images incompatibles — affichage fichier par fichier.";

/**
 * Le décodeur JPEG 2000 de dwv (portage PDF.js) rejette certaines options de
 * codage (« selective arithmetic coding bypass », marqueur COD) utilisées par
 * des radios DX. Dans ce cas on bascule vers le viewer de repli OpenJPEG.
 */
export function isUnsupportedJpeg2000Error(
  message: string | null | undefined,
): boolean {
  if (!message?.trim()) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("jpx") ||
    lower.includes("selectivearithmeticcodingbypass") ||
    (lower.includes("unsupported") && lower.includes("cod options"))
  );
}

/** Messages utilisateur pour échecs dwv / transfer syntax non supportée. */
export function formatDicomLoadError(message: string | null | undefined): string {
  if (!message?.trim()) {
    return "format non pris en charge, fichier corrompu ou lien expiré";
  }
  const lower = message.toLowerCase();
  if (
    lower.includes("invalidjwt") ||
    lower.includes('"exp" claim') ||
    lower.includes("jwt expired") ||
    (lower.includes("400") && lower.includes("storage"))
  ) {
    return "Lien imagerie expiré — fermez la visionneuse et rouvrez la série";
  }
  if (
    lower.includes("jpeg-ls") ||
    lower.includes("jpegls") ||
    lower.includes("1.2.840.10008.1.2.4.80") ||
    lower.includes("1.2.840.10008.1.2.4.81")
  ) {
    return "Format DICOM non supporté (JPEG-LS) — contactez le support";
  }
  if (
    lower.includes("jpeg 2000") ||
    lower.includes("jpeg2000") ||
    lower.includes("1.2.840.10008.1.2.4.90") ||
    lower.includes("1.2.840.10008.1.2.4.91")
  ) {
    return "Format DICOM non supporté (JPEG 2000) — contactez le support";
  }
  if (
    lower.includes("jpeg lossless") ||
    lower.includes("jpegloss") ||
    lower.includes("1.2.840.10008.1.2.4.70")
  ) {
    return "Format DICOM non supporté (JPEG Lossless) — contactez le support";
  }
  if (lower.includes("codec") || lower.includes("decompress") || lower.includes("transfer syntax")) {
    return "Format DICOM non supporté — contactez le support";
  }
  if (
    lower.includes("encapsulated pdf") ||
    lower.includes("pdf encapsul") ||
    lower.includes("modality doc") ||
    lower.includes("1.2.840.10008.5.1.4.1.1.104.1")
  ) {
    return "Format non supporté : PDF encapsulé (ouvrir via la carte document PDF)";
  }
  return message;
}

let layerGroupCounter = 0;

export function nextLayerGroupId(): string {
  layerGroupCounter += 1;
  return `dwv-group-${layerGroupCounter}`;
}

export type DicomViewerProps = {
  urls: string[];
  name: string;
  embedded?: boolean;
  fullscreen?: boolean;
  series?: ViewerSeries[];
  activeSeriesIndex?: number;
  onNextSeries?: () => void;
  onPrevSeries?: () => void;
  onClose?: () => void;
  onSliceCountResolved?: (count: number) => void;
  /** Appelé quand dwv ne sait pas décoder le JPEG 2000 (→ repli OpenJPEG). */
  onJpeg2000Unsupported?: () => void;
};

export function resolveViewerInfoKind(input: {
  isBusy: boolean;
  status: ViewerStatus;
  navMode: NavMode;
  fileCount: number;
  sliceCount: number;
}): ViewerInfoKind {
  if (input.isBusy) return "loading";
  if (input.status === "error") return "error";
  if (input.navMode === "sequential" && input.fileCount > 1) return "sequential";
  if (input.fileCount > 1 && input.sliceCount > 1 && input.fileCount > input.sliceCount) {
    return "partial";
  }
  if (input.sliceCount > 1) return "stack";
  return "single";
}
