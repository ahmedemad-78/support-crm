"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { workAdmin } from "@/app/(app)/work/actions";
import type { WorkContext, Department } from "@/lib/work/types";
export function DepartmentAdmin({
  context,
  sources,
}: {
  context: WorkContext;
  sources: { code: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [external, setExternal] = useState(false);
  const [source, setSource] = useState("");
  const [person, setPerson] = useState("");
  const [department, setDepartment] = useState("");
  const run = (
    operation: "department" | "membership",
    data: Record<string, unknown>,
  ) => {
    setError("");
    start(async () => {
      const r = await workAdmin(operation, data);
      if (!r.ok) {
        setError(r.error || "Could not save");
        return;
      }
      setSelected(null);
      setName("");
      setExternal(false);
      setSource("");
      setActive(true);
      router.refresh();
    });
  };
  return (
    <div className="work-page">
      {error && (
        <p className="work-error" role="alert">
          {error}
        </p>
      )}
      <section className="work-panel">
        <h2>Departments</h2>
        <div className="work-table-wrap">
          <table className="work-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>External cases</th>
                <th>Fixed source</th>
                <th>Members</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {context.departments.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.allow_external ? "Enabled" : "Internal only"}</td>
                  <td>
                    {sources.find((s) => s.code === d.external_source_code)
                      ?.name || "—"}
                  </td>
                  <td>
                    {context.people
                      .filter((p) => p.department_id === d.id)
                      .map((p) => p.name)
                      .join(", ") || "None"}
                  </td>
                  <td>{d.is_active ? "Active" : "Inactive"}</td>
                  <td>
                    <button
                      className="work-btn secondary"
                      onClick={() => {
                        setSelected(d);
                        setName(d.name);
                        setActive(d.is_active);
                        setExternal(d.allow_external);
                        setSource(d.external_source_code || "");
                      }}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="work-panel">
        <h2>{selected ? "Edit department" : "Add department"}</h2>
        <form
          className="work-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run("department", {
              id: selected?.id || "",
              name,
              is_active: active,
              allow_external: external,
              external_source_code: external ? source : "",
            });
          }}
        >
          <label className="work-field">
            Department name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <div className="work-choice">
            <label>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
            <label>
              <input
                type="checkbox"
                checked={external}
                onChange={(e) => setExternal(e.target.checked)}
              />
              May submit external cases
            </label>
          </div>
          {external && (
            <label className="work-field">
              Fixed source *
              <select
                aria-label="Fixed source *"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
              >
                <option value="">Choose…</option>
                {sources.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="work-actions">
            <button className="work-btn" disabled={pending}>
              Save department
            </button>
          </div>
        </form>
      </section>
      <section className="work-panel">
        <h2>Assign account to a department</h2>
        <form
          className="work-grid"
          onSubmit={(e) => {
            e.preventDefault();
            run("membership", {
              profile_id: person,
              department_id: department,
            });
          }}
        >
          <label className="work-field">
            Account *
            <select
              aria-label="Account *"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              required
            >
              <option value="">Choose…</option>
              {context.people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="work-field">
            Department *
            <select
              aria-label="Department *"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            >
              <option value="">Choose…</option>
              {context.departments
                .filter((d) => d.is_active)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="work-actions">
            <button className="work-btn" disabled={pending}>
              Save membership
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
