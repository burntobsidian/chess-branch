import { create } from "zustand";
import {
  position,
  separateOpening,
  initialLibrary,
  importPgn,
  validateLibrary,
  exportPgn,
  type Library,
} from "./repertoire";
import { loadLibrary, saveLibrary } from "./storage";
import { nextDecision, type Side } from "./practice";
import { analyze, type Candidate } from "./engine";
type Practice = {
  side: Side;
  mistakes: number;
  hints: number;
  finished: boolean;
  scope: "line" | "opening";
  queue: string[];
  index: number;
};
type State = {
  library: Library;
  ready: boolean;
  saveStatus: string;
  selected: string | null;
  selectedOpening: string | null;
  recoveryUndo: Library | null;
  separateSelectedOpening: () => void;
  undoSeparation: () => void;
  selectOpening: (id: string) => void;
  renameOpening: (name: string, id?: string) => void;
  createOpening: (name: string, preserveDraft?: boolean) => void;
  nextVariation: () => void;
  draft: string[];
  cursor: number;
  orientation: Side;
  practice: Practice | null;
  message: string;
  candidates: Candidate[];
  analyzing: boolean;
  promotion: { from: string; to: string } | null;
  init: () => Promise<void>;
  select: (id: string | null) => void;
  navigate: (cursor: number) => void;
  playMove: (move: string | { from: string; to: string; promotion?: string }) => boolean;
  promote: (piece: string) => void;
  saveVariation: (name: string) => void;
  rename: (name: string, id?: string) => void;
  remove: () => void;
  startPractice: (side: Side, scope?: "line" | "opening") => void;
  stopPractice: () => void;
  reveal: () => void;
  importText: (text: string, openingId?: string) => boolean;
  restore: (text: string) => void;
  flip: () => void;
  analyze: () => void;
  applyCandidate: (moves: string[]) => void;
  export: (kind: "pgn" | "backup" | "practice") => void;
  setMessage: (text: string) => void;
};
let saveQueue = Promise.resolve();
let cancelAnalysis: (() => void) | undefined;
function clearAnalysis() {
  cancelAnalysis?.();
  cancelAnalysis = undefined;
}
function persist(library: Library) {
  useApp.setState({ library, saveStatus: "Saving…", recoveryUndo: null });
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => saveLibrary(library))
    .then(() => {
      useApp.setState({ saveStatus: "Saved on this device" });
    })
    .catch(() => {
      useApp.setState({
        saveStatus: "Could not save — export a backup",
        message: "Browser storage is unavailable. Export a backup before closing.",
      });
    });
}
function record(completed: boolean) {
  const s = useApp.getState();
  const p = s.practice;
  const line = s.library.lines.find((l) => l.id === s.selected);
  if (!p || p.finished || !line) return;
  persist({
    ...s.library,
    attempts: [
      ...s.library.attempts,
      {
        id: crypto.randomUUID(),
        lineId: line.id,
        name: line.name,
        moves: line.moves.slice(0, s.cursor),
        side: p.side,
        mistakes: p.mistakes,
        hints: p.hints,
        completed,
        date: new Date().toISOString(),
      },
    ],
  });
}
export const useApp = create<State>((set, get) => ({
  library: initialLibrary(),
  ready: false,
  saveStatus: "Loading…",
  selected: null,
  selectedOpening: null,
  recoveryUndo: null,
  draft: [],
  cursor: 0,
  orientation: "white",
  practice: null,
  message: "Play moves on the board, or paste a line to begin.",
  candidates: [],
  analyzing: false,
  promotion: null,
  async init() {
    try {
      const library = await loadLibrary();
      set({ library, ready: true, saveStatus: "Saved on this device" });
      if (library.lines[0]) get().select(library.lines[0].id);
    } catch {
      set({
        ready: true,
        saveStatus: "Storage unavailable",
        message: "Could not read local data. Restore a backup or export your work before leaving.",
      });
    }
  },
  setMessage: (message) => set({ message }),
  selectOpening(id) {
    const line = get().library.lines.find((l) => l.openingId === id);
    get().select(line?.id ?? null);
    set({ selectedOpening: id });
  },
  separateSelectedOpening() {
    const s = get();
    if (s.practice || !s.selectedOpening) return;
    const repaired = separateOpening(s.library, s.selectedOpening);
    if (repaired === s.library) return;
    persist(repaired);
    const selected = repaired.lines.find((l) => l.id === s.selected);
    set({
      selectedOpening: selected?.openingId ?? null,
      recoveryUndo: s.library,
      message:
        "Separated into openings using the previewed names. Moves and practice history are unchanged.",
    });
  },
  undoSeparation() {
    const s = get();
    if (!s.recoveryUndo || s.practice) return;
    const library = s.recoveryUndo;
    persist(library);
    set({
      selectedOpening: library.lines.find((l) => l.id === s.selected)?.openingId ?? null,
      message: "Separation undone.",
    });
  },
  createOpening(name, preserveDraft = false) {
    const s = get();
    if (s.practice || !name.trim()) return;
    const opening = { id: crypto.randomUUID(), name: name.trim() };
    persist({ ...s.library, openings: [...s.library.openings, opening] });
    clearAnalysis();
    set({
      selected: null,
      selectedOpening: opening.id,
      draft: preserveDraft ? s.draft : [],
      cursor: preserveDraft ? s.cursor : 0,
      candidates: [],
      analyzing: false,
      promotion: null,
      message: "Opening created. Play moves and save a variation.",
    });
  },
  renameOpening(name, id = get().selectedOpening ?? undefined) {
    if (!name.trim()) return;
    const s = get();
    persist({
      ...s.library,
      openings: s.library.openings.map((o) => (o.id === id ? { ...o, name: name.trim() } : o)),
    });
  },
  select(id) {
    get().stopPractice();
    clearAnalysis();
    const line = get().library.lines.find((l) => l.id === id);
    set({
      selected: line?.id ?? null,
      selectedOpening: line?.openingId ?? null,
      draft: line?.moves ?? [],
      cursor: line?.moves.length ?? 0,
      candidates: [],
      analyzing: false,
      promotion: null,
      message: line
        ? "Choose a position to explore, or practice this line."
        : "Play a new line, then save it to your repertoire.",
    });
  },
  navigate(cursor) {
    if (get().practice) return;
    clearAnalysis();
    set({
      cursor: Math.max(0, Math.min(cursor, get().draft.length)),
      candidates: [],
      analyzing: false,
      promotion: null,
    });
  },
  playMove(move) {
    const s = get();
    if (!s.ready || s.practice?.finished) return false;
    const c = position(s.draft.slice(0, s.cursor));
    if (typeof move !== "string" && !move.promotion) {
      const promotions = c
        .moves({ verbose: true })
        .filter((m) => m.from === move.from && m.to === move.to && m.promotion);
      if (promotions.length) {
        set({ promotion: { from: move.from, to: move.to } });
        return false;
      }
    }
    let san: string;
    try {
      san = c.move(move).san;
    } catch {
      set({ message: "That move is not legal in this position." });
      return false;
    }
    if (s.practice) {
      if (s.draft[s.cursor] !== san) {
        set({
          practice: { ...s.practice, mistakes: s.practice.mistakes + 1 },
          message: "Not the move in this line. Try again, or reveal the saved move.",
        });
        return false;
      }
      const cursor = nextDecision(s.draft, s.cursor + 1, s.practice.side);
      set({ cursor, message: "Correct. Your next move." });
      if (cursor === s.draft.length) {
        record(true);
        set({
          practice: { ...get().practice!, finished: true },
          message: "Line complete. Practice it again, or explore a variation.",
        });
      }
      return true;
    }
    clearAnalysis();
    set({
      draft: [...s.draft.slice(0, s.cursor), san],
      cursor: s.cursor + 1,
      candidates: [],
      analyzing: false,
      message: "Exploring. Save this variation when you’re ready.",
    });
    return true;
  },
  promote(piece) {
    const p = get().promotion;
    set({ promotion: null });
    if (p) get().playMove({ ...p, promotion: piece });
  },
  saveVariation(name) {
    const s = get();
    if (s.practice || !s.cursor) return;
    const moves = s.draft.slice(0, s.cursor);
    const existing = s.library.lines.find(
      (l) => l.openingId === s.selectedOpening && l.moves.join(" ") === moves.join(" "),
    );
    if (existing) {
      set({ selected: existing.id, message: "This variation is already saved." });
      return;
    }
    const openingId = s.selectedOpening ?? crypto.randomUUID();
    const line = {
      openingId,
      id: crypto.randomUUID(),
      name: name.trim() || `Line ${s.library.lines.length + 1}`,
      moves,
    };
    persist({
      ...s.library,
      openings: s.selectedOpening
        ? s.library.openings
        : [...s.library.openings, { id: openingId, name: name.trim() || "Untitled opening" }],
      lines: [...s.library.lines, line],
    });
    set({
      selected: line.id,
      selectedOpening: openingId,
      draft: moves,
      message: "Variation saved. Ready to practice.",
    });
  },
  rename(name, id = get().selected ?? undefined) {
    const s = get();
    if (!name.trim() || !id || s.practice) return;
    persist({
      ...s.library,
      lines: s.library.lines.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)),
    });
  },
  remove() {
    const s = get();
    get().stopPractice();
    persist({ ...get().library, lines: s.library.lines.filter((l) => l.id !== s.selected) });
    get().select(get().library.lines[0]?.id ?? null);
  },
  startPractice(side, scope = "line") {
    const s = get();
    const queue = s.library.lines
      .filter(
        (l) =>
          (scope === "opening" ? l.openingId === s.selectedOpening : l.id === s.selected) &&
          nextDecision(l.moves, 0, side) < l.moves.length,
      )
      .map((l) => l.id);
    const line = s.library.lines.find((l) => l.id === queue[0]);
    if (!line) {
      set({ message: "No saved moves for that side in this selection." });
      return;
    }
    get().stopPractice();
    clearAnalysis();
    const cursor = nextDecision(line.moves, 0, side);
    if (cursor === line.moves.length) {
      set({ message: "This line has no moves for that side. Add a reply first." });
      return;
    }
    set({
      selected: line.id,
      draft: line.moves,
      cursor,
      orientation: side,
      practice: { side, mistakes: 0, hints: 0, finished: false, scope, queue, index: 0 },
      candidates: [],
      analyzing: false,
      promotion: null,
      message: `Your turn. Recall the saved ${side} move.`,
    });
  },
  nextVariation() {
    const p = get().practice;
    if (!p?.finished || p.index + 1 >= p.queue.length) return;
    const line = get().library.lines.find((l) => l.id === p.queue[p.index + 1]);
    if (!line) return;
    set({
      selected: line.id,
      draft: line.moves,
      cursor: nextDecision(line.moves, 0, p.side),
      practice: { ...p, index: p.index + 1, mistakes: 0, hints: 0, finished: false },
      message: "Next variation. Recall your saved moves.",
    });
  },
  stopPractice() {
    record(false);
    set({ practice: null, promotion: null });
  },
  reveal() {
    const s = get();
    if (!s.practice || s.practice.finished) return;
    set({
      practice: { ...s.practice, hints: s.practice.hints + 1 },
      message: `Saved move: ${s.draft[s.cursor]}. Play it on the board.`,
    });
  },
  importText(text, openingId) {
    try {
      const imported = importPgn(text);
      get().stopPractice();
      const s = get();
      if (openingId && !s.library.openings.some((o) => o.id === openingId))
        throw new Error("Select an existing opening.");
      const openings = [...s.library.openings];
      const lines = [...s.library.lines];
      let first: string | undefined;
      let count = 0;
      for (const incoming of imported) {
        const target =
          openingId ??
          openings.find((o) => o.name === incoming.openingName)?.id ??
          incoming.openingId;
        if (
          lines.some(
            (l) => l.openingId === target && l.moves.join(" ") === incoming.moves.join(" "),
          )
        )
          continue;
        if (!openings.some((o) => o.id === target))
          openings.push({ id: target, name: incoming.openingName ?? incoming.name });
        const { openingName: _name, ...line } = incoming;
        lines.push({ ...line, openingId: target });
        first ??= line.id;
        count++;
      }
      persist({ ...s.library, openings, lines });
      if (first) get().select(first);
      set({ message: `Imported ${count} variation${count === 1 ? "" : "s"}.` });
      return true;
    } catch (e) {
      set({ message: `Import failed: ${(e as Error).message}` });
      return false;
    }
  },
  restore(text) {
    try {
      const library = validateLibrary(JSON.parse(text));
      get().stopPractice();
      persist(library);
      get().select(library.lines[0]?.id ?? null);
      set({ message: "Backup restored." });
    } catch (e) {
      set({ message: `Restore failed: ${(e as Error).message}` });
    }
  },
  flip() {
    set({ orientation: get().orientation === "white" ? "black" : "white" });
  },
  analyze() {
    if (get().practice) return;
    clearAnalysis();
    set({
      candidates: [],
      analyzing: true,
      message: "Analyzing locally. Evaluations are from White’s perspective.",
    });
    cancelAnalysis = analyze(
      get().draft.slice(0, get().cursor),
      (candidate) =>
        set((s) => ({
          candidates: [...s.candidates.filter((c) => c.rank !== candidate.rank), candidate].sort(
            (a, b) => a.rank - b.rank,
          ),
        })),
      (message) => set({ message, analyzing: false }),
      () => set({ analyzing: false }),
    );
  },
  applyCandidate(moves) {
    if (get().practice) return;
    clearAnalysis();
    const prefix = get().draft.slice(0, get().cursor);
    set({
      draft: [...prefix, ...moves],
      cursor: prefix.length + moves.length,
      candidates: [],
      analyzing: false,
      message: "Engine continuation added to exploration. Save it if you want to learn it.",
    });
  },
  export(kind) {
    const s = get();
    const text =
      kind === "backup"
        ? JSON.stringify(s.library, null, 2)
        : exportPgn(
            kind === "practice"
              ? s.library.attempts
                  .filter((a) => a.moves.length)
                  .map((a) => ({
                    name: `${a.name} — ${a.side}, ${a.completed ? "completed" : "partial"}, ${a.mistakes} mistakes, ${a.hints} hints, ${a.date}`,
                    moves: a.moves,
                  }))
              : s.library.lines.map((l) => ({
                  ...l,
                  openingName: s.library.openings.find((o) => o.id === l.openingId)?.name,
                })),
          );
    if (!text) {
      set({ message: "Nothing to export yet." });
      return;
    }
    const url = URL.createObjectURL(
      new Blob([text], {
        type: kind === "backup" ? "application/json" : "application/x-chess-pgn",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `branch-${kind}.${kind === "backup" ? "json" : "pgn"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
}));
