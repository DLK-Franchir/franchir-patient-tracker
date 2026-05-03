import { NextResponse } from 'next/server'
import { Logger } from '@/lib/logger'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type RouteContext<TParams = Record<string, string>> = {
  params: Promise<TParams>
}

export function apiError(status: number, message: string): never {
  throw new ApiError(status, message)
}

export function createRouteHandler<TArgs extends unknown[]>(
  name: string,
  handler: (...args: TArgs) => Promise<Response>
): (...args: TArgs) => Promise<Response> {
  const log = new Logger(name)

  return async (...args: TArgs) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }

      log.error('Unhandled API error', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }
}
