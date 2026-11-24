import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGameServer } from "../server/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../public");
const { server } = createGameServer({ webRoot });

export default server;
