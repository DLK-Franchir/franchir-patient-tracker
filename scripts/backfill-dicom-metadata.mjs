/**
 * ============================================================================
 * Backfill des métadonnées DICOM + déduplication par SOPInstanceUID (existant).
 *
 * Pourquoi : avant la migration patient_documents_dicom_metadata, les coupes
 * étaient dédupliquées par nom+taille (fragile). Ce script lit l'EN-TÊTE de
 * chaque objet DICOM en Storage (requête Range, ~64 Ko), en extrait les
 * métadonnées (SOPInstanceUID, SeriesInstanceUID, InstanceNumber, dates), puis :
 *   1. renseigne les nouvelles colonnes de patient_documents ;
 *   2. supprime les VRAIS doublons (même SOPInstanceUID), en gardant la coupe
 *      la plus volumineuse (la plus complète) — lignes + objets Storage.
 *
 * Sécurité / réversibilité :
 *   - lit SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY depuis .env.local (jamais
 *     affichés) ;
 *   - écrit une sauvegarde JSON des lignes supprimées sous
 *     .dicom-dedupe-backups/ (gitignored) AVANT toute suppression ;
 *   - `--dry-run` n'écrit rien (inspection seule).
 *
 * Usage :
 *   node scripts/backfill-dicom-metadata.mjs <patientId> [--dry-run]
 * ============================================================================
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'patient-documents'
const HEADER_RANGE_BYTES = 96 * 1024
const DOWNLOAD_CONCURRENCY = 8

// ── .env.local (clé service-role lue, jamais journalisée) ────────────────────
function loadEnvLocal() {
  const env = {}
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let value = m[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      env[m[1]] = value
    }
  } catch {
    /* noop */
  }
  return env
}

// ── Parseur DICOM minimal (port fidèle de lib/imaging/dicom-content.ts) ──────
const DICM = [0x44, 0x49, 0x43, 0x4d]
const IMPLICIT_VR_LE = '1.2.840.10008.1.2'
const EXPLICIT_VR_LE = '1.2.840.10008.1.2.1'
const LONG_VR = new Set(['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC'])

const TAG_TRANSFER_SYNTAX = 0x00100002
const TAG_SOP_INSTANCE_UID = 0x00180008
const TAG_SERIES_INSTANCE_UID = 0x000e0020
const TAG_SERIES_DESCRIPTION = 0x103e0008
const TAG_BODY_PART = 0x00150018
const TAG_INSTANCE_NUMBER = 0x00130020
const TAG_ACQUISITION_DATETIME = 0x002a0008
const TAG_ACQUISITION_DATE = 0x00220008
const TAG_ACQUISITION_TIME = 0x00320008
const TAG_SERIES_DATE = 0x00210008
const TAG_STUDY_DATE = 0x00200008

const u16 = (v, o) => v[o] | (v[o + 1] << 8)
const u32 = (v, o) => (v[o] | (v[o + 1] << 8) | (v[o + 2] << 16) | (v[o + 3] << 24)) >>> 0

function hasPreamble(v) {
  return v.length >= 132 && v[128] === DICM[0] && v[129] === DICM[1] && v[130] === DICM[2] && v[131] === DICM[3]
}

const UNDEFINED_LENGTH = 0xffffffff

function readTag(v, offset, implicit) {
  if (offset + 8 > v.length) return null
  const tag = u16(v, offset) | (u16(v, offset + 2) << 16)
  if (implicit) {
    const length = u32(v, offset + 4)
    return { tag, valueOffset: offset + 8, valueLength: length, nextOffset: offset + 8 + length }
  }
  const vr = String.fromCharCode(v[offset + 4], v[offset + 5])
  if (LONG_VR.has(vr)) {
    if (offset + 12 > v.length) return null
    const length = u32(v, offset + 8)
    return { tag, valueOffset: offset + 12, valueLength: length, nextOffset: offset + 12 + length }
  }
  const length = u16(v, offset + 6)
  return { tag, valueOffset: offset + 8, valueLength: length, nextOffset: offset + 8 + length }
}

function endOfDataElement(v, pos, implicit) {
  if (pos + 8 > v.length) return v.length
  if (implicit) {
    const length = u32(v, pos + 4)
    const valOff = pos + 8
    if (length === UNDEFINED_LENGTH) return skipUndefinedSequence(v, valOff, implicit)
    return valOff + length
  }
  const vr = String.fromCharCode(v[pos + 4], v[pos + 5])
  if (LONG_VR.has(vr)) {
    const length = u32(v, pos + 8)
    const valOff = pos + 12
    if (length === UNDEFINED_LENGTH) return skipUndefinedSequence(v, valOff, implicit)
    return valOff + length
  }
  return pos + 8 + u16(v, pos + 6)
}

function skipUndefinedItem(v, pos, implicit) {
  while (pos + 8 <= v.length) {
    if (u16(v, pos) === 0xfffe && u16(v, pos + 2) === 0xe00d) return pos + 8
    const next = endOfDataElement(v, pos, implicit)
    if (next <= pos) return v.length
    pos = next
  }
  return v.length
}

function skipUndefinedSequence(v, pos, implicit) {
  while (pos + 8 <= v.length) {
    const group = u16(v, pos)
    const element = u16(v, pos + 2)
    const length = u32(v, pos + 4)
    pos += 8
    if (group === 0xfffe && element === 0xe0dd) return pos
    if (group === 0xfffe && element === 0xe000) {
      pos = length === UNDEFINED_LENGTH ? skipUndefinedItem(v, pos, implicit) : pos + length
    } else {
      return pos
    }
  }
  return v.length
}

function readStr(v, o, len) {
  return Buffer.from(v.subarray(o, o + len)).toString('ascii').replace(/\0+$/, '').trim()
}

function digits(s) {
  return s ? s.replace(/[^0-9]/g, '') : ''
}

function normalizeAcq(info) {
  const dt = digits(info.acquisitionDateTime)
  if (dt.length >= 8) return dt.slice(0, 14).padEnd(14, '0')
  const date = digits(info.acquisitionDate) || digits(info.seriesDate) || digits(info.studyDate)
  if (date.length < 8) return null
  return (date.slice(0, 8) + digits(info.acquisitionTime).slice(0, 6)).padEnd(14, '0')
}

function parseHeader(buffer) {
  const v = new Uint8Array(buffer)
  let offset = 0
  let transferSyntax = EXPLICIT_VR_LE
  let inMeta = false
  if (hasPreamble(v)) {
    offset = 132
    inMeta = true
  } else if (v.length < 8) {
    return null
  }
  const info = {
    sopInstanceUid: null,
    seriesInstanceUid: null,
    seriesDescription: null,
    bodyPart: null,
    instanceNumber: null,
    acquisitionDateTime: null,
    acquisitionDate: null,
    acquisitionTime: null,
    seriesDate: null,
    studyDate: null,
  }
  const limit = v.length
  while (offset + 8 <= limit) {
    const implicit = inMeta ? false : transferSyntax === IMPLICIT_VR_LE
    const p = readTag(v, offset, implicit)
    if (!p) break
    if (!inMeta && p.valueLength === UNDEFINED_LENGTH) {
      const skipped = skipUndefinedSequence(v, p.valueOffset, implicit)
      if (skipped <= offset) break
      offset = skipped
      continue
    }
    if (p.valueLength < 0 || p.nextOffset <= offset) break
    if (inMeta) {
      if ((p.tag & 0xffff) !== 0x0002) {
        inMeta = false
        continue
      }
      if (p.tag === TAG_TRANSFER_SYNTAX) transferSyntax = readStr(v, p.valueOffset, p.valueLength)
    } else {
      if (p.tag === TAG_SOP_INSTANCE_UID) info.sopInstanceUid = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_SERIES_INSTANCE_UID) info.seriesInstanceUid = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_SERIES_DESCRIPTION) info.seriesDescription = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_BODY_PART) info.bodyPart = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_INSTANCE_NUMBER) {
        const n = Number.parseInt(readStr(v, p.valueOffset, p.valueLength), 10)
        info.instanceNumber = Number.isFinite(n) ? n : null
      } else if (p.tag === TAG_ACQUISITION_DATETIME) info.acquisitionDateTime = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_ACQUISITION_DATE) info.acquisitionDate = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_ACQUISITION_TIME) info.acquisitionTime = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_SERIES_DATE) info.seriesDate = readStr(v, p.valueOffset, p.valueLength) || null
      else if (p.tag === TAG_STUDY_DATE) info.studyDate = readStr(v, p.valueOffset, p.valueLength) || null
    }
    offset = p.nextOffset
  }
  return {
    sopInstanceUid: info.sopInstanceUid,
    seriesInstanceUid: info.seriesInstanceUid,
    seriesDescription: info.seriesDescription,
    bodyPart: info.bodyPart,
    instanceNumber: info.instanceNumber,
    acquisitionDatetime: normalizeAcq(info),
  }
}

// ── Pool de concurrence simple ───────────────────────────────────────────────
async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

async function chunkedRemove(supabase, paths) {
  for (let i = 0; i < paths.length; i += 100) {
    const slice = paths.slice(i, i + 100)
    const { error } = await supabase.storage.from(BUCKET).remove(slice)
    if (error) console.error('  ! échec suppression Storage lot', i, error.message)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const patientId = args.find((a) => !a.startsWith('--'))
  if (!patientId) {
    console.error('Usage: node scripts/backfill-dicom-metadata.mjs <patientId> [--dry-run]')
    process.exit(1)
  }

  const env = loadEnvLocal()
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables dans .env.local')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  console.log(`\n== Backfill DICOM patient ${patientId}${dryRun ? ' (DRY-RUN)' : ''} ==`)

  const { data: rows, error } = await supabase
    .from('patient_documents')
    .select('id, file_path, file_name, mime_type, size_bytes, created_at, sop_instance_uid')
    .eq('patient_id', patientId)
    .eq('kind', 'dicom')
    .order('created_at', { ascending: true })
    .limit(5000)
  if (error) {
    console.error('Erreur lecture patient_documents:', error.message)
    process.exit(1)
  }
  console.log(`Lignes DICOM: ${rows.length}`)

  // 1) Lecture des en-têtes + parse.
  let parsed = 0
  let parseFailed = 0
  const metas = await mapPool(rows, DOWNLOAD_CONCURRENCY, async (row) => {
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(row.file_path, 120)
    if (signErr || !signed?.signedUrl) {
      parseFailed++
      return null
    }
    try {
      const res = await fetch(signed.signedUrl, { headers: { Range: `bytes=0-${HEADER_RANGE_BYTES - 1}` } })
      if (!res.ok && res.status !== 206) {
        parseFailed++
        return null
      }
      const buf = await res.arrayBuffer()
      const meta = parseHeader(buf)
      if (meta && (meta.sopInstanceUid || meta.seriesInstanceUid)) parsed++
      else parseFailed++
      return meta
    } catch {
      parseFailed++
      return null
    }
  })
  console.log(`En-têtes lus: ${parsed} ok, ${parseFailed} sans SOP/Series exploitable`)

  // 2) Regroupement par SOPInstanceUID.
  const bySop = new Map()
  const keepers = [] // { row, meta }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const meta = metas[i]
    const sop = meta?.sopInstanceUid
    if (sop) {
      const list = bySop.get(sop) ?? []
      list.push({ row, meta })
      bySop.set(sop, list)
    } else {
      keepers.push({ row, meta }) // pas de SOP → conservé tel quel
    }
  }

  const losers = []
  for (const list of bySop.values()) {
    if (list.length === 1) {
      keepers.push(list[0])
      continue
    }
    // garde la coupe la plus volumineuse (plus complète), tie-break = plus ancienne.
    list.sort((a, b) => {
      const sa = a.row.size_bytes ?? 0
      const sb = b.row.size_bytes ?? 0
      if (sa !== sb) return sb - sa
      return new Date(a.row.created_at) - new Date(b.row.created_at)
    })
    keepers.push(list[0])
    losers.push(...list.slice(1))
  }

  const uniqueSops = bySop.size
  console.log(`SOPInstanceUID distincts: ${uniqueSops}`)
  console.log(`Doublons à supprimer: ${losers.length}`)
  console.log(`Lignes conservées: ${keepers.length}`)

  if (dryRun) {
    console.log('\nDRY-RUN : aucune écriture. Aperçu des 5 premiers doublons:')
    for (const l of losers.slice(0, 5)) {
      console.log(`  - ${l.row.file_name} (${l.row.size_bytes} o) sop=${l.meta?.sopInstanceUid}`)
    }
    return
  }

  // 3) Sauvegarde des lignes supprimées (réversibilité documentaire).
  if (losers.length > 0) {
    const dir = resolve(process.cwd(), '.dicom-dedupe-backups')
    mkdirSync(dir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = resolve(dir, `${patientId}_${stamp}.json`)
    writeFileSync(
      backupPath,
      JSON.stringify(
        losers.map((l) => ({ ...l.row, computed: l.meta })),
        null,
        2,
      ),
    )
    console.log(`Sauvegarde des doublons -> ${backupPath}`)

    // 4) Suppression Storage puis lignes DB.
    await chunkedRemove(supabase, losers.map((l) => l.row.file_path))
    for (let i = 0; i < losers.length; i += 200) {
      const ids = losers.slice(i, i + 200).map((l) => l.row.id)
      const { error: delErr } = await supabase.from('patient_documents').delete().in('id', ids)
      if (delErr) console.error('  ! échec suppression lignes lot', i, delErr.message)
    }
    console.log('Doublons supprimés (Storage + DB).')
  }

  // 5) Renseigne les métadonnées sur les lignes conservées.
  let updated = 0
  for (const { row, meta } of keepers) {
    if (!meta) continue
    const { error: upErr } = await supabase
      .from('patient_documents')
      .update({
        sop_instance_uid: meta.sopInstanceUid,
        series_instance_uid: meta.seriesInstanceUid,
        series_description: meta.seriesDescription,
        body_part: meta.bodyPart,
        instance_number: meta.instanceNumber,
        acquisition_datetime: meta.acquisitionDatetime,
      })
      .eq('id', row.id)
    if (upErr) console.error(`  ! update ${row.id}: ${upErr.message}`)
    else updated++
  }
  console.log(`Métadonnées renseignées sur ${updated} lignes.`)
  console.log('\nTerminé.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
