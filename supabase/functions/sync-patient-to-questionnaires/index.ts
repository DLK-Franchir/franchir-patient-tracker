// Edge Function du projet TRACKER (zdmeidekszdrzmjuasee).
// Déclenchée par un Database Webhook sur INSERT/UPDATE de `public.patients`,
// pousse le dossier vers l'app questionnaires (upsert idempotent).
//
// Secrets requis (Project Settings → Edge Functions → Secrets) :
//   - QUESTIONNAIRES_BRIDGE_URL : URL du récepteur questionnaires
//   - TRACKER_SYNC_SERVICE_TOKEN : jeton partagé (même valeur que côté questionnaires)
//
// Adapté au schéma réel du tracker :
//   patients(id, patient_name, clinical_summary, sharepoint_link,
//            current_status_id, assigned_surgeon_id)
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

  // Chirurgien obligatoire côté questionnaires : on saute tant qu'il
  // n'est pas assigné (le dossier partira au premier UPDATE d'assignation).
  if (!record.assigned_surgeon_id) {
    return new Response(null, { status: 204 });
  }

  const [{ data: surgeon }, { data: status }] = await Promise.all([
    supabase
      .from("surgeons")
      .select("full_name, email")
      .eq("id", record.assigned_surgeon_id)
      .single(),
    record.current_status_id
      ? supabase
          .from("workflow_statuses")
          .select("code")
          .eq("id", record.current_status_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  if (!surgeon?.email) {
    console.error("Surgeon without email, skipping sync", record.id);
    return new Response(null, { status: 204 });
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
      assignedSurgeonEmail: surgeon.email,
      assignedSurgeonName: surgeon.full_name ?? null,
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
