"use client";

import { type FormEvent, type MouseEvent, useCallback, useEffect, useId, useRef, useState } from "react";

const DISMISSED_STORAGE_KEY = "scionBetaPromptDismissedAt";
const SUBMITTED_STORAGE_KEY = "scionBetaPromptSubmittedAt";
const OPEN_SIGNUP_EVENT = "cell-anatomy:open-email-signup";
const CONSENT_TEXT_VERSION = "cell-anatomy-updates-v1";
const DEFAULT_PROMPT_DELAY_MS = 90_000;
const DISMISSAL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

type SubmissionState = "idle" | "submitting" | "success" | "error";

function automaticPromptSuppressed(): boolean {
  try {
    if (window.localStorage.getItem(SUBMITTED_STORAGE_KEY)) return true;
    const dismissedAt = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!dismissedAt) return false;
    const dismissalTime = Date.parse(dismissedAt);
    return !Number.isFinite(dismissalTime) || Date.now() - dismissalTime < DISMISSAL_INTERVAL_MS;
  } catch {
    return true;
  }
}

function rememberSignupDecision(storageKey: string): void {
  try {
    window.localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // The form remains usable when browser storage is unavailable.
  }
}

function automaticPromptDelay(): number {
  const configuredDelay = Number(process.env.NEXT_PUBLIC_SCION_BETA_PROMPT_DELAY_MS);
  return Number.isFinite(configuredDelay) && configuredDelay >= 0 ? configuredDelay : DEFAULT_PROMPT_DELAY_MS;
}

export function EmailSignupLink() {
  function openSignup(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    window.dispatchEvent(new Event(OPEN_SIGNUP_EVENT));
  }

  return <a href="/about#email-updates" onClick={openSignup}>Email Correspondence</a>;
}

export function EmailSignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const formIdentifier = useId();
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [interactive, setInteractive] = useState(false);
  const responseIdentifier = `${formIdentifier}-response`;

  useEffect(() => setInteractive(true), []);

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fieldValue = (name: string) => String(formData.get(name) ?? "").trim();
    setErrorMessage(null);
    setSubmissionState("submitting");
    try {
      const response = await fetch("/api/beta-signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: fieldValue("first_name"),
          last_name: fieldValue("last_name"),
          affiliation: fieldValue("affiliation"),
          email: fieldValue("email"),
          website: fieldValue("website"),
          source_path: window.location.pathname,
          consent_text_version: CONSENT_TEXT_VERSION
        }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!response.ok) {
        setSubmissionState("error");
        setErrorMessage(response.status === 429
          ? "Please wait a moment before trying again."
          : "Your details could not be saved. Please try again.");
        return;
      }
      rememberSignupDecision(SUBMITTED_STORAGE_KEY);
      setSubmissionState("success");
      form.reset();
      window.dispatchEvent(new Event("cell-anatomy:email-signup-saved"));
      onSuccess?.();
    } catch {
      setSubmissionState("error");
      setErrorMessage("Your details could not be saved. Please check your connection and try again.");
    }
  }

  const submitting = submissionState === "submitting";
  const succeeded = submissionState === "success";
  return (
    <form className="email-signup-form" action="/api/beta-signups" method="post" onSubmit={submitSignup} aria-busy={submitting}>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden aria-hidden="true" />
      <div className="email-signup-name-fields">
        <label htmlFor={`${formIdentifier}-first-name`}>First name<input id={`${formIdentifier}-first-name`} name="first_name" autoComplete="given-name" maxLength={80} disabled={submitting || succeeded} /></label>
        <label htmlFor={`${formIdentifier}-last-name`}>Last name<input id={`${formIdentifier}-last-name`} name="last_name" autoComplete="family-name" maxLength={80} disabled={submitting || succeeded} /></label>
      </div>
      <label htmlFor={`${formIdentifier}-affiliation`}>Affiliation<input id={`${formIdentifier}-affiliation`} name="affiliation" autoComplete="organization" maxLength={160} disabled={submitting || succeeded} /></label>
      <label htmlFor={`${formIdentifier}-email`}>Email address <span aria-hidden="true">*</span><input id={`${formIdentifier}-email`} name="email" type="email" autoComplete="email" maxLength={254} required disabled={submitting || succeeded} aria-describedby={errorMessage ? responseIdentifier : undefined} /></label>
      <p className="email-signup-privacy">We use these details only for Cell Anatomy updates and beta invitations. We do not sell your information. You can <a href="mailto:svdrecbd@gmail.com?subject=Remove%20my%20Cell%20Anatomy%20signup">request removal</a> at any time.</p>
      {errorMessage ? <p id={responseIdentifier} className="email-signup-response email-signup-error" role="alert">{errorMessage}</p> : null}
      {succeeded ? <p id={responseIdentifier} className="email-signup-response" role="status">Your details have been saved. Thank you for your interest.</p> : null}
      <div className="email-signup-actions"><button type="submit" className="email-signup-submit" disabled={!interactive || submitting || succeeded}>{submitting ? "Saving details…" : succeeded ? "Details saved" : "Receive updates"}</button></div>
      <noscript><p className="email-signup-response">Enable JavaScript to use this form, or <a href="mailto:svdrecbd@gmail.com?subject=Cell%20Anatomy%20updates">email the project</a>.</p></noscript>
    </form>
  );
}

export function BetaSignupPrompt() {
  const dialogReference = useRef<HTMLDialogElement | null>(null);
  const closeTimerReference = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [formInstance, setFormInstance] = useState(0);

  const openPrompt = useCallback(() => {
    if (closeTimerReference.current) window.clearTimeout(closeTimerReference.current);
    setFormInstance((currentInstance) => currentInstance + 1);
    setVisible(true);
  }, []);

  const closePrompt = useCallback(() => {
    if (closeTimerReference.current) window.clearTimeout(closeTimerReference.current);
    rememberSignupDecision(DISMISSED_STORAGE_KEY);
    setVisible(false);
  }, []);

  useEffect(() => {
    let automaticTimer: number | undefined;
    if (!automaticPromptSuppressed()) automaticTimer = window.setTimeout(openPrompt, automaticPromptDelay());
    const cancelAutomaticPrompt = () => { if (automaticTimer) window.clearTimeout(automaticTimer); };
    const openRequestedPrompt = () => { cancelAutomaticPrompt(); openPrompt(); };
    window.addEventListener(OPEN_SIGNUP_EVENT, openRequestedPrompt);
    window.addEventListener("cell-anatomy:email-signup-saved", cancelAutomaticPrompt);
    return () => {
      cancelAutomaticPrompt();
      if (closeTimerReference.current) window.clearTimeout(closeTimerReference.current);
      window.removeEventListener(OPEN_SIGNUP_EVENT, openRequestedPrompt);
      window.removeEventListener("cell-anatomy:email-signup-saved", cancelAutomaticPrompt);
    };
  }, [openPrompt]);

  useEffect(() => {
    const dialog = dialogReference.current;
    if (!visible || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [visible]);

  function finishSignup() {
    closeTimerReference.current = window.setTimeout(() => setVisible(false), 2200);
  }

  return (
    <dialog ref={dialogReference} className="email-signup-dialog" aria-labelledby="email-signup-title" aria-describedby="email-signup-description" onCancel={(event) => { event.preventDefault(); closePrompt(); }}>
      {visible ? <>
        <button type="button" className="email-signup-close" aria-label="Close signup form" onClick={closePrompt}><span aria-hidden="true">×</span></button>
        <section className="email-signup-content"><h2 id="email-signup-title">Email Correspondence</h2><p id="email-signup-description">Occasional notes on new corpus records, research tools, and opportunities to test upcoming features.</p><EmailSignupForm key={formInstance} onSuccess={finishSignup} /></section>
      </> : null}
    </dialog>
  );
}
