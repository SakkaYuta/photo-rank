This folder contains copy templates for approval-based registrations.

Files
- `registrationForms.ts`: Form copy for approval-based applications.
  - `ManufacturingPartnerApplicationForm` (工場・印刷業者)
  - `OrganizerApplicationForm` (オーガナイザー)
  - Includes: title, intro, notice (2 weeks SLA), fields (labels/help), consent.

- `notificationEmails.ts`: Email templates for application lifecycle.
  - `buildAckEmail` (受付), `buildApprovalEmail` (承認), `buildDenialEmail` (否認)
  - Params allow applicant type, name, applicationId, support email, review days.

Usage examples (TypeScript)
```ts
import { ManufacturingPartnerApplicationForm, OrganizerApplicationForm } from '@/templates/registrationForms'
import { buildAckEmail, buildApprovalEmail, buildDenialEmail } from '@/templates/notificationEmails'

// Form rendering (React or other UI)
const form = ManufacturingPartnerApplicationForm
form.fields.forEach(f => /* render field f */)

// Emails
const ack = buildAckEmail({ type: 'manufacturing_partner', applicantName: 'Sample Inc.', applicationId: 'MP-2025-0001', supportEmail: 'support@yourdomain' })
await mailer.send({ to: 'applicant@example.com', subject: ack.subject, text: ack.text, html: ack.html })

const approved = buildApprovalEmail({ type: 'organizer', applicantName: 'ACME Org', applicationId: 'ORG-2025-0007', supportEmail: 'support@yourdomain' })
const denied = buildDenialEmail({ type: 'manufacturing_partner', applicantName: 'Foo Print', applicationId: 'MP-2025-0010', reasonNote: '要件に適合しないため' })
```

Notes
- All copy is JP by default. Adjust as needed per locale.
- The 2-week SLA is present in `notice` and ack email. Change `reviewDays` to customize.
- Denial emails avoid detailed rationale by default; pass `reasonNote` to override.

