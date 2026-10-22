"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/useApi";
import { ErrorBox } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-16 max-w-sm space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-green-800">Freshroots Demand Planning</h1>
      <label className="block text-sm">
        Password
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
      </label>
      {error && <ErrorBox message={error} />}
      <button disabled={busy || !password} className="w-full rounded bg-green-700 px-4 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
