import { position } from "./repertoire";
export type Side = "white" | "black";
export function nextDecision(moves: string[], cursor: number, side: Side) {
  let next = cursor;
  while (
    next < moves.length &&
    position(moves.slice(0, next)).turn() !== (side === "white" ? "w" : "b")
  )
    next++;
  return next;
}
