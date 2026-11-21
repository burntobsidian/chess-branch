import { position } from "./repertoire";
export type Candidate = { rank: number; depth: number; score: string; moves: string[] };
let worker: Worker | null = null;
export function stopEngine() {
  worker?.terminate();
  worker = null;
}
export function analyze(
  moves: string[],
  onResult: (candidate: Candidate) => void,
  onError: (message: string) => void,
  onDone: () => void,
) {
  stopEngine();
  const chess = position(moves);
  const turn = chess.turn();
  const w = new Worker("/engine/stockfish.js");
  worker = w;
  const timeout = setTimeout(() => {
    stopEngine();
    onError("Analysis timed out. Try again.");
  }, 30000);
  w.onerror = () => {
    clearTimeout(timeout);
    stopEngine();
    onError("Engine could not load. Run vp install to prepare the local engine files.");
  };
  w.onmessage = (e) => {
    const line = String(e.data);
    if (line === "uciok") w.postMessage("isready");
    if (line === "readyok") {
      w.postMessage(`position fen ${chess.fen()}`);
      w.postMessage("go depth 16 movetime 6000");
    }
    if (line.startsWith("bestmove")) {
      clearTimeout(timeout);
      onDone();
      stopEngine();
    }
    const match = line.match(/depth (\d+).*multipv (\d+).*score (cp|mate) (-?\d+).* pv (.+)/);
    if (!match) return;
    const c = position(moves);
    const san: string[] = [];
    try {
      for (const m of match[5].trim().split(/\s+/)) san.push(c.move(m).san);
    } catch {
      return;
    }
    const score = Number(match[4]) * (turn === "w" ? 1 : -1);
    onResult({
      depth: Number(match[1]),
      rank: Number(match[2]),
      score:
        match[3] === "mate" ? `M${score}` : `${score >= 0 ? "+" : ""}${(score / 100).toFixed(2)}`,
      moves: san,
    });
  };
  w.postMessage("uci");
  w.postMessage("setoption name MultiPV value 3");
  return () => {
    clearTimeout(timeout);
    stopEngine();
  };
}
