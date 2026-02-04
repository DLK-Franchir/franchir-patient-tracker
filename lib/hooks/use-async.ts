import { useState, useEffect } from 'react'

interface UseAsyncOptions<T> {
  immediate?: boolean
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

interface UseAsyncReturn<T> {
  data: T | null
  loading: boolean
  error: Error | null
  execute: () => Promise<void>
  reset: () => void
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T> {
  const { immediate = false, onSuccess, onError } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(immediate)
  const [error, setError] = useState<Error | null>(null)

  const execute = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await asyncFunction()
      setData(result)
      onSuccess?.(result)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Une erreur est survenue')
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setData(null)
    setLoading(false)
    setError(null)
  }

  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [])

  return { data, loading, error, execute, reset }
}
