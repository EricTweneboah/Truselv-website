# TESS activity analytics and CQC evidence

The Analytics & CQC evidence page uses participation sessions, feature events, and structured staff observations. It is supporting operational evidence, not a clinical record, automated wellbeing assessment, or guarantee of CQC compliance.

## Evidence captured

- Session date, ward, individual/group/anonymous type, and participating residents.
- TESS features opened during the active session.
- A required 1–5 engagement observation for every named participant (or one aggregate observation for an anonymous session).
- An observed wellbeing change: improved, unchanged, declined, or not observed.
- Optional fixed outcome tags: enjoyment, social connection, communication, cognitive stimulation, physical movement, relaxation, and independence/choice.

Free-text health or care notes are deliberately excluded. The tablet sends resident IDs; resident names remain encrypted in D1 and are decrypted only for authorised portal responses.

## CQC evidence mapping

The report maps the evidence to relevant CQC quality statements: Monitoring and improving outcomes; Supporting people to live healthier lives; Treating people as individuals; Independence, choice and control; Person-centred care; and Governance, management and sustainability.

Managers must combine this information with people's direct experience, care plans, consent, staff records, and other evidence. A chart does not independently demonstrate compliance or a wellbeing outcome.

## Cost and scaling

Charts use a self-hosted Apache ECharts 6.1.0 build under Apache-2.0. No resident data is sent to an analytics SaaS and there is no chart licence fee. D1 performs indexed, facility-scoped aggregation. The API returns bounded tables (maximum 1,000 participation rows and 250 resident summaries) while aggregate charts remain compact. CSV and print-to-PDF reports run in the browser.

As usage grows, retain recent detailed events in D1 and add scheduled daily aggregate tables before considering a separate warehouse. This preserves the existing low-cost architecture for early and medium growth.
