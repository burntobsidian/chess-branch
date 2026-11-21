import { Chess } from "chess.js";
import { parse } from "@mliebelt/pgn-parser";
export type Opening = { id: string; name: string };
export type Line = {
  id: string;
  name: string;
  moves: string[];
  openingId: string;
  openingName?: string;
};
export type Attempt = {
  id: string;
  lineId: string;
  name: string;
  moves: string[];
  side: "white" | "black";
  mistakes: number;
  hints: number;
  completed: boolean;
  date: string;
};
export type Library = { version: 2; openings: Opening[]; lines: Line[]; attempts: Attempt[] };
export const initialLibrary = (): Library => ({
  version: 2,
  openings: [],
  lines: [],
  attempts: [],
});
export function position(moves: string[]) {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  return chess;
}
export function normalize(moves: string[]) {
  const c = new Chess();
  return moves.map((m) => c.move(m).san);
}
// Old PGN imports explicitly named branches “<main name> · variation N”.
// Shared moves, similar names, and matching first moves are NOT evidence of ownership.
export function separationPlan(lines: { id: string; name: string }[]) {
  const groups = new Map<string, { name: string; lineIds: string[] }>();
  for (const line of lines) {
    let root = line;
    while (/ · variation \d+$/.test(root.name)) {
      const parent = lines.find((l) => l.name === root.name.replace(/ · variation \d+$/, ""));
      if (!parent) break;
      root = parent;
    }
    const group = groups.get(root.id) ?? { name: root.name, lineIds: [] };
    group.lineIds.push(line.id);
    groups.set(root.id, group);
  }
  return [...groups.values()];
}
export function separateOpening(library: Library, openingId: string): Library {
  const original = library.openings.find((o) => o.id === openingId);
  if (!original) throw new Error("Opening not found.");
  const groups = separationPlan(library.lines.filter((l) => l.openingId === openingId));
  if (groups.length < 2) return library;
  const replacements = groups.map((g) => ({ id: crypto.randomUUID(), name: g.name }));
  return {
    ...library,
    openings: library.openings.flatMap((o) => (o.id === openingId ? replacements : [o])),
    lines: library.lines.map((l) => {
      if (l.openingId !== openingId) return l;
      return {
        ...l,
        openingId: replacements[groups.findIndex((g) => g.lineIds.includes(l.id))].id,
      };
    }),
  };
}
export function validateLibrary(input: unknown): Library {
  let d = structuredClone(input) as Library;
  if (
    d &&
    (d as { version: number }).version === 1 &&
    Array.isArray(d.lines) &&
    Array.isArray(d.attempts)
  ) {
    for (const line of d.lines) {
      if (
        !line ||
        typeof line.id !== "string" ||
        typeof line.name !== "string" ||
        !Array.isArray(line.moves)
      )
        throw new Error("Invalid saved line.");
    }
    const groups = separationPlan(d.lines);
    const openings = groups.map((g) => ({ id: `legacy-opening:${g.lineIds[0]}`, name: g.name }));
    const migrated = d.lines.map((line) => ({
      ...line,
      openingId: openings[groups.findIndex((g) => g.lineIds.includes(line.id))].id,
    }));
    d = { ...d, version: 2, openings, lines: migrated };
  }
  if (!d || d.version !== 2 || !Array.isArray(d.lines) || !Array.isArray(d.attempts))
    throw new Error("This is not a supported Branch backup.");
  if (!Array.isArray(d.openings)) throw new Error("Invalid openings.");
  const openingIds = new Set<string>();
  for (const o of d.openings) {
    if (
      !o ||
      typeof o.id !== "string" ||
      openingIds.has(o.id) ||
      typeof o.name !== "string" ||
      !o.name.trim()
    )
      throw new Error("Invalid opening.");
    openingIds.add(o.id);
  }
  const ids = new Set<string>();
  for (const l of d.lines) {
    if (
      !l ||
      !openingIds.has(l.openingId) ||
      typeof l.id !== "string" ||
      ids.has(l.id) ||
      typeof l.name !== "string" ||
      !Array.isArray(l.moves) ||
      !l.moves.every((m) => typeof m === "string") ||
      !l.moves.length
    )
      throw new Error("Invalid saved line.");
    normalize(l.moves);
    ids.add(l.id);
  }
  for (const a of d.attempts) {
    if (
      typeof a.id !== "string" ||
      typeof a.lineId !== "string" ||
      typeof a.name !== "string" ||
      !Array.isArray(a.moves) ||
      !a.moves.every((m) => typeof m === "string") ||
      !["white", "black"].includes(a.side) ||
      !Number.isFinite(a.mistakes) ||
      !Number.isFinite(a.hints) ||
      typeof a.completed !== "boolean" ||
      typeof a.date !== "string"
    )
      throw new Error("Invalid practice history.");
    normalize(a.moves);
  }
  return structuredClone(d);
}
export function exportPgn(lines: { name: string; moves: string[]; openingName?: string }[]) {
  return lines
    .map((l) => {
      const c = position(l.moves);
      c.header("Event", l.openingName ?? l.name, "Site", "Branch", "Result", "*");
      if (l.openingName) c.header("Variation", l.name);
      return c.pgn();
    })
    .join("\n\n");
}
type PgnMove = { notation: { notation: string }; variations?: PgnMove[][] };
function paths(nodes: PgnMove[], prefix: string[] = []): string[][] {
  let current = [...prefix];
  const branches: string[][] = [];
  for (const node of nodes) {
    for (const variation of node.variations ?? []) branches.push(...paths(variation, current));
    current.push(node.notation.notation);
  }
  return [...(current.length ? [current] : []), ...branches];
}
export function importPgn(text: string): Line[] {
  const games = parse(text, { startRule: "games" }) as unknown as {
    tags?: { Event?: string; FEN?: string; Variant?: string; Variation?: string };
    moves: PgnMove[];
  }[];
  if (games.some((g) => g.tags?.FEN || (g.tags?.Variant && g.tags.Variant !== "Standard")))
    throw new Error("Custom starting positions and variants are not supported yet.");
  const lines = games.flatMap((g, i) => {
    const openingId = crypto.randomUUID();
    const openingName =
      g.tags?.Event && g.tags.Event !== "?" ? g.tags.Event : `Imported opening ${i + 1}`;
    return paths(g.moves).map((moves, j) => ({
      id: crypto.randomUUID(),
      openingId,
      openingName,
      name: j ? `Variation ${j}` : (g.tags?.Variation ?? openingName),
      moves: normalize(moves),
    }));
  });
  if (!lines.length) throw new Error("No moves found. Paste a line such as 1. e4 e5 2. Nf3.");
  return lines;
}
