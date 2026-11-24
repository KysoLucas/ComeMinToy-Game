import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGameServer } from "../server/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const { server } = createGameServer({
  webRoot: path.resolve(here, "../public"),
});

export default server;
