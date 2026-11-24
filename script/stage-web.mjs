import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const from = path.join(root, "client/build/web");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });
await cp(from, dist, { recursive: true });
