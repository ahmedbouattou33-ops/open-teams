"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { RegisterUserInputSchema } from "@openteams/shared-types";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import { audit, auditActions } from "@/lib/audit";
import { useAuthStore } from "@/stores/auth";

interface FieldErrors {
  readonly email?: string;
  readonly password?: string;
  readonly displayName?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = RegisterUserInputSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const next: Record<string, string> = {};
      for (const issue of issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !next[key]) next[key] = issue.message;
      }
      setFieldErrors(next as FieldErrors);
      return;
    }

    setBusy(true);
    try {
      const result = await api.register(parsed.data);
      setSession(result);
      audit(auditActions.register, { details: `Identity provisioned for ${parsed.data.email}` });
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md animate-slide-up rounded-2xl border border-surface-border bg-surface-raised p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent font-bold text-white">
            OT
          </div>
          <h1 className="text-xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Join your team on OpenTeams</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field
            id="displayName"
            label="Display name"
            type="text"
            value={displayName}
            onChange={setDisplayName}
            error={fieldErrors.displayName}
            placeholder="Ada Lovelace"
            autoComplete="name"
          />
          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
            placeholder="you@company.com"
            autoComplete="email"
          />
          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password}
            placeholder="Min. 10 chars, upper + lower + digit"
            autoComplete="new-password"
          />

          {error ? (
            <p className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-accent hover:text-accent-hover">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

function Field(props: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-sm font-medium text-slate-300">
        {props.label}
      </label>
      <input
        id={props.id}
        type={props.type}
        className="input-dark"
        aria-invalid={props.error ? true : undefined}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        required
      />
      {props.error ? <p className="mt-1 text-xs text-rose-400">{props.error}</p> : null}
    </div>
  );
}
