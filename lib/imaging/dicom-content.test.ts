import { describe, expect, it } from 'vitest'
import {
  extractDicomPersistedMetadata,
  normalizeAcquisitionDateTime,
  parseDicomContentInfo,
} from '@/lib/imaging/dicom-content'

function appendExplicitTag(
  chunks: number[],
  group: number,
  element: number,
  vr: string,
  value: string,
): void {
  chunks.push(group & 0xff, (group >> 8) & 0xff)
  chunks.push(element & 0xff, (element >> 8) & 0xff)
  chunks.push(vr.charCodeAt(0)!, vr.charCodeAt(1)!)
  const valueBytes = new TextEncoder().encode(value)
  let len = valueBytes.length
  if (len % 2 !== 0) len += 1
  chunks.push(len & 0xff, (len >> 8) & 0xff)
  for (const b of valueBytes) chunks.push(b)
  if (valueBytes.length % 2 !== 0) chunks.push(0)
}

type DicomTagSpec = {
  sopInstanceUid?: string
  seriesInstanceUid?: string
  seriesDescription?: string
  bodyPart?: string
  protocolName?: string
  instanceNumber?: string
  modality?: string
  acquisitionDateTime?: string
  acquisitionDate?: string
  acquisitionTime?: string
  seriesDate?: string
  studyDate?: string
}

function buildDicom(spec: DicomTagSpec): Uint8Array {
  const chunks: number[] = new Array(128).fill(0)
  chunks.push(0x44, 0x49, 0x43, 0x4d)
  appendExplicitTag(chunks, 0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1')
  if (spec.sopInstanceUid) appendExplicitTag(chunks, 0x0008, 0x0018, 'UI', spec.sopInstanceUid)
  if (spec.studyDate) appendExplicitTag(chunks, 0x0008, 0x0020, 'DA', spec.studyDate)
  if (spec.seriesDate) appendExplicitTag(chunks, 0x0008, 0x0021, 'DA', spec.seriesDate)
  if (spec.acquisitionDate) appendExplicitTag(chunks, 0x0008, 0x0022, 'DA', spec.acquisitionDate)
  if (spec.acquisitionDateTime) appendExplicitTag(chunks, 0x0008, 0x002a, 'DT', spec.acquisitionDateTime)
  if (spec.acquisitionTime) appendExplicitTag(chunks, 0x0008, 0x0032, 'TM', spec.acquisitionTime)
  if (spec.modality) appendExplicitTag(chunks, 0x0008, 0x0060, 'CS', spec.modality)
  if (spec.seriesDescription) appendExplicitTag(chunks, 0x0008, 0x103e, 'LO', spec.seriesDescription)
  if (spec.bodyPart) appendExplicitTag(chunks, 0x0018, 0x0015, 'CS', spec.bodyPart)
  if (spec.protocolName) appendExplicitTag(chunks, 0x0018, 0x1030, 'LO', spec.protocolName)
  if (spec.seriesInstanceUid) appendExplicitTag(chunks, 0x0020, 0x000e, 'UI', spec.seriesInstanceUid)
  if (spec.instanceNumber) appendExplicitTag(chunks, 0x0020, 0x0013, 'IS', spec.instanceNumber)
  return new Uint8Array(chunks)
}

describe('parseDicomContentInfo — tags étendus', () => {
  it('extrait SOP/Series/Description/BodyPart/Instance', () => {
    const bytes = buildDicom({
      sopInstanceUid: '1.2.3.4.5.6.7',
      seriesInstanceUid: '1.2.3.4.5',
      seriesDescription: 'T2 SAG CERVICAL',
      bodyPart: 'CSPINE',
      protocolName: 'SPINE PROTO',
      instanceNumber: '7',
      modality: 'MR',
    })
    const info = parseDicomContentInfo(bytes)
    expect(info?.sopInstanceUid).toBe('1.2.3.4.5.6.7')
    expect(info?.seriesInstanceUid).toBe('1.2.3.4.5')
    expect(info?.seriesDescription).toBe('T2 SAG CERVICAL')
    expect(info?.bodyPart).toBe('CSPINE')
    expect(info?.protocolName).toBe('SPINE PROTO')
    expect(info?.instanceNumber).toBe(7)
    expect(info?.modality).toBe('MR')
  })

  it('extractDicomPersistedMetadata normalise acquisition_datetime', () => {
    const bytes = buildDicom({
      sopInstanceUid: '9.9.9',
      seriesInstanceUid: '1.1.1',
      instanceNumber: '12',
      acquisitionDate: '20230115',
      acquisitionTime: '103000',
    })
    const meta = extractDicomPersistedMetadata(bytes)
    expect(meta).not.toBeNull()
    expect(meta?.sopInstanceUid).toBe('9.9.9')
    expect(meta?.seriesInstanceUid).toBe('1.1.1')
    expect(meta?.instanceNumber).toBe(12)
    expect(meta?.acquisitionDatetime).toBe('20230115103000')
  })

  it('renvoie null pour des octets non-DICOM', () => {
    expect(extractDicomPersistedMetadata(new Uint8Array([1, 2, 3, 4]))).toBeNull()
  })
})

describe('normalizeAcquisitionDateTime', () => {
  const base = {
    acquisitionDateTime: null,
    acquisitionDate: null,
    acquisitionTime: null,
    seriesDate: null,
    studyDate: null,
  }

  it('priorise AcquisitionDateTime (tronqué à 14 chiffres)', () => {
    expect(
      normalizeAcquisitionDateTime({ ...base, acquisitionDateTime: '20230115103000.500000' }),
    ).toBe('20230115103000')
  })

  it('combine date + heure quand DT absent', () => {
    expect(
      normalizeAcquisitionDateTime({ ...base, acquisitionDate: '20230115', acquisitionTime: '1030' }),
    ).toBe('20230115103000')
  })

  it('retombe sur SeriesDate puis StudyDate', () => {
    expect(normalizeAcquisitionDateTime({ ...base, seriesDate: '20220203' })).toBe('20220203000000')
    expect(normalizeAcquisitionDateTime({ ...base, studyDate: '20210405' })).toBe('20210405000000')
  })

  it('renvoie null sans date exploitable', () => {
    expect(normalizeAcquisitionDateTime(base)).toBeNull()
  })
})
