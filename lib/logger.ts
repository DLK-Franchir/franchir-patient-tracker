type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogContext {
  user_id?: string
  role?: string
  patient_id?: string
  [key: string]: unknown
}

export const SENSITIVE_FIELDS = [
  'patient_name',
  'clinical_summary',
  'sharepoint_link',
  'email',
  'message',
] as const

const MASKED_VALUE = '[REDACTED]'
const SENSITIVE_FIELD_SET = new Set<string>(SENSITIVE_FIELDS)

export class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private prefix?: string
  private baseContext: LogContext

  constructor(prefix?: string, baseContext: LogContext = {}) {
    this.prefix = prefix
    this.baseContext = baseContext
  }

  withContext(context: LogContext): Logger {
    return new Logger(this.prefix, { ...this.baseContext, ...context })
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const mergedContext = this.mergeContext(context)
    const contextStr = mergedContext ? ` ${JSON.stringify(mergedContext)}` : ''
    const prefix = this.prefix ? `[${this.prefix}] ` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${prefix}${message}${contextStr}`
  }

  private mergeContext(context?: LogContext): LogContext | undefined {
    const hasBaseContext = Object.keys(this.baseContext).length > 0
    const hasContext = context && Object.keys(context).length > 0

    if (!hasBaseContext && !hasContext) {
      return undefined
    }

    return this.maskSensitiveFields({ ...this.baseContext, ...(context ?? {}) }) as LogContext
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private isErrorLikeObject(value: unknown): value is Record<string, unknown> {
    if (!this.isObject(value)) {
      return false
    }

    const hasMessage = typeof value.message === 'string'
    const hasErrorSignal =
      typeof value.code === 'string' ||
      typeof value.details === 'string' ||
      typeof value.hint === 'string' ||
      typeof value.stack === 'string' ||
      typeof value.name === 'string'

    return hasMessage && hasErrorSignal
  }

  private maskSensitiveFields(value: unknown, key?: string): unknown {
    if (key && SENSITIVE_FIELD_SET.has(key.toLowerCase())) {
      return MASKED_VALUE
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      }
    }

    if (Array.isArray(value)) {
      return value.map(item => this.maskSensitiveFields(item))
    }

    if (this.isObject(value)) {
      if (value instanceof Date) {
        return value.toISOString()
      }

      const output: Record<string, unknown> = {}
      for (const [childKey, childValue] of Object.entries(value)) {
        output[childKey] = this.maskSensitiveFields(childValue, childKey)
      }
      return output
    }

    return value
  }

  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, errorOrContext?: Error | unknown | LogContext, context?: LogContext): void {
    let resolvedContext: LogContext | undefined = context ? { ...context } : undefined

    if (errorOrContext !== undefined) {
      if (errorOrContext instanceof Error || this.isErrorLikeObject(errorOrContext)) {
        resolvedContext = { ...(resolvedContext ?? {}), error: errorOrContext }
      } else if (this.isObject(errorOrContext) && context === undefined) {
        resolvedContext = { ...(resolvedContext ?? {}), ...errorOrContext }
      } else {
        resolvedContext = { ...(resolvedContext ?? {}), error: errorOrContext }
      }
    }

    console.error(this.formatMessage('error', message, resolvedContext))
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatMessage('debug', message, context))
    }
  }
}

export const logger = new Logger()
