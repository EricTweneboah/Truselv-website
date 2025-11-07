# TruSelv Alignment with Healthcare Standards & Human-Centred Care

TruSelv’s ecosystem — **Bedbord**, **Folda**, **Ngage**, and **Teevy** — is designed to pair rigorous compliance with the warmth people expect from bedside experiences. This note summarises how our platform aligns with Care Quality Commission (CQC) expectations, NHS Digital frameworks, and broader international health goals while keeping patients and staff at the heart of every interaction.

---

## 1. Care Quality Commission (CQC) Pillars

| CQC Key Question | TruSelv Focus | Example Touchpoints |
| --- | --- | --- |
| **Safe** | Device hardening, RBAC, active alerting | Bedbord clinician panels highlight escalations; Folda tracks handover tasks and outstanding risks |
| **Effective** | Evidence-based pathways, analytics | Teevy surfaces tailored education based on diagnosis and care plan; Ngage integrates with EHR vitals to close the loop |
| **Caring** | Personalised, dignified interactions | Bedbord shows preferred names, pronouns, and comfort preferences; Teevy uses plain-language microcopy |
| **Responsive** | Real-time updates, configurable flows | Folda dashboards adapt to ward type; alerts reroute based on staffing levels |
| **Well-led** | Governance, continuous improvement | Audit-ready logs, change control, and configurable KPIs for ward managers |

**How we operationalise the standards**

- **Human factors reviews:** Every Bedbord and Folda release is checked against NHS Improvement/CQC human factors guidance to reduce cognitive load.
- **Resident & family access:** Visitor-friendly modes in Teevy and Ngage help families participate in care decisions, reinforcing “caring” and “responsive” criteria.

---

## 2. NHS Digital & UK Health Security Objectives

| Theme | Alignment |
| --- | --- |
| **DSPT & Cyber Essentials** | Encrypted data in transit (TLS 1.2+), MFA for admin portals, structured patch cadence. |
| **Interoperability** | FHIR-first APIs, HL7 listeners, and secure messaging to NHS Spine-compatible systems. |
| **Clinical Safety (DCB 0129/0160)** | Named Clinical Safety Officer, hazard logs, and regular safety case updates covering Bedbord and Folda workflows. |
| **Data minimisation & privacy** | Default-on field-level encryption, consent capture in Teevy before sharing educational progress, and configurable retention rules. |

**Product call-outs**

- **Bedbord**: Role-based views derived from NHS Smartcard profiles ensure only the right staff see sensitive data bedside.
- **Folda**: Digitises handovers with mandatory structured observations, auto-syncing back to PAS/EPR with full audit trails.
- **Ngage**: (If deployed) offers secure staff collaboration spaces separate from patient devices, preventing shadow IT reliance.
- **Teevy**: Tracks patient-facing education modules and feeds completion data back to the clinical team for better discharge planning.

---

## 3. International Health Goals & Vision

| Framework | TruSelv Contribution |
| --- | --- |
| **WHO People-Centred Care** | Teevy narrates care plans in native languages and accessible formats; Bedbord lets patients set goals and mood updates that staff can review at a glance. |
| **UN SDG 3 (Good Health & Well-being)** | Real-time satisfaction feedback loops reduce complications tied to communication breakdowns; Ngage’s analytics uncover population trends. |
| **OECD recommendations on digital health** | Standards-based interoperability and transparent governance models accelerate cross-border learnings. |

**Human Experience Highlights**

1. **Warm, contextual UI:** Colour palettes and typography in Teevy and Bedbord were co-designed with dementia and neurodiverse communities to remain calming yet clear.
2. **Story-driven education:** Teevy modules use storytelling techniques validated through patient advisory groups to boost comprehension without overwhelming users.
3. **Shared decision making:** Bedbord’s “What matters today?” prompts ensure clinicians capture daily goals; Folda surfaces those prompts during handover.

---

## 4. Continuous Improvement & Evidence

- **Experience-Based Co-Design (EBCD):** TruSelv runs co-design sprints each quarter with staff and families to validate new Folda and Teevy experiences.
- **Clinical safety cycle:** Hazard audits conducted every release by the Clinical Safety Officer feed into central risk registers shared with partners.
- **Impact measurement:** Ngage dashboards highlight response times, education completion, and comfort metrics so leadership teams can evidence improvements to regulators.

---

## 5. Next Steps for Partners

1. **Schedule a governance workshop** to map CQC and NHS Digital requirements against your current workflows.
2. **Pilot Bedbord + Folda** on a single ward to capture qualitative and quantitative evidence ahead of scale.
3. **Activate Teevy content localisation** to align with population language needs and WHO accessibility recommendations.

For bespoke documentation (DPIAs, clinical safety cases, or board-ready packs), contact **support@truselv.co.uk**.

---

## References

1. NHS England. *Patient Experience Framework.* 2013.  
   https://www.england.nhs.uk/wp-content/uploads/2013/08/patient-exp-fram.pdf

2. The King’s Fund. *Experience-based co-design: a toolkit for improving patient experience.* 2013.  
   https://www.kingsfund.org.uk/sites/default/files/field/field_publication_file/experience-based-co-design-evidence-review-5-mar-2013.pdf

3. World Health Organization. *People-centred and integrated health services: an overview of the evidence.* 2015.  
   https://apps.who.int/iris/bitstream/handle/10665/155004/WHO_HIS_SDS_2015.7_eng.pdf

4. World Health Organization. *Framework on integrated, people-centred health services.* 2016.  
   https://apps.who.int/iris/bitstream/handle/10665/180984/WHO_HIS_SDS_2015.16_eng.pdf

5. UK Department of Health & Social Care. *Data Security and Protection Toolkit Guidance.* 2024.  
   https://www.dsptoolkit.nhs.uk/
