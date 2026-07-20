/**
 * Décodage JPEG 2000 via OpenJPEG (WebAssembly), chargé comme asset
 * public (pas d'import bundlé — branche Node du glue Emscripten).
 * Module client uniquement.
 */

import { OPENJPEG_SCRIPT_URL } from '../../worker-rewrite'

export type DecodedFrame = {
  pixels: Uint16Array | Int16Array | Uint8Array
  width: number
  height: number
  bitsPerSample: number
  componentCount: number
  isSigned: boolean
}

type J2KDecoder = {
  getEncodedBuffer: (length: number) => Uint8Array
  decode: () => void
  getFrameInfo: () => {
    width: number
    height: number
    bitsPerSample: number
    componentCount: number
    isSigned: boolean
  }
  getDecodedBuffer: () => Uint8Array
  delete?: () => void
}

type OpenJpegModule = { J2KDecoder: new () => J2KDecoder }
type OpenJpegFactory = (moduleArg?: object) => Promise<OpenJpegModule>

let modulePromise: Promise<OpenJpegModule> | null = null
let scriptPromise: Promise<OpenJpegFactory> | null = null

function loadOpenJpegScript(): Promise<OpenJpegFactory> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<OpenJpegFactory>((resolve, reject) => {
    const existing = (globalThis as { OpenJPEGJS?: OpenJpegFactory }).OpenJPEGJS
    if (existing) {
      resolve(existing)
      return
    }
    const script = document.createElement('script')
    script.src = OPENJPEG_SCRIPT_URL
    script.async = true
    script.onload = () => {
      const factory = (globalThis as { OpenJPEGJS?: OpenJpegFactory }).OpenJPEGJS
      if (factory) resolve(factory)
      else reject(new Error('OpenJPEG: script chargé mais factory introuvable'))
    }
    script.onerror = () => reject(new Error('OpenJPEG: échec de chargement du décodeur'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

async function getOpenJpeg(): Promise<OpenJpegModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const factory = await loadOpenJpegScript()
      return factory()
    })()
  }
  return modulePromise
}

/** Décode un flux JPEG 2000 (codestream brut ou JP2) en pixels typés. */
export async function decodeJpeg2000(
  codestream: Uint8Array,
): Promise<DecodedFrame> {
  const ojp = await getOpenJpeg()
  const decoder = new ojp.J2KDecoder()
  try {
    const encoded = decoder.getEncodedBuffer(codestream.length)
    encoded.set(codestream)
    decoder.decode()
    const info = decoder.getFrameInfo()
    const raw = decoder.getDecodedBuffer()

    let pixels: Uint16Array | Int16Array | Uint8Array
    if (info.bitsPerSample > 8) {
      const count = raw.length / 2
      const copy = raw.slice()
      pixels = info.isSigned
        ? new Int16Array(copy.buffer, copy.byteOffset, count)
        : new Uint16Array(copy.buffer, copy.byteOffset, count)
    } else {
      pixels = raw.slice()
    }

    return {
      pixels,
      width: info.width,
      height: info.height,
      bitsPerSample: info.bitsPerSample,
      componentCount: info.componentCount,
      isSigned: info.isSigned,
    }
  } finally {
    decoder.delete?.()
  }
}
