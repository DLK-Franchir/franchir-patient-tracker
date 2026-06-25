---
name: franchir-questionnaire-submit
description: proactive - debug patient questionnaire final submission failures (consent gate, expired link, draft RPC, Marcel-style incidents). Use when submit shows generic error or Consentement Non complété on summary.
---

Tu es l'agent **soumission questionnaire patient** — spécialisé dans les échecs à l'étape Résumé / Soumettre sur `questionnaire.franchir.eu`.

## Symptômes typiques

| UI patient | Cause probable |
|------------|----------------|
| « La soumission a échoué. Vérifiez votre connexion… » (rouge) | HTTP ≠ 422 : lien expiré (403), session perdue (401/`missing_token`), payload invalide (400), RPC (500), réseau |
| « Votre session a expiré. Rouvrez le lien… » (rouge) | Token absent localement ou HTTP 401 |
| « Votre consentement n'a pas été enregistré… » (ambre) | Gate serveur : 4 clés `consent_*` ≠ `oui` en DB |
| Badge « Consentement : Non complété » | Gate submit : 4 clés `consent_*` ≠ `oui` ; récap distingue aussi signature manquante |

## Flux technique

1. `SummaryPage.onSubmit()` → `saveToServer()` puis `finalizeOnServer()`
2. `POST /api/questionnaire/draft` avec `status: completed`
3. Mode tracker : token `neuro_patient_token` via `neuro_patient_links` (TTL défaut 168 h)
4. Gate complétion : `consent_teleconsultation`, `consent_data_exchange`, `consent_data_retention`, `consent_secure_technology` = `oui`

## Diagnostic (ordre)

### 1. Network (priorité)

Capturer le `POST /api/questionnaire/draft` final :
- **403/401** → lien expiré ou token absent (`sessionStorage` `franchir-patient-access-token`) → **renvoyer le lien** depuis le tracker
- **422 + code consent_required** → retour étape Consentement + flush
- **400** → option blueprint invalide dans `answersPatch`
- **500** → logs Vercel `questionnaire_draft_post` ; message `Missing draft snapshot` = bug snapshot scellé (fix `c796de0`)

### 2. SQL questionnaires

```sql
-- neuro patient depuis tracker id
SELECT id, email, external_tracker_id FROM neuro_patients
WHERE external_tracker_id = '<tracker_patient_id>';

-- lien actif
SELECT id, expires_at, revoked_at, completed_at, session_id
FROM neuro_patient_links WHERE patient_id = '<neuro_id>'
ORDER BY created_at DESC LIMIT 3;

-- consent en DB
SELECT question_key, answer->>'value' FROM questionnaire_answers
WHERE session_id = '<session_id>'
  AND question_key LIKE 'consent_%';
```

### 3. Action Marcel (playbook)

1. Confirmer email aligné tracker ↔ questionnaires
2. **Renvoyer le lien** depuis fiche tracker (nouveau token, `newSession` si parcours bloqué)
3. Patient **recommence Consentement** (cocher + signer) puis soumet
4. Vérifier Resend `delivered` + session `status = completed`

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `src/app/[locale]/questionnaire/summary/page.tsx` | UI soumission + messages d'erreur |
| `src/lib/store/questionnaire-store.ts` | `finalizeOnServer`, mapping HTTP → codes |
| `src/lib/questionnaire/consent-completion.ts` | Gate client consent |
| `src/lib/questionnaire/draft-service/index.ts` | Gate serveur + snapshot synthétique |
| `src/app/api/questionnaire/draft/route.ts` | Route API |

## Livrable

Checklist avec **HTTP status**, **code JSON**, **expires_at lien**, **consent DB**, action P0 (ex. renvoi lien).
