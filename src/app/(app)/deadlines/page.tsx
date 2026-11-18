import { addDeadline, addTask, deleteDeadline, deleteTask, toggleTask, updateDeadline } from "@/app/actions";
import { DeleteButton, Hidden, PageHead } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { daysUntil, fmtLongDay, fmtShortDay, relativeDay } from "@/lib/format";
import type { Deadline, Task } from "@/lib/types";

export const metadata = { title: "Deadlines · AlgoLab hub" };

function TaskRow({ t }: { t: Task }) {
  return (
    <li className={`row ${t.done ? "is-done" : ""}`}>
      <form action={toggleTask}>
        <Hidden name="id" value={t.id} />
        <Hidden name="done" value={String(t.done)} />
        <button type="submit" className={`check ${t.done ? "on" : ""}`} aria-label={t.done ? "Rouvrir" : "Marquer comme fait"}>
          {t.done ? "✓" : ""}
        </button>
      </form>
      <div className="row-main">
        <span className="row-title">{t.title}</span>
        <span className="meta">{[t.owner, t.due ? `pour le ${fmtShortDay(t.due)}` : null].filter(Boolean).join(" · ")}</span>
      </div>
      <DeleteButton action={deleteTask} id={t.id} />
    </li>
  );
}

function AddTask({ deadlineId }: { deadlineId?: string }) {
  const id = deadlineId ?? "free";
  return (
    <form action={addTask} className="inline-form">
      {deadlineId && <Hidden name="deadline_id" value={deadlineId} />}
      <input name="title" id={`task-${id}`} placeholder="Nouvelle étape" required aria-label="Nouvelle étape" />
      <input name="owner" placeholder="Qui ?" aria-label="Responsable" className="short" />
      <input name="due" type="date" aria-label="Échéance" className="short" />
      <button type="submit" className="btn">
        Ajouter
      </button>
    </form>
  );
}

export default async function DeadlinesPage() {
  const { sb } = await requireMember();
  const [deadlinesQ, tasksQ] = await Promise.all([
    sb.from("deadlines").select("*").order("due"),
    sb.from("tasks").select("*").order("done").order("due", { ascending: true, nullsFirst: false }).order("created_at"),
  ]);
  const deadlines = (deadlinesQ.data ?? []) as Deadline[];
  const tasks = (tasksQ.data ?? []) as Task[];

  const byDeadline = new Map<string, Task[]>();
  for (const t of tasks) if (t.deadline_id) byDeadline.set(t.deadline_id, [...(byDeadline.get(t.deadline_id) ?? []), t]);
  const loose = tasks.filter((t) => !t.deadline_id);

  const todayN = 0;
  const upcoming = deadlines.filter((d) => daysUntil(d.due) >= todayN);
  const past = deadlines.filter((d) => daysUntil(d.due) < todayN).reverse();

  const renderDeadline = (d: Deadline) => {
    const items = byDeadline.get(d.id) ?? [];
    const done = items.filter((t) => t.done).length;
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const n = daysUntil(d.due);
    return (
      <section className="card" key={d.id}>
        <div className="card-head">
          <div>
            <h2>{d.title}</h2>
            <span className="meta">
              {fmtLongDay(d.due)} · {relativeDay(d.due)}
            </span>
          </div>
          <span className={`pill ${n < 0 ? "" : n <= 3 ? "todo" : "info"}`}>
            {n < 0 ? "Passée" : n === 0 ? "Aujourd'hui" : `J-${n}`}
          </span>
        </div>
        {d.details && <p className="muted">{d.details}</p>}
        <div className="progress" role="img" aria-label={`${done} étape(s) sur ${items.length} terminée(s)`}>
          <div className="bar" style={{ width: `${pct}%` }} />
        </div>
        <span className="meta">
          {items.length ? `${done} / ${items.length} étapes terminées` : "Aucune étape pour l'instant : découpe cette deadline en tâches."}
        </span>
        <ul className="rows">
          {items.map((t) => (
            <TaskRow key={t.id} t={t} />
          ))}
        </ul>
        <AddTask deadlineId={d.id} />
        <details className="edit">
          <summary>Modifier la deadline</summary>
          <form action={updateDeadline} className="stack-form">
            <Hidden name="id" value={d.id} />
            <label htmlFor={`dt-${d.id}`}>Intitulé</label>
            <input id={`dt-${d.id}`} name="title" defaultValue={d.title} required />
            <label htmlFor={`dd-${d.id}`}>Date</label>
            <input id={`dd-${d.id}`} name="due" type="date" defaultValue={d.due} required />
            <label htmlFor={`dx-${d.id}`}>Détails (facultatif)</label>
            <input id={`dx-${d.id}`} name="details" defaultValue={d.details ?? ""} />
            <div className="form-actions">
              <button type="submit" className="btn primary">
                Enregistrer
              </button>
            </div>
          </form>
          <form action={deleteDeadline} className="danger-zone">
            <Hidden name="id" value={d.id} />
            <button type="submit" className="link-btn danger">
              Supprimer cette deadline
            </button>
            <p className="meta">Ses étapes sont conservées, sans deadline.</p>
          </form>
        </details>
      </section>
    );
  };

  return (
    <>
      <PageHead title="Deadlines" sub="Chaque rendu avec son breakdown : les étapes, qui s'en occupe, pour quand." />

      <details className="card add-card">
        <summary>Nouvelle deadline</summary>
        <form action={addDeadline} className="stack-form">
          <label htmlFor="nd-title">Intitulé</label>
          <input id="nd-title" name="title" required />
          <label htmlFor="nd-due">Date</label>
          <input id="nd-due" name="due" type="date" required />
          <label htmlFor="nd-details">Détails (facultatif)</label>
          <input id="nd-details" name="details" />
          <div className="form-actions">
            <button type="submit" className="btn primary">
              Créer
            </button>
          </div>
        </form>
      </details>

      {upcoming.map(renderDeadline)}
      {!upcoming.length && <p className="muted">Aucune deadline à venir.</p>}

      {loose.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Tâches sans deadline</h2>
            <span className="meta">{loose.filter((t) => !t.done).length} en cours</span>
          </div>
          <ul className="rows">
            {loose.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </ul>
          <AddTask />
        </section>
      )}
      {loose.length === 0 && (
        <details className="card add-card">
          <summary>Ajouter une tâche sans deadline</summary>
          <AddTask />
        </details>
      )}

      {past.length > 0 && (
        <details className="past-block">
          <summary>Deadlines passées ({past.length})</summary>
          <div className="stack">{past.map(renderDeadline)}</div>
        </details>
      )}
    </>
  );
}
