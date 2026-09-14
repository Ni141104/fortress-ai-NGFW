import { useEffect, useState } from "react";
import { apiRequest } from "@/services/api-client";

type ManagedUser = { id: number; username: string; email: string; role: "blue" | "red" | "admin" };

export function AdminUserPanel() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Admin123");
  const [role, setRole] = useState<"blue" | "red">("blue");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => setUsers(await apiRequest<ManagedUser[]>("/admin/users"));
  useEffect(() => { void refresh().catch((error: Error) => setMessage(error.message)); }, []);

  const addUser = async () => {
    setMessage(null);
    try {
      await apiRequest<ManagedUser>("/admin/users", { method: "POST", body: JSON.stringify({ email, password, role }) });
      setEmail("");
      await refresh();
      setMessage(`${role === "blue" ? "Blue" : "Red"} Team user created`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "User creation failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="User email" type="email" className="rounded border border-border bg-slate-950/60 px-3 py-2 text-xs" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Temporary password" type="password" className="rounded border border-border bg-slate-950/60 px-3 py-2 text-xs" />
        <select value={role} onChange={(event) => setRole(event.target.value as "blue" | "red")} className="rounded border border-border bg-slate-950/60 px-3 py-2 text-xs">
          <option value="blue">Blue Team</option>
          <option value="red">Red Team</option>
        </select>
        <button disabled={!email || password.length < 8} onClick={() => void addUser()} className="rounded border border-cyber-blue/50 bg-cyber-blue/10 px-3 py-2 text-xs font-semibold text-cyber-blue disabled:opacity-50">Add user</button>
      </div>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <div className="space-y-2 text-xs">
        {users.map((user) => <div key={user.id} className="flex items-center justify-between rounded border border-border px-3 py-2"><span>{user.email}</span><span className="uppercase text-cyber-blue">{user.role}</span></div>)}
      </div>
    </div>
  );
}