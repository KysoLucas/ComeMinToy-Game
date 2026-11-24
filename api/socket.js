import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGameServer } from "../server/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const { server } = createGameServer({
  webRoot: path.resolve(here, "../public"),
});

function engineUrl(url = "/") {
  if (url.startsWith("/socket.io")) return url;
  const queryAt = url.indexOf("?");
  const pathname = queryAt === -1 ? url : url.slice(0, queryAt);
  const query = queryAt === -1 ? "" : url.slice(queryAt);
  if (pathname === "/api/socket" || pathname.startsWith("/api/socket/")) {
    return `/socket.io/${query}`;
  }
  return url;
}

function mapSocket(req) {
  req.url = engineUrl(req.url);
}

server.prependListener("request", mapSocket);
server.prependListener("upgrade", mapSocket);

export default server;
