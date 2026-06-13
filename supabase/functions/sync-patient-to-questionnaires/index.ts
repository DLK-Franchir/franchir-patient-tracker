// Edge Function du projet TRACKER (zdmeidekszdrzmjuasee).
// Déclenchée par un Database Webhook sur INSERT/UPDATE de `public.patients`,
// pousse le dossier vers l'app questionnaires (upsert idempotent).
//
// Secrets requis (Project Settings → Edge Functions → Secrets) :
//   - QUESTIONNAIRES_BRIDGE_URL : URL du récepteur questionnaires
//   - TRACKER_SYNC_SERVICE_TOKEN : jeton partagé (même valeur que côté questionnaires)
//
// WORKFLOW RÉVISÉ (revue médicale d'abord, chirurgien plus tard) :
//   - sync DÈS la création (INSERT), sans attendre un chirurgien ;
//   - le chirurgien n'est joint QUE s'il existe (assigned_surgeon_id) → à
//     l'UPDATE d'assignation, surgeon_email est enrichi côté questionnaires ;
//   - l'email patient réel (patient_email, D1) est transmis pour l'envoi du
//     lien de questionnaire.
//
// Schéma tracker utilisé :
//   patients(id, patient_name, patient_email, clinical_summary,
//            sharepoint_link, current_status_id, assigned_surgeon_id)
//   surgeons(id, full_name, email)
//   workflow_statuses(id, code)
import { createClient } from "jsr:@supabase/supabase-js@2";

const BRIDGE_URL = Deno.env.get("QUESTIONNAIRES_BRIDGE_URL")!;
const BRIDGE_TOKEN = Deno.env.get("TRACKER_SYNC_SERVICE_TOKEN")!;

// Client service-role LOCAL au tracker : joint l'annuaire chirurgiens
// et le référentiel de statuts (le webhook ne livre que la ligne brute).
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const { record } = await req.json(); // payload Database Webhook (INSERT/UPDATE)
  if (!record?.id) {
    return new Response("Bad webhook payload", { status: 400 });
  }

  // Le chirurgien est OPTIONNEL : on ne le joint que s'il est assigné. Un
  // dossier sans chirurgien est créé en revue médicale côté questionnaires.
  let surgeonEmail: string | null = null;
  let surgeonName: string | null = null;

  const [surgeonResult, statusResult] = await Promise.all([
    record.assigned_surgeon_id
      ? supabase
          .from("surgeons")
          .select("full_name, email")
          .eq("id", record.assigned_surgeon_id)
          .single()
      : Promise.resolve({ data: null }),
    record.current_status_id
      ? supabase
          .from("workflow_statuses")
          .select("code")
          .eq("id", record.current_status_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const surgeon = surgeonResult.data as { full_name: string | null; email: string | null } | null;
  const status = statusResult.data as { code: string } | null;

  if (record.assigned_surgeon_id && !surgeon?.email) {
    // Chirurgien assigné mais sans email en annuaire : on logue et on
    // synchronise quand même le dossier (sans surgeon_email) — l'enrichissement
    // partira une fois l'email chirurgien renseigné dans l'annuaire.
    console.error("Assigned surgeon without email, syncing without enrichment", record.id);
  } else if (surgeon?.email) {
    surgeonEmail = surgeon.email;
    surgeonName = surgeon.full_name ?? null;
  }

  const response = await fetch(BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BRIDGE_TOKEN}`,
    },
    body: JSON.stringify({
      trackerPatientId: record.id,
      patientName: record.patient_name,
      patientEmail: record.patient_email ?? null,
      // null tant qu'aucun chirurgien n'est assigné (revue médicale) ; posé à
      // l'enrichissement (étape 3).
      assignedSurgeonEmail: surgeonEmail,
      assignedSurgeonName: surgeonName,
      clinicalSummary: record.clinical_summary ?? null,
      sharepointLink: record.sharepoint_link ?? null,
      workflowStatus: status?.code ?? null,
    }),
  });

  if (response.status === 409) {
    // Réassignation chirurgien détectée côté questionnaires : NE PAS forcer
    // automatiquement. Logguer pour arbitrage humain, puis rejouer avec
    // overrideSurgeonAssignment: true si la réassignation est confirmée.
    console.error("Surgeon conflict", record.id, await response.text());
    return new Response("Surgeon conflict — manual arbitration", { status: 200 });
  }

  if (!response.ok) {
    // 5xx → le webhook Supabase réessaiera ; l'upsert est idempotent.
    console.error("Bridge sync failed", record.id, response.status);
    return new Response("Bridge sync failed", { status: 500 });
  }

  return new Response(null, { status: 204 });
});
