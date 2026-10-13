"""Read-only reader for Medea key value stores (the *.ldb folders the NGS replay parser leaves behind).
Record layout (big endian): crc32 (4), timestamp (8), key size (2), value size (4), key, value.
Values are JSON text. Later records for a key replace earlier ones (ordered by timestamp, then file number).
Usage: python -I medea_reader.py <store dir>   prints a summary."""
import json, pathlib, struct, sys


def read_store(path):
    path = pathlib.Path(path)
    files = sorted(path.glob("*.medea.data"), key=lambda p: int(p.name.split(".")[0]))
    recs = {}
    bad = 0
    for f in files:
        d = f.read_bytes()
        i = 0
        while i + 18 <= len(d):
            ts = struct.unpack(">Q", d[i + 4:i + 12])[0]
            ks, vs = struct.unpack(">HI", d[i + 12:i + 18])
            end = i + 18 + ks + vs
            if end > len(d):
                bad += 1
                break
            key = d[i + 18:i + 18 + ks].decode("utf-8", "replace")
            val = d[i + 18 + ks:end]
            i = end
            prev = recs.get(key)
            if prev is None or ts >= prev[0]:
                recs[key] = (ts, val)
    out = {}
    for k, (ts, v) in recs.items():
        try:
            out[k] = json.loads(v.decode("utf-8"))
        except Exception:
            out[k] = None  # tombstone or non JSON value
    return out, bad


if __name__ == "__main__":
    for p in sys.argv[1:]:
        s, bad = read_store(p)
        print(p, "keys", len(s), "unreadable", bad, "none values", sum(v is None for v in s.values()))
        for k in list(s)[:2]:
            v = s[k]
            print("  ", k, type(v).__name__, (list(v)[:25] if isinstance(v, dict) else str(v)[:120]))
