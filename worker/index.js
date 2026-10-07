/**
 * A few lines of code in front of the video files, and nothing else.
 *
 * Cloudflare's static assets answer every request with the whole file: 200,
 * no `Accept-Ranges`. A browser needs Range requests (206 Partial Content)
 * to seek inside a video, and Safari and iOS refuse to play an MP4 at all
 * from a server that does not offer them.
 *
 * Caddy does this on its own, which is why the Caddyfile has nothing like
 * this. Everything that is not a video is served straight from storage
 * without running this code — see `run_worker_first` in wrangler.jsonc.
 */
const worker = {
  async fetch(request, env) {
    // A static site only ever needs GET and HEAD.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const res = await env.ASSETS.fetch(request);
    const range = request.headers.get("Range");

    // Not a range request, or nothing to slice: serve as-is, but say that
    // seeking is possible.
    if (request.method === "HEAD" || !range || res.status !== 200) {
      const headers = new Headers(res.headers);
      if (res.status === 200) headers.set("Accept-Ranges", "bytes");
      return new Response(res.body, { status: res.status, headers });
    }

    // One "bytes=start-end", "bytes=start-" or "bytes=-suffix", no more.
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) return res;

    const body = await res.arrayBuffer();
    const size = body.byteLength;

    let start;
    let end;
    if (match[1] === "") {
      // "bytes=-N": the last N bytes.
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    }

    if (start >= size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }

    const headers = new Headers(res.headers);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};

export default worker;
