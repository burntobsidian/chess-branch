import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chessboard } from "react-chessboard";
import { useApp } from "./core/store";
import { position, separationPlan } from "./core/repertoire";
import "./style.css";
import { RepertoireExplorer } from "./components/RepertoireExplorer";
function App() {
  const s = useApp();
  const [name, setName] = useState("");
  const [paste, setPaste] = useState("");
  const [inputOpen, setInputOpen] = useState(false);
  const [showSeparation, setShowSeparation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openingName, setOpeningName] = useState("");
  const [preserveDraft, setPreserveDraft] = useState(false);
  const [scope, setScope] = useState<"line" | "opening">("line");
  const [importTarget, setImportTarget] = useState("");
  const menu = useRef<HTMLDetailsElement>(null);
  const importInput = useRef<HTMLTextAreaElement>(null);
  const importPanel = useRef<HTMLElement>(null);
  function openImport() {
    if (inputOpen) {
      importPanel.current?.scrollIntoView({ block: "center" });
      importInput.current?.focus();
    }
    setInputOpen(true);
    if (menu.current) menu.current.open = false;
  }
  useEffect(() => {
    if (inputOpen) {
      importPanel.current?.scrollIntoView({ block: "center" });
      importInput.current?.focus();
    }
  }, [inputOpen]);
  const [square, setSquare] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void useApp.getState().init();
  }, []);
  useEffect(() => {
    setSquare(null);
    setSaving(false);
    setShowSeparation(false);
  }, [s.cursor, s.selected, s.practice?.side]);
  const current = position(s.draft.slice(0, s.cursor));
  const selected = s.library.lines.find((l) => l.id === s.selected);
  const opening = s.library.openings.find((o) => o.id === s.selectedOpening);
  const separation = separationPlan(
    s.library.lines.filter((l) => l.openingId === s.selectedOpening),
  );
  const saved = s.library.lines.some(
    (l) =>
      l.openingId === s.selectedOpening &&
      l.moves.join(" ") === s.draft.slice(0, s.cursor).join(" "),
  );
  const moves = s.practice && !s.practice.finished ? s.draft.slice(0, s.cursor) : s.draft;
  return (
    <div className="app">
      <header>
        <a className="brand" href="/" aria-label="Branch home">
          <span className="brand-mark">♞</span>
          <span>
            branch<span className="brand-sub">OPENING PRACTICE</span>
          </span>
        </a>
        <span className="storage">{s.saveStatus}</span>
        <details className="file-menu" ref={menu}>
          <summary>
            Files
            <svg
              className="menu-chevron"
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="menu">
            <button disabled={!!s.practice} onClick={openImport}>
              Import PGN
            </button>
            <button onClick={() => s.export("pgn")}>Export repertoire</button>
            <button onClick={() => s.export("practice")}>Export practiced lines</button>
            <button onClick={() => s.export("backup")}>Download backup</button>
            <button onClick={() => file.current?.click()}>Restore backup…</button>
          </div>
        </details>
        <input
          ref={file}
          type="file"
          accept=".json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (
              f &&
              window.confirm("Replace your repertoire and practice history with this backup?")
            )
              s.restore(await f.text());
            e.target.value = "";
          }}
        />
      </header>
      <main>
        <div className="workspace">
          <aside className="repertoire">
            <div className="panel-title">
              <h2>Repertoire</h2>
              <span className="count">{s.library.openings.length}</span>
            </div>
            <button
              className="new-line"
              disabled={!s.ready || !!s.practice}
              onClick={() => {
                setCreating(true);
                setPreserveDraft(false);
                setOpeningName("");
              }}
            >
              ＋ New opening
            </button>
            {creating && (
              <form
                className="sidebar-name-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  s.createOpening(openingName, preserveDraft);
                  setCreating(false);
                  if (preserveDraft) setSaving(true);
                }}
              >
                <label htmlFor="new-opening-name">Opening name</label>
                <input
                  autoFocus
                  id="new-opening-name"
                  value={openingName}
                  onChange={(e) => setOpeningName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setCreating(false);
                  }}
                />
                <div>
                  <button className="secondary" disabled={!openingName.trim()}>
                    Create opening
                  </button>
                  <button type="button" onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div className="line-list">
              {!s.library.openings.length ? (
                <div className="empty">
                  <span>♧</span>
                  <h3>A place for your openings.</h3>
                  <p>Play a few moves or paste a line. Save the ones you want to remember.</p>
                  <button
                    className="text-button"
                    onClick={() =>
                      s.importText(
                        '[Event "Italian · sample"]\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 *',
                      )
                    }
                  >
                    Try an Italian game
                  </button>
                </div>
              ) : (
                <RepertoireExplorer scope={scope} onSelectScope={setScope} />
              )}
            </div>
            <button className="paste-button" disabled={!!s.practice} onClick={openImport}>
              Paste or import moves
            </button>
            <p className="local-note">
              Saved in this browser.
              <br />
              Download a backup to keep a copy.
            </p>
          </aside>
          <section className="board-panel">
            <div className="board-heading">
              <span>{s.practice ? "PRACTICE" : saved ? "SAVED LINE" : "EXPLORATION"}</span>
              <button className="text-button" onClick={s.flip}>
                Flip board ⇄
              </button>
            </div>
            <div className="board">
              <Chessboard
                options={{
                  id: "branch-board",
                  position: current.fen(),
                  boardOrientation: s.orientation,
                  darkSquareStyle: { backgroundColor: "#688476" },
                  lightSquareStyle: { backgroundColor: "#eef0e6" },
                  squareStyles: square ? { [square]: { backgroundColor: "#d6b45d" } } : {},
                  boardStyle: { borderRadius: 4 },
                  allowDragging: s.ready && !s.practice?.finished,
                  onPieceDrop: ({ sourceSquare, targetSquare }) =>
                    targetSquare ? s.playMove({ from: sourceSquare, to: targetSquare }) : false,
                  onSquareClick: ({ square: target }) => {
                    if (square && s.playMove({ from: square, to: target })) {
                      setSquare(null);
                      return;
                    }
                    setSquare(
                      current.get(target as Parameters<typeof current.get>[0]) ? target : null,
                    );
                  },
                }}
              />
            </div>
            {s.promotion && (
              <div className="promotion">
                Promote to{" "}
                {["q", "r", "b", "n"].map((p) => (
                  <button key={p} onClick={() => s.promote(p)}>
                    {{ q: "Queen", r: "Rook", b: "Bishop", n: "Knight" }[p]}
                  </button>
                ))}
              </div>
            )}
            <div className="board-footer">
              <span>
                {current.isCheckmate()
                  ? "Checkmate"
                  : current.isDraw()
                    ? "Draw"
                    : `${current.turn() === "w" ? "White" : "Black"} to move${current.isCheck() ? " · Check" : ""}`}
              </span>
              <div>
                <button
                  aria-label="Starting position"
                  disabled={!!s.practice || s.cursor === 0}
                  onClick={() => s.navigate(0)}
                >
                  ⏮
                </button>
                <button
                  aria-label="Previous move"
                  disabled={!!s.practice || s.cursor === 0}
                  onClick={() => s.navigate(s.cursor - 1)}
                >
                  ‹
                </button>
                <button
                  aria-label="Next move"
                  disabled={!!s.practice || s.cursor === s.draft.length}
                  onClick={() => s.navigate(s.cursor + 1)}
                >
                  ›
                </button>
                <button
                  aria-label="Last move"
                  disabled={!!s.practice || s.cursor === s.draft.length}
                  onClick={() => s.navigate(s.draft.length)}
                >
                  ⏭
                </button>
              </div>
            </div>
            <div className="feedback" role="status" aria-label="Practice feedback">
              {s.message}
            </div>
          </section>
          <aside className="study-panel">
            <div className="panel-title">
              <h2>{s.practice ? "Recall the line" : (selected?.name ?? "Your next variation")}</h2>
              <span className={`pill ${saved ? "" : "draft"}`}>
                {s.practice ? "Practice" : saved ? "Saved" : "Unsaved"}
              </span>
            </div>
            <p className="help">
              {s.practice
                ? "Play your saved responses from memory."
                : "Click a move to revisit a position. Play something different to branch out."}
            </p>
            <div className="moves">
              {!moves.length ? (
                <span className="muted">Your moves will appear here.</span>
              ) : (
                moves.map((move, i) => (
                  <span className="move-unit" key={i}>
                    {i % 2 === 0 && <span className="move-number">{Math.floor(i / 2) + 1}.</span>}
                    <button
                      disabled={!!s.practice}
                      className={`${s.cursor === i + 1 ? "active" : ""} ${selected?.moves[i] !== move ? "unsaved" : ""}`}
                      onClick={() => s.navigate(i + 1)}
                    >
                      {move}
                    </button>
                  </span>
                ))
              )}
            </div>
            {!s.practice && (
              <>
                {!!s.cursor &&
                  !saved &&
                  (saving && opening ? (
                    <form
                      className="save-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        s.saveVariation(name);
                        setName("");
                        setSaving(false);
                      }}
                    >
                      <label htmlFor="line-name">Variation name</label>
                      <input
                        autoFocus
                        id="line-name"
                        placeholder="e.g. Main line"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setSaving(false);
                        }}
                      />
                      <div>
                        <button className="secondary" disabled={!name.trim()}>
                          Save variation
                        </button>
                        <button type="button" onClick={() => setSaving(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="secondary"
                      onClick={() => {
                        if (opening) setSaving(true);
                        else {
                          setCreating(true);
                          setPreserveDraft(true);
                          setOpeningName("");
                        }
                      }}
                    >
                      {opening ? "Save variation" : "Create opening to save"}
                    </button>
                  ))}
                {selected && (
                  <div className="line-actions">
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete “${selected.name}”?`)) s.remove();
                      }}
                    >
                      Delete variation
                    </button>
                  </div>
                )}
                {opening && separation.length > 1 && (
                  <div className="recovery-tools">
                    {!showSeparation ? (
                      <button className="text-button" onClick={() => setShowSeparation(true)}>
                        Separate mixed openings…
                      </button>
                    ) : (
                      <section className="recovery-preview" aria-label="Separate mixed openings">
                        <h2>Separate this group</h2>
                        <p>
                          Each name below becomes an opening. Only branches with the original “ ·
                          variation N” naming stay with their named main line. Review the list
                          before applying.
                        </p>
                        <ul>
                          {separation.map((g) => (
                            <li key={g.lineIds[0]}>
                              {g.name}{" "}
                              <small>
                                ({g.lineIds.length} variation{g.lineIds.length === 1 ? "" : "s"})
                              </small>
                            </li>
                          ))}
                        </ul>
                        <p>
                          Moves and practice history stay intact. Undo is available until your next
                          edit or reload.
                        </p>
                        <button
                          className="secondary"
                          onClick={() => {
                            s.separateSelectedOpening();
                            setShowSeparation(false);
                          }}
                        >
                          Apply separation
                        </button>
                        <button onClick={() => setShowSeparation(false)}>Cancel</button>
                      </section>
                    )}
                  </div>
                )}
                {s.recoveryUndo && (
                  <button className="text-button" onClick={s.undoSeparation}>
                    Undo separation
                  </button>
                )}
                <div className="practice-controls">
                  <label htmlFor="practice-scope">Practice</label>
                  <select
                    id="practice-scope"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as "line" | "opening")}
                  >
                    <option value="opening">Entire opening · all variations</option>
                    <option value="line">Selected variation only</option>
                  </select>
                  <p className="help">
                    {scope === "opening"
                      ? "Practice every saved variation in this opening, one at a time."
                      : "Repeat just the selected variation."}
                  </p>
                  <div className="two-buttons">
                    <button
                      className="primary"
                      disabled={!selected}
                      onClick={() => s.startPractice("white", scope)}
                    >
                      ♙ White
                    </button>
                    <button
                      className="primary"
                      disabled={!selected}
                      onClick={() => s.startPractice("black", scope)}
                    >
                      ♟ Black
                    </button>
                  </div>
                  {!saved && selected && (
                    <small>Practice uses the saved version of this line.</small>
                  )}
                </div>
              </>
            )}
            {s.practice && (
              <div className="practice-controls">
                <p className="help">
                  {s.practice.scope === "opening"
                    ? `Variation ${s.practice.index + 1} of ${s.practice.queue.length}`
                    : "Selected variation"}
                </p>
                <div className="session-stats">
                  <span>{s.practice.mistakes} misses</span>
                  <span>{s.practice.hints} reveals</span>
                </div>
                {!s.practice.finished ? (
                  <button className="secondary" onClick={s.reveal}>
                    Reveal move
                  </button>
                ) : s.practice.index + 1 < s.practice.queue.length ? (
                  <button className="primary" onClick={s.nextVariation}>
                    Next variation
                  </button>
                ) : (
                  <button
                    className="primary"
                    onClick={() => s.startPractice(s.practice!.side, s.practice!.scope)}
                  >
                    Practice again
                  </button>
                )}
                <button className="text-button stop" onClick={s.stopPractice}>
                  {s.practice.finished ? "Explore this line" : "Stop practice"}
                </button>
              </div>
            )}
            {!s.practice && (
              <div className="analysis">
                <div className="panel-title">
                  <h2>Explore a response</h2>
                  <button className="text-button" disabled={s.analyzing} onClick={s.analyze}>
                    {s.analyzing ? "Thinking…" : "Analyze"}
                  </button>
                </div>
                <p className="help">
                  Find a reply to an unfamiliar move. Save only what you want to study.
                </p>
                {s.candidates.map((c) => (
                  <button
                    className="candidate"
                    key={c.rank}
                    onClick={() => s.applyCandidate(c.moves)}
                  >
                    <strong>{c.score}</strong>
                    <span>
                      {c.moves.slice(0, 6).join(" ")}
                      <small>Depth {c.depth} · explore continuation</small>
                    </span>
                  </button>
                ))}
                {!!s.candidates.length && (
                  <small>Scores favor White when positive. Best found, not guaranteed best.</small>
                )}
              </div>
            )}
          </aside>
        </div>
        {inputOpen && (
          <section className="import-panel" ref={importPanel} aria-label="Import PGN">
            <div className="panel-title">
              <h2>Import openings & variations</h2>
              <button className="text-button" onClick={() => setInputOpen(false)}>
                Close
              </button>
            </div>
            <label htmlFor="import-target">Add to</label>
            <select
              id="import-target"
              value={importTarget}
              onChange={(e) => setImportTarget(e.target.value)}
            >
              <option value="">Openings from PGN titles</option>
              {s.library.openings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <textarea
              ref={importInput}
              aria-label="PGN or move notation"
              placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
            <div>
              <input
                aria-label="Import PGN file"
                type="file"
                accept=".pgn,.txt"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPaste(await f.text());
                  e.target.value = "";
                }}
              />
              <button
                className="primary"
                disabled={!paste.trim() || !!s.practice}
                onClick={() => {
                  if (s.importText(paste, importTarget || undefined)) {
                    setInputOpen(false);
                    setPaste("");
                  }
                }}
              >
                Import lines
              </button>
            </div>
            <p role="status">{s.message.startsWith("Import failed:") ? s.message : ""}</p>
            <p>
              Variations are grouped under their opening. Choose an existing opening to add branches
              to it.
            </p>
          </section>
        )}
      </main>
      <footer>
        <span>Your lines. Your pace. Saved locally on this device.</span>
        <span>
          Analysis powered by{" "}
          <a href="https://github.com/nmrugg/stockfish.js" target="_blank" rel="noreferrer">
            Stockfish.js
          </a>{" "}
          · <a href="/engine/LICENSE.txt">GPLv3</a>
        </span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
