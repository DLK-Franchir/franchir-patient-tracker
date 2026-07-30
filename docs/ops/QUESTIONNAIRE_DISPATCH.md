# Dispatch questionnaire staff (copier / mailto)

**Statut :** tracker prêt ; **PR jumelle questionnaires** requise pour `sendEmail: false` + retour `url`.

## Problème

L’envoi Resend auto (`questionnaire@franchir.eu`) arrive souvent en spam → peu de questionnaires complétés.

## Solution

1. Marcel choisit pathologie + langue.
2. **Préparer l’envoi** → pont émet le lien **sans** Resend.
3. Modale : objet + corps + lien → **Tout copier** / copier lien / `mailto:`.
4. **J’ai envoyé** → `questionnaire_status = sent`.

## Contrat pont (questionnaires)

`POST …/questionnaire-link`

| Champ body | Effet |
|------------|--------|
| `sendEmail: false` | N’appelle pas Resend ; **doit** renvoyer `url` |
| `sendEmail` absent / `true` | Legacy Resend (`emailSent`) |

Réponse staff :

```json
{
  "emailSent": false,
  "expiresAt": "…",
  "url": "https://questionnaire.franchir.eu/…",
  "emailDraft": { "subject": "…", "textBody": "…" }
}
```

`emailDraft` optionnel — le tracker a un fallback plain text (`lib/integrations/questionnaire-email-draft.ts`).

## Compatibilité

| Réponse Q | Comportement tracker |
|-----------|----------------------|
| `url` présent | Modale dispatch staff |
| pas de `url`, `emailSent: true` | Banner legacy Resend |
| ni `url` ni email | Erreur actionable |

## Sécurité

- URL révélée uniquement via API tracker auth (marcel / admin / franchir).
- Ne pas logger `url` / destinataire / corps (PHI).
- TTL / révocation inchangés.

## Création dossier

Plus d’émission auto à la création — préparer depuis la fiche patient.

## Preuve ops

Complétion patient (`opened` / `completed`) > `delivered` Resend.  
Ne pas renvoyer « pour tester » sur un dossier existant.
