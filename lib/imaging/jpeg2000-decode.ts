/**
 * Décodage JPEG 2000 via OpenJPEG (WebAssembly).
 *
 * dwv 0.36 embarque un décodeur JPEG 2000 (portage PDF.js) qui rejette
 * certaines options de codage (« selective arithmetic coding bypass »,
 * marqueur COD) présentes sur les radios DX de certains constructeurs. OpenJPEG
 * décode ces flux sans problème : on l'utilise comme repli côté navigateur.
 *
 * Module client uniquement (WASM embarqué en base64 dans le glue Emscripten,
 * aucun asset .wasm séparé à servir).
 */

export type DecodedFrame = {
  pixels: Uint16Array | Int16Array | Uint8Array;
  width: number;
  height: number;
  bitsPerSample: number;
  componentCount: number;
  isSigned: boolean;
};

type J2KDecoder = {
  getEncodedBuffer: (length: number) => Uint8Array;
  decode: () => void;
  getFrameInfo: () => {
    width: number;
    height: number;
    bitsPerSample: number;
    componentCount: number;
    isSigned: boolean;
  };
  getDecodedBuffer: () => Uint8Array;
  delete?: () => void;
};

type OpenJpegModule = {
  J2KDecoder: new () => J2KDecoder;
};

let modulePromise: Promise<OpenJpegModule> | null = null;

async function getOpenJpeg(): Promise<OpenJpegModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const imported = (await import(
        "@cornerstonejs/codec-openjpeg"
      )) as unknown as
        | { default?: () => Promise<OpenJpegModule> }
        | (() => Promise<OpenJpegModule>);
      const factory =
        typeof imported === "function"
          ? imported
          : (imported.default as () => Promise<OpenJpegModule>);
      return factory();
    })();
  }
  return modulePromise;
}

/** Décode un flux JPEG 2000 (codestream brut ou JP2) en pixels typés. */
export async function decodeJpeg2000(
  codestream: Uint8Array,
): Promise<DecodedFrame> {
  const ojp = await getOpenJpeg();
  const decoder = new ojp.J2KDecoder();
  try {
    const encoded = decoder.getEncodedBuffer(codestream.length);
    encoded.set(codestream);
    decoder.decode();
    const info = decoder.getFrameInfo();
    const raw = decoder.getDecodedBuffer();

    let pixels: Uint16Array | Int16Array | Uint8Array;
    if (info.bitsPerSample > 8) {
      const count = raw.length / 2;
      // copie hors du heap WASM (réutilisé au prochain décodage)
      const copy = raw.slice();
      pixels = info.isSigned
        ? new Int16Array(copy.buffer, copy.byteOffset, count)
        : new Uint16Array(copy.buffer, copy.byteOffset, count);
    } else {
      pixels = raw.slice();
    }

    return {
      pixels,
      width: info.width,
      height: info.height,
      bitsPerSample: info.bitsPerSample,
      componentCount: info.componentCount,
      isSigned: info.isSigned,
    };
  } finally {
    decoder.delete?.();
  }
}
