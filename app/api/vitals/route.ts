import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandler } from '@/lib/api/route-handler'
import { Logger } from '@/lib/logger'

const log = new Logger('api/vitals')

export const POST = createRouteHandler('api/vitals', async (request: NextRequest) => {
  const metric = await request.json()

  log.info('Web vital', {
    name: metric.name,
    value: Math.round(metric.value),
    rating: metric.rating,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ success: true })
})
