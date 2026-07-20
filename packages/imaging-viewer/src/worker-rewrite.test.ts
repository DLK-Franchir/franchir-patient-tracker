import { describe, expect, it } from 'vitest'
import {
  DWV_ASSETS_WORKERS_SEGMENT,
  DWV_NEXT_CONFIG_REWRITES,
  DWV_NEXT_WORKER_MATCHER,
  DWV_PUBLIC_PATH_PREFIXES,
  DWV_WORKERS_PUBLIC_DIR,
  OPENJPEG_PUBLIC_DIR,
  OPENJPEG_SCRIPT_URL,
  dwvWorkerRewriteTarget,
  isDwvPublicAssetPath,
} from './worker-rewrite'

describe('dwvWorkerRewriteTarget', () => {
  it('réécrit le chemin worker runtime dwv (sous /_next) vers public', () => {
    expect(
      dwvWorkerRewriteTarget(
        '/_next/static/chunks/assets/workers/jpeg2000.worker.min.js',
      ),
    ).toBe(`${DWV_WORKERS_PUBLIC_DIR}/jpeg2000.worker.min.js`)
  })

  it('réécrit le chemin worker bare /assets/workers', () => {
    expect(dwvWorkerRewriteTarget(`${DWV_ASSETS_WORKERS_SEGMENT}/rle.worker.min.js`)).toBe(
      `${DWV_WORKERS_PUBLIC_DIR}/rle.worker.min.js`,
    )
  })

  it('ignore les chemins non-worker', () => {
    expect(dwvWorkerRewriteTarget('/dashboard')).toBeNull()
    expect(dwvWorkerRewriteTarget('/_next/static/chunks/main.js')).toBeNull()
    expect(dwvWorkerRewriteTarget(`${OPENJPEG_SCRIPT_URL}`)).toBeNull()
  })
})

describe('dwv public path constants', () => {
  it('expose préfixes publics workers + OpenJPEG', () => {
    expect(DWV_PUBLIC_PATH_PREFIXES).toContain(DWV_WORKERS_PUBLIC_DIR)
    expect(DWV_PUBLIC_PATH_PREFIXES).toContain(DWV_ASSETS_WORKERS_SEGMENT)
    expect(DWV_PUBLIC_PATH_PREFIXES).toContain(OPENJPEG_PUBLIC_DIR)
  })

  it('détecte les chemins assets publics', () => {
    expect(isDwvPublicAssetPath('/dwv-workers/jpeg2000.worker.min.js')).toBe(true)
    expect(isDwvPublicAssetPath('/assets/workers/rle.worker.min.js')).toBe(true)
    expect(isDwvPublicAssetPath('/openjpeg/openjpegjs.js')).toBe(true)
    expect(isDwvPublicAssetPath('/dashboard')).toBe(false)
  })

  it('aligne matcher middleware et rewrites next.config', () => {
    expect(DWV_NEXT_WORKER_MATCHER).toBe('/_next/:path*/assets/workers/:file')
    expect(DWV_NEXT_CONFIG_REWRITES).toEqual([
      {
        source: '/:prefix*/assets/workers/:file',
        destination: '/dwv-workers/:file',
      },
      {
        source: '/assets/workers/:file',
        destination: '/dwv-workers/:file',
      },
    ])
  })

  it('fixe l URL script OpenJPEG', () => {
    expect(OPENJPEG_SCRIPT_URL).toBe('/openjpeg/openjpegjs.js')
  })
})
