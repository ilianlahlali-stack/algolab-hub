export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}

export function DeleteButton({
  action,
  id,
  label = "Supprimer",
}: {
  action: (f: FormData) => Promise<void>;
  id: string;
  label?: string;
}) {
  return (
    <form action={action}>
      <Hidden name="id" value={id} />
      <button type="submit" className="icon-btn" aria-label={label} title={label}>
        ×
      </button>
    </form>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
