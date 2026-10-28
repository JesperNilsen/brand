/**
 * What the reader is told: labels and explanations, in Norwegian, kept apart
 * from the judging so the wording can change without touching a verdict.
 */
import type { OrthographyVerdict, TranscriptionVerdict } from "./judge";
import type {
  Confidence,
  FormStatus,
  ImplementationStatus,
  OfficialStatus,
  OrthographyProfile,
  WordForm,
} from "./types";

const FORM_STATUS: Record<FormStatus, string> = {
  required: "obligatorisk",
  main: "hovedform",
  side: "sideform",
  bracket: "klammeform",
  optional: "valgfri form",
  allowed: "tillatt",
  preferred: "foretrukket",
  tolerated: "tolerert",
  "style-marked": "tillatt, stilmarkert",
  outside: "utenfor normen",
};

const OFFICIAL_STATUS: Record<OfficialStatus, string> = {
  "current-official": "gjeldende offentlig rettskrivning",
  "historical-official": "historisk offentlig rettskrivning",
  house: "Brands husnorm",
};

const IMPLEMENTATION_STATUS: Record<ImplementationStatus, string> = {
  "metadata-only": "Ikke støttet ennå",
  partial: "Delvis støttet",
};

const CONFIDENCE: Record<Confidence, string> = {
  "verified-primary": "primærkilde",
  "verified-secondary": "sekundærkilde",
  unverified: "ubekreftet",
};

export function formStatusLabel(status: FormStatus): string {
  return FORM_STATUS[status];
}

export function officialStatusLabel(status: OfficialStatus): string {
  return OFFICIAL_STATUS[status];
}

export function implementationStatusLabel(status: ImplementationStatus): string {
  return IMPLEMENTATION_STATUS[status];
}

export function confidenceLabel(confidence: Confidence): string {
  return CONFIDENCE[confidence];
}

export function periodLabel(o: OrthographyProfile): string {
  const { from, to } = o.historicalPeriod;
  return to === undefined ? `fra ${from}` : `${from}–${to}`;
}

/** What Brand can and cannot check under this norm, in one sentence. */
export function implementationNotice(o: OrthographyProfile): string {
  const words = o.ruleset.words.length;
  const rules = o.ruleset.rules.length;
  if (o.implementationStatus === "metadata-only") {
    return "Brand har ennå ingen kildebelagte regler for denne normen. Du kan velge den, men staving kan ikke kontrolleres etter den.";
  }
  return `Brand kjenner ${rules} ${rules === 1 ? "regel" : "regler"} og ${words} ord med kildehenvisning. Andre ord kan ikke kontrolleres etter normen ennå.`;
}

function quote(form: string): string {
  return `«${form}»`;
}

function listForms(forms: readonly WordForm[]): string {
  return forms.map((f) => `${quote(f.form)} (${formStatusLabel(f.status)})`).join(", ");
}

export function explainOrthography(o: OrthographyProfile, verdict: OrthographyVerdict): string {
  switch (verdict.kind) {
    case "accepted": {
      const { form, accepted } = verdict;
      const head = `${quote(form.form)} er ${formStatusLabel(form.status)} i ${o.displayName}.`;
      const stronger = accepted.filter((f) => f !== form && accepted.indexOf(f) < accepted.indexOf(form));
      return stronger.length > 0 ? `${head} Ved siden av: ${listForms(stronger)}.` : head;
    }
    case "outside": {
      const note = verdict.form.note ? ` (${verdict.form.note})` : "";
      return `${quote(verdict.form.form)}${note} er utenfor ${o.displayName}. Skriv ${listForms(verdict.accepted)}.`;
    }
    case "undocumented":
      return `Brand finner ikke formen blant dem kildene dokumenterer for ${o.displayName}. Den kan likevel ha vært tillatt. Dokumentert: ${listForms(verdict.accepted)}.`;
  }
}

/** Why a transcription deviation is still a deviation, when the norm allows the typed form. */
export function explainTranscription(
  o: OrthographyProfile,
  expected: string,
  verdict: TranscriptionVerdict,
): string | null {
  if (verdict.kind === "exact" || !verdict.allowedInNorm) return null;
  const { form } = verdict.allowedInNorm;
  return `${quote(form.form)} er ${formStatusLabel(form.status)} i ${o.displayName}, men i avskrivning gjengis teksten nøyaktig: ${quote(expected)}.`;
}
