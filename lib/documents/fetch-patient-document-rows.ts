import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DOCUMENTS_LIST_PAGE_SIZE,
  MAX_DOCUMENTS_LISTED,
} from '@/lib/documents/patient-documents'

export type FetchPatientDocumentRowsOptions = {
  /** Colonnes PostgREST (chaîne `select`). */
  select: string
  /** Filtre optionnel `kind` (`dicom` pour l'export). */
  kind?: 'dicom' | 'document'
  /** Plafond total (défaut `MAX_DOCUMENTS_LISTED`). */
  limit?: number
  /** Taille de page ≤ `max_rows` PostgREST (défaut `DOCUMENTS_LIST_PAGE_SIZE`). */
  pageSize?: number
}

export type FetchPatientDocumentRowsResult<T> = {
  rows: T[]
  /** True si le plafond a été atteint (d'autres lignes peuvent exister). */
  truncated: boolean
}

/**
 * Lit `patient_documents` en pages pour contourner le plafond PostgREST
 * `max_rows` (1000). Ordre : plus récents d'abord, pour que le plafond
 * applicatif garde les uploads du jour.
 */
export async function fetchPatientDocumentRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  patientId: string,
  options: FetchPatientDocumentRowsOptions,
): Promise<FetchPatientDocumentRowsResult<T>> {
  const limit = options.limit ?? MAX_DOCUMENTS_LISTED
  const pageSize = Math.min(
    Math.max(1, options.pageSize ?? DOCUMENTS_LIST_PAGE_SIZE),
    DOCUMENTS_LIST_PAGE_SIZE,
  )

  const rows: T[] = []
  let offset = 0

  while (rows.length < limit) {
    const take = Math.min(pageSize, limit - rows.length)
    let query = supabase
      .from('patient_documents')
      .select(options.select)
      .eq('patient_id', patientId)

    if (options.kind) {
      query = query.eq('kind', options.kind)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + take - 1)
    if (error) {
      console.error('[patient-documents] paged list failed', error.message)
      throw new Error('Failed to list patient documents')
    }

    const page = (data ?? []) as unknown as T[]
    rows.push(...page)
    if (page.length < take) {
      break
    }
    offset += page.length
  }

  return {
    rows,
    truncated: rows.length >= limit,
  }
}
