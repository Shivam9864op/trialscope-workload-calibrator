import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8789);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".srt": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8" };

createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405, { Allow: "GET, HEAD" }).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname); }
  catch { response.writeHead(400).end("Bad request"); return; }
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try {
    const stat = statSync(target);
    if (!stat.isFile()) throw new Error("Not a file");
    const rangeHeader = request.headers.range;
    const rangeMatch = extname(target) === ".mp4" && rangeHeader?.match(/^bytes=(\d*)-(\d*)$/);
    if (rangeHeader && extname(target) === ".mp4") {
      if (!rangeMatch) { response.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end(); return; }
      const suffixLength = !rangeMatch[1] ? Number(rangeMatch[2]) : null;
      const start = rangeMatch[1] ? Number(rangeMatch[1]) : Math.max(0, stat.size - (suffixLength || 0));
      const end = rangeMatch[1] && rangeMatch[2] ? Math.min(Number(rangeMatch[2]), stat.size - 1) : stat.size - 1;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (suffixLength !== null && suffixLength <= 0) || start > end || start >= stat.size) { response.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end(); return; }
      response.writeHead(206, {
        "Content-Type": "video/mp4",
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; media-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
      });
      if (request.method === "HEAD") response.end(); else createReadStream(target, { start, end }).pipe(response);
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[extname(target)] || "application/octet-stream",
      "Content-Length": stat.size,
      "Accept-Ranges": extname(target) === ".mp4" ? "bytes" : "none",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'none'; media-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    if (request.method === "HEAD") response.end(); else createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, host, () => process.stdout.write(`TrialScope available at http://${host}:${port}\n`));
