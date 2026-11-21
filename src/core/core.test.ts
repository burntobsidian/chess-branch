import { separateOpening } from "./repertoire";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { exportPgn, importPgn, initialLibrary, position, validateLibrary } from "./repertoire";
import { nextDecision } from "./practice";
vi.mock("./storage", () => ({
  loadLibrary: async () => initialLibrary(),
  saveLibrary: vi.fn(async () => {}),
}));
import { useApp } from "./store";
describe("portable repertoire", () => {
  it("imports nested alternatives from the correct branch position", () => {
    const lines = importPgn("1. e4 e5 (1... c5 2. Nf3 (2. Nc3)) 2. Nf3 Nc6 *");
    expect(lines.map((l) => l.moves.join(" "))).toEqual([
      "e4 e5 Nf3 Nc6",
      "e4 c5 Nf3",
      "e4 c5 Nc3",
    ]);
  });
  it("exports each named variation without losing moves", () => {
    const lines = importPgn('[Event "Italian"]\n1. e4 e5 2. Nf3 Nc6 *');
    const result = importPgn(exportPgn(lines));
    expect(result[0].moves).toEqual(lines[0].moves);
    expect(result[0].name).toBe("Italian");
  });
  it("rejects illegal moves and invalid backups before replacing data", () => {
    expect(() => importPgn("1. e4 e4")).toThrow();
    expect(() => validateLibrary({ version: 9, lines: [], attempts: [] })).toThrow();
    expect(() =>
      validateLibrary({
        version: 1,
        lines: [{ id: "x", name: "Bad", moves: ["e5"] }],
        attempts: [],
      }),
    ).toThrow();
  });
  it("rejects custom starting positions explicitly", () => {
    expect(() => importPgn('[FEN "8/8/8/8/8/8/4K3/7k w - - 0 1"]\n1. Kf3 *')).toThrow(
      "Custom starting positions",
    );
  });
  it("preserves a JSON round trip", () => {
    const lines = importPgn("1. d4 d5 2. c4 *");
    const library = {
      ...initialLibrary(),
      openings: [{ id: lines[0].openingId, name: "Queen pawn" }],
      lines,
    };
    expect(validateLibrary(JSON.parse(JSON.stringify(library)))).toEqual(library);
  });
  it("retains promotion and castling through the chess rules", () => {
    expect(position(["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]).get("g1")?.type).toBe("k");
  });
});
describe("practice and exploration boundaries", () => {
  beforeEach(() =>
    useApp.setState({
      library: initialLibrary(),
      ready: true,
      selected: null,
      selectedOpening: null,
      draft: [],
      cursor: 0,
      practice: null,
      candidates: [],
      analyzing: false,
    }),
  );
  it("automatically plays the opposing side only", () => {
    const moves = ["e4", "e5", "Nf3", "Nc6"];
    expect(nextDecision(moves, 0, "black")).toBe(1);
    expect(nextDecision(moves, 1, "white")).toBe(2);
  });
  it("does not save explored moves until explicitly asked", () => {
    const s = useApp.getState();
    s.playMove("e4");
    expect(useApp.getState().library.lines).toHaveLength(0);
    s.saveVariation("King pawn");
    expect(useApp.getState().library.lines[0].moves).toEqual(["e4"]);
  });
  it("branches without modifying an existing line", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5 2. Nf3 Nc6");
    s.navigate(1);
    s.playMove("c5");
    s.saveVariation("Sicilian");
    expect(useApp.getState().library.lines.map((l) => l.moves)).toEqual([
      ["e4", "e5", "Nf3", "Nc6"],
      ["e4", "c5"],
    ]);
  });
  it("records a miss without adding it to the repertoire", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5 2. Nf3 Nc6");
    s.startPractice("white");
    expect(s.playMove("d4")).toBe(false);
    expect(useApp.getState().cursor).toBe(0);
    expect(useApp.getState().practice?.mistakes).toBe(1);
    s.playMove("e4");
    expect(useApp.getState().cursor).toBe(2);
    s.playMove("Nf3");
    expect(useApp.getState().practice?.finished).toBe(true);
    expect(useApp.getState().library.attempts[0].completed).toBe(true);
    expect(useApp.getState().library.lines).toHaveLength(1);
  });
  it("records hints, black practice, and completed sessions only once", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5");
    s.startPractice("black");
    expect(useApp.getState().cursor).toBe(1);
    s.reveal();
    s.playMove("e5");
    s.stopPractice();
    expect(useApp.getState().library.attempts).toHaveLength(1);
    expect(useApp.getState().library.attempts[0].hints).toBe(1);
  });
  it("records stopped sessions as partial", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5 2. Nf3");
    s.startPractice("white");
    s.playMove("e4");
    s.stopPractice();
    expect(useApp.getState().library.attempts[0].completed).toBe(false);
    expect(useApp.getState().library.attempts[0].moves).toEqual(["e4", "e5"]);
  });
  it("does not replace data on invalid restore", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5");
    s.restore('{"version":99}');
    expect(useApp.getState().library.lines).toHaveLength(1);
  });
});

describe("opening structure and practice scope", () => {
  beforeEach(() =>
    useApp.setState({
      library: initialLibrary(),
      ready: true,
      selected: null,
      selectedOpening: null,
      draft: [],
      cursor: 0,
      practice: null,
    }),
  );
  it("migrates version 1 without losing lines or attempts", () => {
    const old = {
      version: 1,
      lines: [
        { id: "a", name: "Italian", moves: ["e4", "e5", "Nf3"] },
        { id: "b", name: "Italian · variation 1", moves: ["e4", "e5", "Bc4"] },
        { id: "c", name: "Queen pawn", moves: ["d4", "d5"] },
      ],
      attempts: [],
    };
    const migrated = validateLibrary(old);
    expect(migrated.version).toBe(2);
    expect(migrated.openings).toHaveLength(2);
    expect(migrated.lines[0].openingId).toBe(migrated.lines[1].openingId);
    expect(migrated.lines.map((l) => l.id)).toEqual(["a", "b", "c"]);
    expect(validateLibrary(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });
  it("imports branches under one opening and adds exploration to that opening", () => {
    const s = useApp.getState();
    s.importText('[Event "King pawn"]\n1. e4 e5 (1... c5)');
    expect(useApp.getState().library.openings).toHaveLength(1);
    expect(useApp.getState().library.lines).toHaveLength(2);
    s.navigate(1);
    s.playMove("c6");
    s.saveVariation("Caro");
    expect(new Set(useApp.getState().library.lines.map((l) => l.openingId)).size).toBe(1);
  });
  it("practices every branch exactly once and keeps results separate", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5 (1... c5)");
    s.startPractice("black", "opening");
    expect(useApp.getState().practice?.queue).toHaveLength(2);
    s.playMove("e5");
    s.nextVariation();
    expect(useApp.getState().practice?.index).toBe(1);
    expect(useApp.getState().practice?.finished).toBe(false);
    s.playMove("c5");
    s.stopPractice();
    expect(useApp.getState().library.attempts.map((a) => a.moves)).toEqual([
      ["e4", "e5"],
      ["e4", "c5"],
    ]);
  });
  it("restricts selected-variation practice to that variation", () => {
    const s = useApp.getState();
    s.importText("1. e4 e5 (1... c5)");
    s.select(useApp.getState().library.lines[1].id);
    s.startPractice("black", "line");
    expect(useApp.getState().practice?.queue).toHaveLength(1);
    expect(s.playMove("e5")).toBe(false);
    expect(s.playMove("c5")).toBe(true);
  });
  it("keeps two openings separate and supports explicit import targets", () => {
    const s = useApp.getState();
    s.importText('[Event "A"]\n1. e4 e5');
    const a = useApp.getState().selectedOpening!;
    s.importText('[Event "B"]\n1. d4 d5');
    s.importText("1. e4 c5", a);
    expect(useApp.getState().library.openings).toHaveLength(2);
    expect(useApp.getState().library.lines.filter((l) => l.openingId === a)).toHaveLength(2);
  });
  it("keeps PGN opening and variation names through reimport", () => {
    const s = useApp.getState();
    s.importText('[Event "A"]\n1. e4 e5 (1... c5)');
    s.rename("Main");
    const library = useApp.getState().library;
    const pgn = exportPgn(library.lines.map((l) => ({ ...l, openingName: "A" })));
    useApp.setState({ library: initialLibrary(), selected: null, selectedOpening: null });
    s.importText(pgn);
    expect(useApp.getState().library.openings).toHaveLength(1);
    expect(useApp.getState().library.lines.map((l) => l.name)).toEqual(["Main", "Variation 1"]);
  });
});

describe("conservative migration and mixed-opening repair", () => {
  const legacy = {
    version: 1,
    lines: [
      { id: "italian", name: "Italian", moves: ["e4", "e5", "Nf3", "Nc6", "Bc4"] },
      { id: "ruy", name: "Ruy Lopez", moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"] },
      {
        id: "italian-alt",
        name: "Italian · variation 1",
        moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6"],
      },
    ],
    attempts: [
      {
        id: "attempt",
        lineId: "ruy",
        name: "Ruy Lopez",
        moves: ["e4", "e5"],
        side: "white",
        mistakes: 1,
        hints: 0,
        completed: false,
        date: "2026-11-21",
      },
    ],
  };
  it("keeps different openings apart despite a four-ply shared prefix", () => {
    const result = validateLibrary(legacy);
    expect(result.openings.map((o) => o.name)).toEqual(["Italian", "Ruy Lopez"]);
    expect(result.lines[0].openingId).not.toBe(result.lines[1].openingId);
    expect(result.lines[0].openingId).toBe(result.lines[2].openingId);
    expect(result.attempts).toEqual(legacy.attempts);
    expect(validateLibrary(legacy)).toEqual(result);
  });
  it("does not silently regroup already saved v2 data", () => {
    const valid = validateLibrary(legacy);
    const mixed = {
      ...valid,
      openings: [{ id: "mixed", name: "My repertoire" }],
      lines: valid.lines.map((l) => ({ ...l, openingId: "mixed" })),
    };
    expect(validateLibrary(mixed)).toEqual(mixed);
    const repaired = separateOpening(mixed, "mixed");
    expect(repaired.openings.map((o) => o.name)).toEqual(["Italian", "Ruy Lopez"]);
    expect(repaired.lines.map((l) => ({ id: l.id, moves: l.moves, name: l.name }))).toEqual(
      mixed.lines.map((l) => ({ id: l.id, moves: l.moves, name: l.name })),
    );
    expect(repaired.attempts).toEqual(mixed.attempts);
  });
  it("can undo repair and invalidates undo after later edits", () => {
    const valid = validateLibrary(legacy);
    const mixed = {
      ...valid,
      openings: [{ id: "mixed", name: "My repertoire" }],
      lines: valid.lines.map((l) => ({ ...l, openingId: "mixed" })),
    };
    useApp.setState({
      library: mixed,
      selected: "italian",
      selectedOpening: "mixed",
      practice: null,
      recoveryUndo: null,
    });
    const s = useApp.getState();
    s.separateSelectedOpening();
    expect(useApp.getState().library.openings).toHaveLength(2);
    s.undoSeparation();
    expect(useApp.getState().library).toEqual(mixed);
    s.separateSelectedOpening();
    s.rename("New name");
    expect(useApp.getState().recoveryUndo).toBeNull();
  });
});
