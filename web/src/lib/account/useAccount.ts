"use client";
// The signed in user and their saved training runs. Row level security in the
// database (supabase/migrations) makes sure a user can only read and change
// their own runs, plus runs others chose to make public.
import { useEffect, useMemo, useState } from "react";
import { validateRun, type RunRecord } from "../training/runs";
import { accountsEnabled, supabase } from "./client";

export type AccountUser = { id: string; email: string };

export type Account = {
  enabled: boolean;
  ready: boolean;
  user: AccountUser | null;
  listRuns(taskId?: string): Promise<RunRecord[]>;
  saveRun(run: RunRecord, isPublic?: boolean): Promise<void>;
  deleteRun(id: string): Promise<void>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useAccount(): Account {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(!accountsEnabled);

  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    let alive = true;
    sb.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? "" } : null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return useMemo<Account>(
    () => ({
      enabled: accountsEnabled,
      ready,
      user,
      async listRuns(taskId) {
        const sb = supabase();
        if (!sb || !user) return [];
        let q = sb.from("training_runs").select("payload").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(50);
        if (taskId) q = q.eq("task_id", taskId);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const out: RunRecord[] = [];
        for (const row of data ?? []) {
          try {
            out.push(validateRun(row.payload));
          } catch {
            /* skip damaged rows */
          }
        }
        return out;
      },
      async saveRun(run, isPublic = false) {
        const sb = supabase();
        if (!sb || !user) throw new Error("Not signed in");
        if (!UUID.test(run.id)) throw new Error("Run id is not a UUID");
        const { error } = await sb.from("training_runs").upsert({
          id: run.id,
          user_id: user.id,
          task_id: run.taskId,
          variant: run.variant,
          name: run.name,
          generations: run.history.length,
          held_out: run.history.at(-1)?.heldOut ?? null,
          is_public: isPublic,
          payload: run,
        });
        if (error) throw new Error(error.message);
      },
      async deleteRun(id) {
        const sb = supabase();
        if (!sb || !user) return;
        const { error } = await sb.from("training_runs").delete().eq("id", id).eq("user_id", user.id);
        if (error) throw new Error(error.message);
      },
    }),
    [ready, user],
  );
}
