// screenpipe — AI that knows everything you've seen, said, or heard
// https://screenpipe.com
"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Loader2, Mic, Square, Undo2 } from "lucide-react";
import type { WorkflowMap } from "./model";
import { readWorkflowAnswers, writeWorkflowAnswers, type WorkflowAnswer } from "./workflow-answers";
import { QuestionnaireVoiceSession, type QuestionnaireVoice, type VoiceState } from "./questionnaire-voice";
import { LiveVoiceFill } from "./live-voice-fill";
import styles from "./workflow-question.module.css";

const EXTRA = "Anything else we should know?";
/** Unsaved answers, kept per task for this app session so leaving the page loses nothing. */
const draftKey = (workflow: WorkflowMap) => `screenpipe:workflow-answers:${workflow.id ?? workflow.title}`;
function readDraft(key: string): Record<string, string> {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch { return {}; }
}
function writeDraft(key: string, draft: Record<string, string>) {
  try {
    if (Object.keys(draft).length) sessionStorage.setItem(key, JSON.stringify(draft));
    else sessionStorage.removeItem(key);
  } catch { /* Answering still works when storage is unavailable. */ }
}
/** Every task keeps the English, optional block. Creation mode (required answers) is part of the
 * French Automation Flow demo, so it uses the French copy. */
const COPY = {
  en: {
    section: "Questions and feedback",
    title: "Help make this workflow accurate",
    unavailable: "Answers are unavailable in this view.",
    hint: "Answer what you know. Skip anything you’re unsure about, or talk through the questions.",
    progress: (answered: number, total: number) => `${answered} of ${total} answered · All optional`,
    startVoice: "Answer with voice", stopVoice: "Stop recording",
    connecting: "Connecting microphone…", listening: "Listening", interrupted: "Recording interrupted", stopped: "Recording stopped",
    level: "Microphone level", remaining: (time: string) => `${time} left`,
    voiceHint: "Talk naturally. Answers and a summary update as you speak. Anything you edit by hand stays unchanged.",
    updating: "Updating answers and summary…", byHand: "You can still answer by hand.", review: "Review your answers and summary below.", waiting: "Waiting for your words…",
    liveTranscript: "Live transcript", originalTranscript: "Original transcript", retryVoice: "Retry filling from voice notes",
    fillFailed: "Could not fill answers. Your words are kept. Try again.",
    answered: "Answered", extra: EXTRA,
    extraHint: "Add a missing step, an exception, or other feedback. When you speak, your summary appears here.",
    extraPlaceholder: "Add any other feedback…", placeholder: "Your answer…",
    clear: "Clear", fromVoice: "Filled from voice", summaryFromVoice: "Summary from voice",
    undo: "Undo", undoLabel: (question: string) => `Undo voice answer: ${question}`,
    saved: "Answers saved for the next workflow update.",
    saveFailed: "Couldn’t save answers. Your draft is still here. Try again.",
    savingStopsVoice: "Saving stops voice and keeps the answers shown here.",
    footer: "Saved answers refine future workflow updates.",
    save: "Save answers", saving: "Saving…",
  },
  fr: {
    section: "Questions et remarques",
    title: "Aidez ScreenPipe à bien comprendre cette tâche",
    unavailable: "Les réponses ne sont pas disponibles dans cette vue.",
    hint: "Répondez à chaque question pour créer l'automatisation, par écrit ou à voix haute.",
    progress: (answered: number, total: number) => `Réponses : ${answered} sur ${total} · Obligatoires pour créer l'automatisation`,
    startVoice: "Répondre à voix haute", stopVoice: "Arrêter l'enregistrement",
    connecting: "Connexion au micro…", listening: "À l'écoute", interrupted: "Enregistrement interrompu", stopped: "Enregistrement arrêté",
    level: "Niveau du micro", remaining: (time: string) => `${time} restantes`,
    voiceHint: "Parlez naturellement. Les réponses et un résumé se remplissent pendant que vous parlez. Ce que vous modifiez à la main ne change pas.",
    updating: "Mise à jour des réponses et du résumé…", byHand: "Vous pouvez toujours répondre par écrit.", review: "Vérifiez vos réponses et le résumé ci-dessous.", waiting: "En attente de vos paroles…",
    liveTranscript: "Transcription en direct", originalTranscript: "Transcription d'origine", retryVoice: "Réessayer de remplir depuis la voix",
    fillFailed: "Impossible de remplir les réponses. Vos paroles sont conservées. Réessayez.",
    answered: "Répondu", extra: "Autre chose à savoir ?",
    extraHint: "Ajoutez une étape manquante, une exception ou une autre remarque. Quand vous parlez, votre résumé apparaît ici.",
    extraPlaceholder: "Autre remarque…", placeholder: "Votre réponse…",
    clear: "Effacer", fromVoice: "Rempli à la voix", summaryFromVoice: "Résumé de la voix",
    undo: "Annuler", undoLabel: (question: string) => `Annuler la réponse vocale : ${question}`,
    saved: "Réponses enregistrées.",
    saveFailed: "Impossible d'enregistrer les réponses. Votre brouillon est conservé. Réessayez.",
    savingStopsVoice: "Enregistrer arrête la voix et garde les réponses affichées ici.",
    footer: "Vos réponses restent ici si vous quittez la page.",
    save: "Enregistrer les réponses", saving: "Enregistrement…",
  },
};
export function WorkflowQuestions({ workflow, save, voice, active = true, createFlow }: {
  workflow: WorkflowMap;
  save?: (correction: string) => Promise<WorkflowMap>;
  voice?: QuestionnaireVoice;
  active?: boolean;
  /** Present when the host can create an Automation Flow: every question becomes required. */
  createFlow?: (answers: WorkflowAnswer[]) => Promise<void>;
}) {
  const t = createFlow ? COPY.fr : COPY.en;
  const copy = useRef(t); copy.current = t;
  const questions = [...new Set((workflow.openQuestions ?? []).map(q => q.trim()).filter(q => q && q !== EXTRA))];
  const fields = [...questions, EXTRA];
  const initial = () => Object.fromEntries(readWorkflowAnswers(workflow.userCorrection).map(a => [a.question, a.answer]));
  const [restored] = useState(() => readDraft(draftKey(workflow)));
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...initial(), ...restored }));
  const [saved, setSaved] = useState<Record<string, string>>(initial);
  const fieldsRef = useRef(fields); fieldsRef.current = fields;
  const baseline = useRef(saved);
  const locked = useRef(new Set([...Object.keys(saved).filter(q => saved[q]), ...Object.keys(restored)]));
  const key = draftKey(workflow);
  useEffect(() => {
    if (save) writeDraft(key, Object.fromEntries(Object.entries(answers).filter(([q, a]) => a !== (saved[q] ?? ""))));
  }, [answers, saved, key, save]);
  const beforeVoice = useRef<Record<string, string>>({});
  const [voiceFields, setVoiceFields] = useState<Set<string>>(new Set());
  useEffect(() => {
    const latest = Object.fromEntries(readWorkflowAnswers(workflow.userCorrection).map(a => [a.question, a.answer]));
    const prior = baseline.current;
    setAnswers(current => ({ ...latest, ...Object.fromEntries(Object.entries(current).filter(([q, a]) => a !== (prior[q] ?? ""))) }));
    Object.keys(latest).filter(q => latest[q] !== prior[q]).forEach(q => locked.current.add(q));
    baseline.current = latest; setSaved(latest);
  }, [workflow.userCorrection]);
  const [voiceState, setVoiceState] = useState<VoiceState>({ status: "idle", remaining: 120 });
  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef("");
  const [filling, setFilling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const saving = useRef(false);
  const session = useRef<QuestionnaireVoiceSession>();
  const filler = useRef<LiveVoiceFill>();
  const finishVoice = useRef<() => void>();
  const [voiceSession, setVoiceSession] = useState(0);
  const prefix = useRef("");
  const id = useId();
  const recording = voiceState.status === "connecting" || voiceState.status === "listening";
  const changed = fields.some(q => (answers[q] ?? "").trim() !== (saved[q] ?? "").trim());
  useEffect(() => {
    if (!voice || !active) { setFilling(false); return; }
    const abort = new AbortController();
    let mounted = true;
    const fill = new LiveVoiceFill(async text => {
      try {
        const patches = await voice.fill({ questions: fieldsRef.current, transcript: text, locked: [...locked.current] }, abort.signal);
        if (!mounted) return;
        setAnswers(current => {
          const next = { ...current };
          for (const patch of patches) {
            // Manual edits made during inference also win over its late result.
            if (locked.current.has(patch.question) || !fieldsRef.current.includes(patch.question) || !patch.quote.trim() || !text.includes(patch.quote)) continue;
            if (!(patch.question in beforeVoice.current)) beforeVoice.current[patch.question] = current[patch.question] ?? "";
            next[patch.question] = patch.answer;
          }
          return next;
        });
        setVoiceFields(current => new Set([...current, ...patches.filter(p => !locked.current.has(p.question) && fieldsRef.current.includes(p.question) && p.quote.trim() && text.includes(p.quote)).map(p => p.question)]));
        setError("");
      } catch (cause) { if (mounted) setError(cause instanceof Error ? cause.message : copy.current.fillFailed); }
    }, value => { if (mounted) setFilling(value); });
    filler.current = fill;
    const connection = new QuestionnaireVoiceSession(voice, state => {
      if (!mounted) return;
      setVoiceState(state);
      if (state.status === "stopped" || state.status === "error") fill.enqueue(transcriptRef.current, true);
    }, text => {
      if (!mounted) return;
      const combined = [prefix.current, text].filter(Boolean).join("\n").slice(-24000);
      transcriptRef.current = combined; setTranscript(combined); fill.enqueue(combined);
    });
    session.current = connection;
    const dispose = () => {
      mounted = false;
      // Invalidate callbacks before stopping: Stop normally queues a final fill.
      connection.stop(); fill.dispose(); abort.abort();
      session.current = undefined; filler.current = undefined; finishVoice.current = undefined;
      setFilling(false);
      setVoiceState(s => ({ ...s, status: "stopped", level: undefined }));
    };
    finishVoice.current = () => {
      dispose();
      // A later recording gets a fresh controller and cannot revive stale fills.
      setVoiceSession(value => value + 1);
    };
    return dispose;
  }, [voice, active, voiceSession]);
  function manual(question: string, value: string) {
    locked.current.add(question);
    setAnswers(a => ({ ...a, [question]: value })); setNotice("");
    setVoiceFields(current => { const next = new Set(current); next.delete(question); return next; });
  }
  function toggleVoice() {
    if (recording) { session.current?.stop(); return; }
    prefix.current = transcriptRef.current; setError(""); setNotice("");
    void session.current?.start(workflow.title.slice(0, 300), questions.slice(0, 30));
  }
  const answered = questions.filter(q => answers[q]?.trim()).length;
  const complete = answered === questions.length;
  async function persist(write: NonNullable<typeof save>) {
    const next = await write(writeWorkflowAnswers(workflow.userCorrection, fields.filter(q => (answers[q] ?? "").trim() !== (saved[q] ?? "").trim()).map(question => ({ question, answer: answers[question] ?? "" }))));
    const persisted = Object.fromEntries(readWorkflowAnswers(next.userCorrection).map(a => [a.question, a.answer]));
    baseline.current = persisted; setAnswers(persisted); setSaved(persisted); Object.keys(persisted).forEach(q => locked.current.add(q)); setVoiceFields(new Set());
    return persisted;
  }
  async function submit() {
    if (!save || !changed || saving.current) return;
    if (recording || filling) finishVoice.current?.();
    saving.current = true; setBusy(true); setError(""); setNotice("");
    try {
      await persist(save);
      setNotice(t.saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.saveFailed); }
    finally { saving.current = false; setBusy(false); }
  }
  /** Saves the answers first, so the Flow is never created from answers that were not kept. */
  async function create() {
    if (!createFlow || !complete || saving.current) return;
    if (recording || filling) finishVoice.current?.();
    saving.current = true; setBusy(true); setCreating(true); setError(""); setNotice("");
    try {
      const kept = save && changed ? await persist(save) : answers;
      await createFlow(fields.filter(q => kept[q]?.trim()).map(question => ({ question, answer: kept[question].trim() })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Impossible de créer l'automatisation. Vos réponses sont conservées. Réessayez."); }
    finally { saving.current = false; setBusy(false); setCreating(false); }
  }
  if (!questions.length) return null;
  const saveButton = <button type="submit" className={createFlow ? styles.secondary : undefined} disabled={!changed || busy}>{busy && !creating ? t.saving : t.save}</button>;
  return <section className={styles.questions} aria-label={t.section}>
    <div className={styles.heading}>
      <div><h2>{t.title}</h2><p className={styles.hint}>{!save ? t.unavailable : t.hint}</p></div>
      {voice && save && <button type="button" className={styles.voiceButton} disabled={!active || busy || (!recording && filling)} onClick={toggleVoice}>
        {recording ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}{recording ? t.stopVoice : t.startVoice}
      </button>}
    </div>
    <p className={styles.progress} role="status">{t.progress(answered, questions.length)}</p>
    {(recording || transcript || voiceState.error) && <div className={styles.voicePanel}>
      <div className={styles.voiceStatus}><span>{voiceState.status === "connecting" ? <Loader2 size={16} /> : <Mic size={16} />}{voiceState.status === "connecting" ? t.connecting : recording ? t.listening : voiceState.status === "error" ? t.interrupted : t.stopped}</span>
        {recording && <span><meter aria-label={t.level} min={0} max={1} value={voiceState.level ?? 0} />{t.remaining(`${Math.floor(voiceState.remaining / 60)}:${String(voiceState.remaining % 60).padStart(2, "0")}`)}</span>}
      </div>
      <p className={styles.hint}>{t.voiceHint}</p>
      <p className={styles.progress} aria-live="polite">{filling ? t.updating : voiceState.error ? t.byHand : transcript ? t.review : t.waiting}</p>
      {voiceState.error && <p className={styles.error} role="alert">{voiceState.error}</p>}
      {transcript && <details open={recording}><summary>{recording ? t.liveTranscript : t.originalTranscript}</summary><p className={styles.transcript}>{transcript}</p></details>}
      {!recording && transcript && <button type="button" className={styles.textButton} disabled={filling || busy} onClick={() => filler.current?.enqueue(transcriptRef.current, true, true)}>{t.retryVoice}</button>}
    </div>}
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      {fields.map((question, index) => <div key={question} className={styles.field}>
        <label htmlFor={`${id}-${index}`}><span className={styles.number}>{index < questions.length ? String(index + 1).padStart(2, "0") : ""}</span><span>{question === EXTRA ? t.extra : question}</span>{answers[question]?.trim() && <Check size={16} aria-label={t.answered} />}</label>
        <div className={styles.answer}>
          {question === EXTRA && <p className={styles.hint}>{t.extraHint}</p>}
          <textarea id={`${id}-${index}`} aria-label={question === EXTRA ? t.extra : question} rows={question === EXTRA ? 3 : 2} maxLength={4000} value={answers[question] ?? ""} placeholder={question === EXTRA ? t.extraPlaceholder : t.placeholder} disabled={!save || busy} onChange={e => manual(question, e.target.value)} />
          <div className={styles.fieldActions}>
            {question !== EXTRA && !createFlow && <label><input type="checkbox" checked={answers[question] === "Not sure"} disabled={!save || busy} onChange={e => manual(question, e.target.checked ? "Not sure" : "")} />Not sure</label>}
            {answers[question]?.trim() && <button type="button" disabled={!save || busy} onClick={() => manual(question, "")}>{t.clear}</button>}
            {voiceFields.has(question) && <span><Mic size={12} />{question === EXTRA ? t.summaryFromVoice : t.fromVoice}<button type="button" disabled={busy} aria-label={t.undoLabel(question === EXTRA ? t.extra : question)} onClick={() => manual(question, beforeVoice.current[question] ?? "")}><Undo2 size={12} />{t.undo}</button></span>}
          </div>
        </div>
      </div>)}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {save && <div className={styles.actions}><span role="status">{notice || (recording || filling ? t.savingStopsVoice : t.footer)}</span>{createFlow ? <div className={styles.actionButtons}>{saveButton}<button type="button" disabled={!complete || busy} onClick={() => void create()}>{creating ? "Création…" : "Créer l'automatisation"}</button></div> : saveButton}</div>}
    </form>
  </section>;
}
