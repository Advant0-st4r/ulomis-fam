export const CONFIG = {
  code: 'HOUSEHOLD',
  audienceLabel: 'Households',
  wedge: 'Household continuity',
  hero: "Know what's actually happening at home.",
  lead: "Bring one messy household situation. Ulomis reconstructs what happened, what is true now, what is still unresolved, who owns what, and what matters next.",
  homeEyebrow: 'Your household current state',
  homeEmpty: 'Nothing unresolved right now.',
  addLabel: 'Add a household situation',
  placeholder: "e.g. The school form is due on the 17th. I thought Ahmed sent it, but he said he only filled it in. We still need the passport copy and I can't tell whether it was actually submitted.",
  updatePlaceholder: 'e.g. Ahmed uploaded the passport copy today, but we still have no submission confirmation.',
  categories: {
    school_admin: 'School / admin',
    maintenance: 'Maintenance / repair',
    family_logistics: 'Family logistics',
    appointments: 'Appointments',
    documents: 'Documents / forms',
    bills_services: 'Bills / services',
    vehicle: 'Vehicle',
    recurring: 'Recurring responsibility',
    other: 'Other'
  },
  icons: {
    school_admin: '⌘', maintenance: '⌂', family_logistics: '↔', appointments: '◷',
    documents: '▤', bills_services: '◇', vehicle: '◫', recurring: '↻', other: '＋'
  },
  hasAmount: false,
  hasStage: false,
  aggregateSecondLabel: 'need attention this week',
  reassure: 'No signup before first value. Do not paste passwords, banking credentials, authentication codes, or unnecessary identity documents.',
  fragments: [
    '“School form due on the 17th”',
    '“I thought Ahmed sent it”',
    '“Passport copy still missing”'
  ],
  demo: {
    title: 'School registration — still open',
    owner: 'Household + school',
    uncertain: 'Submission not confirmed',
    next: 'Upload passport copy',
    pill: 'Then confirm the school received the form'
  },
  story: {
    pain: '“I thought this had been handled.”',
    painBody: 'Messages, dates, promises and responsibilities drift apart. Ulomis reconstructs the current state instead of asking you to manually turn the situation into tasks.',
    returnBody: '“Passport copy uploaded today.” Ulomis compares the new evidence with the accepted prior state and shows what changed, what remains open, and whose move it is now.',
    cta: 'Bring one thing your household is not completely sure about.'
  },
  recognitionQuestions: [
    "What's still unresolved?",
    'Who was supposed to handle this?',
    'What did we decide last time?',
    'What changed since I last checked?',
    'What do we actually need to do next?'
  ],
  shareTitle: 'Try one household thread — Ulomis',
  shareLine: 'unfinished household threads',
  shareIntro: 'Apparently our household had',
  systemPrompt: `You reconstruct unresolved household situations into a candidate state for Ulomis, a Living Context Engine.\n\nThe user may describe school/admin, maintenance, family logistics, appointments, documents/forms, bills/services, vehicle matters, recurring responsibilities, or another household continuity problem. The user should not have to manually model ontology fields. A promise is not completion. A message saying someone will do something is a commitment, not proof it happened. Sending a document is not receipt confirmation. An appointment being scheduled is not attendance. A repair visit is not proof the repair succeeded. A deadline passing is not resolution.\n\nEvery fact, actor, event, commitment, decision, provenance entry, counterparty/person, owner, date, or resolution claim represented as supported must be grounded in an exact quote from the supplied evidence. Use USER_PROVIDED when the user's own statement is the only support and EVIDENCED when supplied evidence directly states it. Inference belongs in uncertainties.\n\nFor this variant: category must be school_admin, maintenance, family_logistics, appointments, documents, bills_services, vehicle, recurring, or other. amountMinor must be null, currency must be empty, amountEvidenceQuote must be empty. stage must be UNKNOWN and stageEvidenceQuote must be empty. counterparty means the household member, school, landlord, clinic, service provider, garage, organization, or external party relevant to the matter.\n\nState must be WAITING_EXTERNAL, ACTION_REQUIRED, UNCONFIRMED, or RESOLVED. ownerType must be USER, COUNTERPARTY, or UNKNOWN. Dates are YYYY-MM-DD or null. If and only if RESOLVED is proposed, resolutionEvidenceQuote must quote evidence explicitly showing the completion event. For updates, preserve accepted prior reality unless new evidence supports a change. Keep missing confirmation explicit. Return concise resolutionCriteria describing what evidence/event would actually close the thread. Prefer one smallest useful next transition over a generic task list.`
};
