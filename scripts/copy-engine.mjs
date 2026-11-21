import { readdir, mkdir, copyFile, writeFile } from "node:fs/promises";
const root = new URL("../node_modules/stockfish/bin/", import.meta.url);
const files = await readdir(root);
const js = files.find((f) => /lite-single.*\.js$/.test(f));
if (!js) throw new Error("Stockfish lite single-thread build missing");
const out = new URL("../public/engine/", import.meta.url);
await mkdir(out, { recursive: true });
for (const f of files.filter((f) => f.startsWith(js.slice(0, -3))))
  await copyFile(new URL(f, root), new URL(f, out));
await writeFile(new URL("stockfish.js", out), `importScripts('./${js}');\n`);
await copyFile(
  new URL("../node_modules/stockfish/Copying.txt", import.meta.url),
  new URL("LICENSE.txt", out),
).catch(() => {});

await copyFile(new URL(js.replace(/\.js$/, ".wasm"), root), new URL("stockfish.wasm", out));
