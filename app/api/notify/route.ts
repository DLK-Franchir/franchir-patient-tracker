import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { EMAIL_FROM } from '@/lib/email-config'
import { isStaffEmail, isStaffProfile } from '@/lib/access-control'
import { createServerClient } from '@/lib/supabase/server'
import { apiError, createRouteHandler } from '@/lib/api/route-handler'

function getResend(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
}

export const POST = createRouteHandler('api/notify', async (request: NextRequest) => {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    apiError(401, 'Unauthorized')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, role')
    .eq('id', user.id)
    .single()

  if (!isStaffProfile(profile)) {
    apiError(403, 'Forbidden')
  }

  const { to, subject, html } = await request.json()

  if (!to || !subject || !html) {
    apiError(400, 'Missing required fields: to, subject, html')
  }

  if (!isStaffEmail(to)) {
    apiError(403, 'Forbidden')
  }

  const emailClient = getResend()
  if (!emailClient) {
    apiError(503, 'Email service disabled')
  }

  const { data, error } = await emailClient.emails.send({
    from: EMAIL_FROM,
    to,
    subject,
    html,
  })

  if (error) {
    apiError(500, error.message)
  }

  return NextResponse.json({ success: true, data })
})
