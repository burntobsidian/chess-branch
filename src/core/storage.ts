import { openDB } from "idb";
import { initialLibrary, validateLibrary, type Library } from "./repertoire";
const db = () =>
  openDB("branch-chess", 1, {
    upgrade(db) {
      db.createObjectStore("library");
    },
  });
export async function loadLibrary() {
  return validateLibrary((await (await db()).get("library", "main")) ?? initialLibrary());
}
export async function saveLibrary(value: Library) {
  await (await db()).put("library", value, "main");
}
