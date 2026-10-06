"""Local file receiver: the browser POSTs scraped page text here so it lands on disk, not in chat.
Usage: python receiver.py   (listens on 127.0.0.1:8765, writes under knowledge/raw/)"""
import json, pathlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).parent / "knowledge" / "raw"

class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        target = (ROOT / body["path"]).resolve()
        if ROOT.resolve() not in target.parents:
            self.send_response(400); self._cors(); self.end_headers(); return
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body["text"], encoding="utf-8")
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b"ok")

    def log_message(self, *a): pass

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
