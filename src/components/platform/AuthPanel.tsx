import { useState } from "react";
import { clearSession, getStoredUser, login } from "@/services/api-client";
import type { AuthUser } from "@/services/api-client";

export function AuthPanel({ onAuthenticated }: { onAuthenticated?: (user: AuthUser | null) => void }) {
  const [user, setUser] = useState(getStoredUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await login(email, password);
      setUser(next);
      onAuthenticated?.(next);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div>
          <div className="font-semibold text-foreground">{user.username}</div>
          <div className="text-xs text-muted-foreground">Authenticated FastAPI session</div>
        </div>
        <button
          onClick={() => {
            clearSession();
            setUser(null);
            onAuthenticated?.(null);
            window.dispatchEvent(new Event("ngfw:logout"));
          }}
          className="rounded border border-cyber-pink/40 px-3 py-1.5 text-[11px] font-semibold text-cyber-pink"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Gmail or institutional email" type="email" autoComplete="email" className="rounded border border-border bg-slate-950/60 px-3 py-2 text-xs" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" className="rounded border border-border bg-slate-950/60 px-3 py-2 text-xs" />
      </div>
      {error && <p className="text-xs text-cyber-pink">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy || !email || !password} onClick={() => void submit()} className="rounded border border-cyber-blue/50 bg-cyber-blue/10 px-3 py-1.5 text-[11px] font-semibold text-cyber-blue disabled:opacity-50">
          {busy ? "Connecting..." : "Log in"}
        </button>
        <span className="text-[11px] text-muted-foreground">Accounts are provisioned by the administrator.</span>
      </div>
    </div>
  );
}
