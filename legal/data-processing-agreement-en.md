# Data Processing Agreement (DPA)

**Version:** v1.0 · May 2, 2026

This Data Processing Agreement ("DPA") forms part of the [Terms of Service](/legal/terms) between the B2B customer ("Customer", acting as **Controller** under GDPR / **Responsable** under LFPDPPP) and MARCALL ("Processor" / **Encargado**).

> **Important note:** This document is a standard contractual framework. For high-volume processing, sensitive data, or cases subject to special regimes (HIPAA, financial-sector data), please request a **negotiated version** by writing to **legal@careofaddress.com**.

## 1. Subject matter and scope

MARCALL processes personal data on behalf of the Customer when operating the AI virtual receptionist service. The **personal data processed** includes, depending on the nature of each call:
- Caller's phone number (always)
- Call audio and transcript (during the retention period configured by the Customer)
- Identity data declared by the caller (name, email, date of birth, address, etc., as applicable)
- Metadata: time, duration, agent ID, outcome, transfer

## 2. Roles and responsibilities

- **Customer (Controller):** determines the purposes and means of processing, configures assistant flows, obtains the necessary caller consents, and responds to data-subject rights requests.
- **MARCALL (Processor):** processes the data only under documented instructions from the Customer (which include these terms and dashboard configuration), implements technical and organizational measures, assists the Customer with its obligations, and reports incidents.

MARCALL **does not use** the Customer's personal data to train its own AI models or third-party models, unless the Customer expressly authorizes it in writing.

## 3. Sub-processors

The Customer authorizes MARCALL to engage the sub-processors listed in **§7.1 of the [Privacy Notice](/legal/privacy)** (Vapi AI, ElevenLabs, Deepgram, Twilio, Resend, Stripe, Supabase, Sentry, etc.). MARCALL:
- Maintains the list updated and notifies at least **30 days in advance** of new sub-processors.
- Contractually binds each sub-processor with obligations equivalent to those of this DPA.
- Is responsible to the Customer for the actions or omissions of its sub-processors.

The Customer may object to the addition of a new sub-processor within 14 days. If the objection cannot reasonably be resolved, the Customer may terminate the service without penalty.

## 4. International transfers

Some sub-processors are located outside Mexico (primarily the United States and the European Union). Transfers are based on:
- **Mexico (LFPDPPP):** data-subject consent reflected in the Privacy Notice and/or Standard Contractual Clauses (CCT Module 2).
- **EU/EEA (GDPR):** European Commission Standard Contractual Clauses (Module 2 — controller to processor).
- **United States:** sub-processors certified under the Data Privacy Framework where applicable.

## 5. Security measures

MARCALL implements, without limitation:
- Encryption in transit (TLS 1.2+) and at rest (AES-256 for sensitive data such as TOTP secrets, OAuth tokens, CLABE numbers).
- Authentication with strong password policies (bcrypt, 12-character minimum) and optional MFA for customers.
- Tenant isolation in the database.
- Audit logs with hash chaining (`audit_logs`) to detect tampering.
- Periodic penetration testing and security code reviews.
- Continuity: daily backups with 30-day retention.

Detailed measures are maintained in the [Trust Center](/security).

## 6. Incident notification

MARCALL will notify the Customer without undue delay and no later than **48 hours** after confirmed knowledge of a personal-data breach affecting the Customer's data. The notification will include: nature of the incident, affected data and records, measures taken, and contact person.

## 7. Data-subject rights

MARCALL will assist the Customer in responding to data-subject requests (Access, Rectification, Cancellation, Opposition, Portability), providing structured data export and deletion mechanisms.

## 8. Audit

The Customer may request, once a year and with 30 days' notice, reasonable evidence of compliance with this DPA: certifications (when applicable), audit reports, security policy. MARCALL is not obligated to allow on-site audits unless required by a competent authority.

## 9. Data return and deletion

Upon service termination, MARCALL will delete or return (at the Customer's choice) the personal data processed, within **30 days** of termination, unless legislation requires retention. Backups are purged in the normal cycle (maximum 90 days).

## 10. Limitation of liability

Liability under this DPA is subject to the limits of the [Terms of Service](/legal/terms).

## 11. Modifications

MARCALL may update this DPA for legal, regulatory, or security reasons. Versions are published at this URL with an effective date. Material changes are notified 30 days in advance.

## 12. Governing law and jurisdiction

This DPA is governed by the laws of Mexico. The competent courts are those of the State of Nuevo León, except that if the Customer is established in the EU/EEA, GDPR also applies and the courts of the Customer's Member State for GDPR purposes.

---

**To sign a sealed version of this DPA**, write to **legal@careofaddress.com** indicating the Customer's legal entity name and contracted plan.
