const BASE_STYLE = 'font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'
const HEADING_STYLE = 'color: #2563EB;'
const BUTTON_STYLE = 'display: inline-block; background-color: #2563EB; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;'
const FOOTER_STYLE = 'color: #6B7280; font-size: 12px; margin-top: 24px;'
const QUOTE_STYLE = 'border-left: 4px solid #2563EB; padding-left: 16px; margin: 16px 0; color: #374151;'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function emailWrapper(recipientName: string, heading: string, body: string, link: string): string {
  return `
    <div style="${BASE_STYLE}">
      <h2 style="${HEADING_STYLE}">${escapeHtml(heading)}</h2>
      <p>Bonjour ${escapeHtml(recipientName)},</p>
      ${body}
      <a href="${escapeHtml(link)}" style="${BUTTON_STYLE}">Voir le dossier</a>
      <p style="${FOOTER_STYLE}">FRANCHIR — Suivi des dossiers patients</p>
    </div>
  `
}

export function newPatientEmailHtml(recipientName: string, actorName: string, patientName: string, link: string): string {
  const body = `<p><strong>${escapeHtml(actorName)}</strong> vient de créer le dossier de <strong>${escapeHtml(patientName)}</strong>.</p>`
  return emailWrapper(recipientName, 'Nouveau dossier patient', body, link)
}

export function newMessageEmailHtml(recipientName: string, actorName: string, patientName: string, message: string, link: string): string {
  const body = `
    <p><strong>${escapeHtml(actorName)}</strong> a posté un nouveau message concernant le dossier de <strong>${escapeHtml(patientName)}</strong> :</p>
    <blockquote style="${QUOTE_STYLE}">${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>
  `
  return emailWrapper(recipientName, 'Nouveau message sur le dossier', body, link)
}

export function statusChangeEmailHtml(recipientName: string, statusMessage: string, link: string): string {
  const body = `<p>${escapeHtml(statusMessage)}</p>`
  return emailWrapper(recipientName, 'Mise à jour du dossier patient', body, link)
}
