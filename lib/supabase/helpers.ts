import { createClient } from './client'
import { Logger } from '../logger'
import type { Database } from '../types/database'

const logger = new Logger('SupabaseHelpers')

export interface QueryOptions {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, any>
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export async function fetchWithPagination<T>(
  table: keyof Database,
  options: QueryOptions = {}
): Promise<PaginatedResponse<T>> {
  const {
    page = 1,
    pageSize = 10,
    sortBy = 'created_at',
    sortOrder = 'desc',
    filters = {},
  } = options

  const supabase = createClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  try {
    let query = supabase.from(table as string).select('*', { count: 'exact' })

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value)
      }
    })

    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      logger.error('Error fetching paginated data', { table, error })
      throw error
    }

    return {
      data: (data || []) as T[],
      count: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }
  } catch (error) {
    logger.error('Unexpected error in fetchWithPagination', { table, error })
    throw error
  }
}

export async function fetchById<T>(
  table: keyof Database,
  id: string
): Promise<T | null> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from(table as string)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('Error fetching by ID', { table, id, error })
      throw error
    }

    return data as T
  } catch (error) {
    logger.error('Unexpected error in fetchById', { table, id, error })
    throw error
  }
}

export async function insertRecord<T>(
  table: keyof Database,
  record: Partial<T>
): Promise<T> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from(table as string)
      .insert(record)
      .select()
      .single()

    if (error) {
      logger.error('Error inserting record', { table, error })
      throw error
    }

    return data as T
  } catch (error) {
    logger.error('Unexpected error in insertRecord', { table, error })
    throw error
  }
}

export async function updateRecord<T>(
  table: keyof Database,
  id: string,
  updates: Partial<T>
): Promise<T> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from(table as string)
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Error updating record', { table, id, error })
      throw error
    }

    return data as T
  } catch (error) {
    logger.error('Unexpected error in updateRecord', { table, id, error })
    throw error
  }
}

export async function deleteRecord(
  table: keyof Database,
  id: string
): Promise<void> {
  const supabase = createClient()

  try {
    const { error } = await supabase
      .from(table as string)
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('Error deleting record', { table, id, error })
      throw error
    }
  } catch (error) {
    logger.error('Unexpected error in deleteRecord', { table, id, error })
    throw error
  }
}

export async function searchRecords<T>(
  table: keyof Database,
  column: string,
  searchTerm: string,
  options: QueryOptions = {}
): Promise<T[]> {
  const supabase = createClient()
  const { sortBy = 'created_at', sortOrder = 'desc' } = options

  try {
    const { data, error } = await supabase
      .from(table as string)
      .select('*')
      .ilike(column, `%${searchTerm}%`)
      .order(sortBy, { ascending: sortOrder === 'asc' })

    if (error) {
      logger.error('Error searching records', { table, column, searchTerm, error })
      throw error
    }

    return (data || []) as T[]
  } catch (error) {
    logger.error('Unexpected error in searchRecords', { table, column, searchTerm, error })
    throw error
  }
}

export async function countRecords(
  table: keyof Database,
  filters: Record<string, any> = {}
): Promise<number> {
  const supabase = createClient()

  try {
    let query = supabase.from(table as string).select('*', { count: 'exact', head: true })

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value)
      }
    })

    const { count, error } = await query

    if (error) {
      logger.error('Error counting records', { table, error })
      throw error
    }

    return count || 0
  } catch (error) {
    logger.error('Unexpected error in countRecords', { table, error })
    throw error
  }
}

export async function batchInsert<T>(
  table: keyof Database,
  records: Partial<T>[]
): Promise<T[]> {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from(table as string)
      .insert(records)
      .select()

    if (error) {
      logger.error('Error batch inserting records', { table, error })
      throw error
    }

    return (data || []) as T[]
  } catch (error) {
    logger.error('Unexpected error in batchInsert', { table, error })
    throw error
  }
}

export async function batchUpdate<T>(
  table: keyof Database,
  updates: Array<{ id: string; data: Partial<T> }>
): Promise<T[]> {
  const supabase = createClient()
  const results: T[] = []

  try {
    for (const update of updates) {
      const { data, error } = await supabase
        .from(table as string)
        .update(update.data)
        .eq('id', update.id)
        .select()
        .single()

      if (error) {
        logger.error('Error in batch update', { table, id: update.id, error })
        throw error
      }

      if (data) {
        results.push(data as T)
      }
    }

    return results
  } catch (error) {
    logger.error('Unexpected error in batchUpdate', { table, error })
    throw error
  }
}
