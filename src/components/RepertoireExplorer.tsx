import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useApp } from "../core/store";

type Props = { scope: "line" | "opening"; onSelectScope: (scope: "line" | "opening") => void };
function Icon({ kind }: { kind: "folder" | "file" | "chevron" }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "folder" ? (
        <path d="M3 7V5h6l2 2h10v13H3Z" />
      ) : kind === "file" ? (
        <>
          <path d="M6 3h8l4 4v14H6Z" />
          <path d="M14 3v5h4M9 12h6M9 16h6" />
        </>
      ) : (
        <path d="m9 6 6 6-6 6" />
      )}
    </svg>
  );
}
export function RepertoireExplorer({ scope, onSelectScope }: Props) {
  const s = useApp();
  const [editing, setEditing] = useState<{
    id: string;
    kind: "opening" | "variation";
    name: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const beginRename = (id: string, kind: "opening" | "variation", name: string) => {
    if (s.practice) return;
    setEditing({ id, kind, name });
    setEditValue(name);
  };
  const renameForm = (id: string) =>
    editing?.id === id ? (
      <form
        className="sidebar-name-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (editing.kind === "opening") s.renameOpening(editValue, id);
          else s.rename(editValue, id);
          setEditing(null);
        }}
      >
        <label htmlFor="explorer-rename">
          {editing.kind === "opening" ? "Opening name" : "Variation name"}
        </label>
        <input
          autoFocus
          id="explorer-rename"
          value={editValue}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditing(null);
            }
          }}
        />
        <div>
          <button className="secondary" disabled={!editValue.trim() || !!s.practice}>
            Save name
          </button>
          <button type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </div>
      </form>
    ) : null;
  const itemMenu = (id: string, kind: "opening" | "variation", name: string) => (
    <details className="item-menu">
      <summary aria-label={`Actions for ${name}`}>⋯</summary>
      <div>
        <button
          disabled={!!s.practice}
          onClick={(e) => {
            e.currentTarget.closest("details")?.removeAttribute("open");
            beginRename(id, kind, name);
          }}
        >
          Rename {kind}
        </button>
      </div>
    </details>
  );
  const tree = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (s.selectedOpening) setExpanded((old) => new Set([...old, s.selectedOpening!]));
  }, [s.selectedOpening, s.selected]);
  const toggle = (id: string) =>
    setExpanded((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const focus = (id: string) => {
    setFocusId(id);
    tree.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(id)}"]`)?.focus();
  };
  const keyboard = (e: KeyboardEvent, id: string, openingId: string, isFolder: boolean) => {
    if (e.key === "F2") {
      e.preventDefault();
      const item = isFolder
        ? s.library.openings.find((o) => o.id === openingId)
        : s.library.lines.find((l) => `line:${l.id}` === id);
      if (item) beginRename(item.id, isFolder ? "opening" : "variation", item.name);
      return;
    }
    const items = Array.from(
      tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [],
    );
    const index = items.findIndex((el) => el.dataset.item === id);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : Math.max(0, Math.min(items.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)));
      if (items[next]) focus(items[next].dataset.item!);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (isFolder) {
        if (!expanded.has(openingId)) toggle(openingId);
        else if (items[index + 1]?.dataset.parent === openingId)
          focus(items[index + 1].dataset.item!);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (isFolder) {
        if (expanded.has(openingId)) toggle(openingId);
      } else focus(`opening:${openingId}`);
    }
  };
  const activeId =
    focusId ??
    (s.selected
      ? `line:${s.selected}`
      : s.library.openings[0]
        ? `opening:${s.library.openings[0].id}`
        : null);
  const visibleIds = s.library.openings.flatMap((o) => [
    `opening:${o.id}`,
    ...(expanded.has(o.id)
      ? s.library.lines.filter((l) => l.openingId === o.id).map((l) => `line:${l.id}`)
      : []),
  ]);
  const tabStop = activeId && visibleIds.includes(activeId) ? activeId : visibleIds[0];
  return (
    <div className="explorer" ref={tree} role="tree" aria-label="Opening explorer">
      {s.library.openings.map((o) => {
        const lines = s.library.lines.filter((l) => l.openingId === o.id);
        const open = expanded.has(o.id);
        const id = `opening:${o.id}`;
        return (
          <div className="opening-group" key={o.id} role="none">
            <div
              className={`folder-row ${s.selectedOpening === o.id && scope === "opening" ? "active" : ""}`}
            >
              <button
                className="folder-toggle"
                tabIndex={-1}
                aria-label={`${open ? "Collapse" : "Expand"} ${o.name}`}
                aria-expanded={open}
                onClick={() => {
                  toggle(o.id);
                  focus(id);
                }}
              >
                <span className={open ? "expanded" : ""}>
                  <Icon kind="chevron" />
                </span>
              </button>
              <button
                className="opening-title"
                aria-owns={open ? `children-${o.id}` : undefined}
                role="treeitem"
                data-item={id}
                aria-label={o.name}
                aria-level={1}
                aria-expanded={open}
                aria-selected={s.selectedOpening === o.id && scope === "opening"}
                aria-disabled={!!s.practice}
                tabIndex={tabStop === id ? 0 : -1}
                onFocus={() => setFocusId(id)}
                onKeyDown={(e) => keyboard(e, id, o.id, true)}
                onClick={() => {
                  if (s.practice) return;
                  s.selectOpening(o.id);
                  onSelectScope("opening");
                }}
                onDoubleClick={() => toggle(o.id)}
              >
                <Icon kind="folder" />
                <span className="explorer-name" title={o.name}>
                  {o.name}
                </span>
                <small>{lines.length}</small>
              </button>
              {itemMenu(o.id, "opening", o.name)}
            </div>
            {renameForm(o.id)}
            {open && (
              <div
                className="variation-tree"
                id={`children-${o.id}`}
                role="group"
                aria-label={`${o.name} variations`}
              >
                {lines.length ? (
                  lines.map((l) => {
                    const lineId = `line:${l.id}`;
                    return (
                      <div key={l.id} className="variation-row" role="none">
                        <div className="variation-row-content">
                          <button
                            className={`line ${s.selected === l.id && scope === "line" ? "selected" : ""}`}
                            role="treeitem"
                            data-item={lineId}
                            data-parent={o.id}
                            aria-label={l.name}
                            aria-level={2}
                            aria-selected={s.selected === l.id && scope === "line"}
                            aria-disabled={!!s.practice}
                            tabIndex={tabStop === lineId ? 0 : -1}
                            onFocus={() => setFocusId(lineId)}
                            onKeyDown={(e) => keyboard(e, lineId, o.id, false)}
                            onClick={() => {
                              if (s.practice) return;
                              s.select(l.id);
                              onSelectScope("line");
                            }}
                          >
                            <Icon kind="file" />
                            <span className="explorer-name" title={l.name}>
                              {l.name}
                            </span>
                            <small title={`${Math.ceil(l.moves.length / 2)} moves`}>
                              {Math.ceil(l.moves.length / 2)}
                            </small>
                          </button>
                          {itemMenu(l.id, "variation", l.name)}
                        </div>
                        {renameForm(l.id)}
                      </div>
                    );
                  })
                ) : (
                  <p className="explorer-empty">No variations yet</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
