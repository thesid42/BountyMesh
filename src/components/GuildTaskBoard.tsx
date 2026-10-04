"use client";
import { useCallback, useEffect, useState } from "react";
import type { GuildTask } from "@/lib/guild-tasks";
export function GuildTaskBoard({ authHeaders, onRun }: { authHeaders?: Record<string, string>; onRun?: (runId: string) => void }) {
  const [tasks, setTasks] = useState<GuildTask[]>([]), [error, setError] = useState(""), [running, setRunning] = useState<string | null>(null);
  const token = authHeaders?.Authorization ?? authHeaders?.authorization;
  const reload = useCallback(async () => {
    try { const response = await fetch("/api/guild-tasks", { headers: token ? { authorization: token } : {}, credentials: "same-origin", cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTasks(data.tasks); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load posted tasks"); }
  }, [token]);
  useEffect(() => { void reload(); const interval = setInterval(() => void reload(), 15_000); return () => clearInterval(interval); }, [reload]);
  return <section className="agent-form-panel"><div className="agent-directory-heading"><div><h3>Guild Board · Posted Tasks</h3><p>Quests posted by MCP clients. Start a task to authorize its test funds and run the agents.</p></div><button className="arcade-btn-pill" disabled={!!running} onClick={() => void reload()}>Refresh board</button></div>{error && <p className="agent-error" role="alert">{error}</p>}{tasks.length ? <div className="guild-posted-tasks">{tasks.map(task => <article key={task.id}><div><h4>{task.title}</h4><p>{task.goal}</p><span className="rpg-skill-chip">{task.status ?? "posted"} · ${(task.rewardCents / 100).toFixed(2)}</span></div><button className="arcade-btn-primary" disabled={!!running || task.status === "completed"} onClick={() => {
    if (task.runId && task.status === "completed") { onRun?.(task.runId); return; }
    setRunning(task.id); setError(""); void (async () => { try { const response = await fetch(`/api/guild-tasks/${task.id}/run`, { method: "POST", credentials: "same-origin", headers: token ? { authorization: token } : {} }); const result = await response.json(); if (!response.ok) throw new Error(result.error); if (result.run.status === "failed") setError(result.run.error ?? "Task failed"); await reload(); onRun?.(result.run.id); } catch (e) { setError(e instanceof Error ? e.message : "Task could not run. Retry this same posted task."); } finally { setRunning(null); } })();
  }}>{running === task.id ? "Running…" : task.status === "completed" ? "Completed" : task.runId ? "Retry task" : "Fund & run task"}</button></article>)}</div> : !error && <p>No MCP tasks posted yet.</p>}</section>;
}
