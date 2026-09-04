# BRAND — datamodell og lokal lagring

## Arkitekturvalg

V1 bruker lokal persistens i nettleseren. Velg IndexedDB (for eksempel via en liten, isolert repository-adapter) for økter og historikk; `localStorage` kan brukes for små preferanser som tema. Domeneobjekter og repository-grensesnitt skal være uavhengige av lagringsmekanismen, slik at en senere Supabase-adapter kan innføres uten å endre UI eller tastemotor.

Ikke lagre rå tastetrykk for evig i V1. Aggregerte øktresultater og fremdrift er tilstrekkelig, mens eventlogg kan beholdes kun i aktiv økt for feilsøking.

## Domeneobjekter

```ts
type LanguageProfile = {
  id: string;
  version: string;
  displayName: string;
  locale: string; // 'nb-NO'
  description: string;
  preferredForms: Record<string, string>;
};

type GameMode = {
  id: 'nonstop' | 'passage' | 'timed' | string;
  displayName: string;
  availableInV1: boolean;
  defaultErrorMode: 'flow' | 'stop-on-error';
  settingsSchema: Record<string, unknown>;
};

type ContentPack = {
  id: string;
  title: string;
  languageProfileIds: string[];
  workIds: string[];
  status: 'draft' | 'active' | 'archived';
};

type Work = {
  id: string;
  contentPackId: string;
  author: string;
  title: string;
  publishedYear?: number;
  editions: TextEdition[];
  source: SourceAttribution;
};

type TextEdition = {
  id: string;
  workId: string;
  kind: 'original' | 'training-edition';
  version: string;
  languageProfileId?: string;
  segments: TextSegment[];
  editorialNotes?: string[];
};

type TextSegment = {
  id: string;
  order: number;
  text: string;
  label?: string;
  wordCount: number;
  difficulty?: 1 | 2 | 3 | 4 | 5;
};
```

`original` og `training-edition` må ha ulike id-er og egne tekstdata. En treningsutgave peker tilbake på originalverket gjennom `workId`; den må ikke være en boolsk flaggvariant som overskriver kildetekst.

## Brukerdata

```ts
type UserPreferences = {
  schemaVersion: 1;
  theme: 'system' | 'light' | 'dark';
  languageProfileId: string;
  defaultErrorMode: 'flow' | 'stop-on-error';
  lastModeId?: string;
  lastContentPackId?: string;
};

type ReadingProgress = {
  key: string; // profile + edition + mode + work
  workId: string;
  editionId: string;
  languageProfileId: string;
  gameModeId: string;
  nextSegmentId: string;
  completedSegmentIds: string[];
  updatedAt: string;
};

type SessionResult = {
  id: string;
  schemaVersion: 1;
  startedAt: string;
  completedAt?: string;
  status: 'completed' | 'abandoned';
  gameModeId: string;
  languageProfileId: string;
  contentPackId: string;
  workId: string;
  editionId: string;
  segmentIds: string[];
  errorMode: 'flow' | 'stop-on-error';
  durationMs: number;
  targetCharacterCount: number;
  typedCharacterCount: number;
  correctCharacterCount: number;
  errorCount: number;
  grossWpm: number;
  netWpm: number;
  accuracy: number;
};
```

Historikk skal alltid kunne knyttes til nøyaktig utgave, profil og modus. Det gjør at en senere endring i en treningsutgave ikke forfalsker gamle resultater.

## Repository-grensesnitt

```ts
interface BrandRepository {
  getPreferences(): Promise<UserPreferences>;
  savePreferences(value: UserPreferences): Promise<void>;
  getProgress(key: string): Promise<ReadingProgress | null>;
  saveProgress(value: ReadingProgress): Promise<void>;
  addSession(value: SessionResult): Promise<void>;
  listSessions(query?: SessionQuery): Promise<SessionResult[]>;
}
```

En fremtidig `SupabaseBrandRepository` skal implementere samme kontrakt. Autentisering og synkronisering skal ligge utenfor domenemodellene, slik at lokal bruk fortsatt virker uten nett.

## Migrering og personvern

- Alle persistente poster har `schemaVersion`.
- Migrering skjer ved oppstart og må være idempotent.
- Eksporter/slett lokal data som en enkel JSON-funksjon kan vurderes tidlig, men er ikke nødvendig i første vertikale snitt.
- V1 sender ingen tastelogger, litteraturprogresjon eller statistikk til en server.
