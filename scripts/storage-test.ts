import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const objects = new Map<string, Buffer>();
let failUpload = false;
const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost");
  const name = path.basename(url.pathname);
  if (req.method === "POST" && url.pathname.includes("/object/sign/")) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ signedURL: `/object/sign/comicklu-media/${name}?token=mock` }));
  } else if (req.method === "POST") {
    if (failUpload) { res.writeHead(500, {"Content-Type":"application/json"}); res.end('{"message":"unavailable"}'); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    objects.set(name, Buffer.concat(chunks));
    res.setHeader("Content-Type", "application/json"); res.end('{"Key":"ok"}');
  } else if (req.method === "DELETE") {
    let body = ""; for await (const chunk of req) body += chunk;
    for (const key of JSON.parse(body).prefixes) objects.delete(key);
    res.setHeader("Content-Type", "application/json"); res.end("[]");
  } else if (objects.has(name)) res.end(objects.get(name));
  else { res.statusCode = 404; res.end(); }
});
await new Promise<void>(resolve => mock.listen(0, "127.0.0.1", resolve));
const address = mock.address() as {port:number};
process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
process.env.SUPABASE_SECRET_KEY = "test-only-key";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "comicklu-storage-test-"));
process.env.UPLOAD_DIR = path.join(temporary, "cache");
try {
  const { saveBuffer, materializeMedia, deleteMedia, localPathFromUrl } = await import("../server/files");
  const content = Buffer.from("persisted-image-test");
  const url = await saveBuffer(content, "png");
  assert.equal(objects.size, 1);
  await assert.rejects(fs.stat(path.join(temporary, "cache")));
  const file = await materializeMedia(url, temporary);
  assert.deepEqual(await fs.readFile(file!), content);
  assert.equal(localPathFromUrl("/media/../../secret"), null);
  await deleteMedia(url);
  assert.equal(objects.size, 0);
  failUpload = true;
  await assert.rejects(saveBuffer(content, "png"));
  await assert.rejects(saveBuffer(content, "html"));
  console.log("Storage: remote persistence, render download, deletion and failed upload verified");
} finally {
  mock.closeAllConnections();
  await new Promise<void>(resolve => mock.close(() => resolve()));
  await fs.rm(temporary, {recursive:true, force:true});
}
