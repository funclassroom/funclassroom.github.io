#!/usr/bin/env python3
"""Write each duplicated runtime bundle once, instead of once per game.

The offline pack ships every Flash title as a self-contained page. That is the
right shape for a single game, but 26 of them carry the same three Ruffle
distributions: 157 MB of base64 standing in for 13.6 MB of files.

This walks assets/games/, finds zip payloads that appear in more than one
page, writes each one to assets/vendor/ruffle/<sha12>.zip, and repoints the
pages at that shared copy. The page keeps its own inline SWF, its own markup
and its own loader; only the bytes that were identical now come from one URL.

Run it after adding games to the folder. It is idempotent: a page that already
points at a vendor zip has no data URI left to find, so a second run changes
nothing.

    python3 scripts/share-runtime.py [--check]
"""

import base64
import collections
import hashlib
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES = os.path.join(ROOT, "assets", "games")
VENDOR = os.path.join(ROOT, "assets", "vendor", "ruffle")

PAYLOAD = re.compile(
    rb'"data:application/(?:x-zip-compressed|zip)[^",]*;base64,([A-Za-z0-9+/=]{200,})"'
)

# How the pack decodes the payload. Replaced with a version that takes a URL
# and leaves the data-URI path alone, so pages that still embed a payload keep
# working. Some pages use CRLF, so the match accepts either line ending.
DECODE_OLD_LINES = [
    "const base64 = dataUri.split(',')[1];",
    "    const binaryString = atob(base64);",
    "    const len = binaryString.length;",
    "    const bytes = new Uint8Array(len);",
    "    for (let i = 0; i < len; i++) {",
    "        bytes[i] = binaryString.charCodeAt(i);",
    "    }",
]
DECODE_NEW_LINES = [
    'const bytes = dataUri.startsWith("data:")',
    '        ? Uint8Array.from(atob(dataUri.split(",")[1]), (ch) => ch.charCodeAt(0))',
    "        : new Uint8Array(await (await fetch(dataUri)).arrayBuffer());",
]
DECODE_OLD_RE = re.compile(
    rb"\r?\n".join(re.escape(line.encode("utf-8")) for line in DECODE_OLD_LINES)
)


def decode_block(newline):
    return newline.join(line.encode("utf-8") for line in DECODE_NEW_LINES)


def pages():
    for name in sorted(os.listdir(GAMES)):
        if name.endswith((".html", ".htm")):
            yield name, os.path.join(GAMES, name)


def main(check_only=False):
    found = collections.defaultdict(list)
    texts = {}

    for name, path in pages():
        with open(path, "rb") as handle:
            text = handle.read()
        texts[name] = text
        for match in PAYLOAD.finditer(text):
            raw = match.group(1)
            data = base64.b64decode(raw + b"=" * (-len(raw) % 4))
            found[hashlib.sha1(data).hexdigest()].append((name, match))

    before = sum(os.path.getsize(os.path.join(GAMES, name)) for name in texts)

    shared = {digest: rows for digest, rows in found.items() if len(rows) > 1}
    if not shared:
        print("every payload is unique — nothing to share")
        return 0

    freed = 0
    written = 0
    touched = set()
    for digest, rows in sorted(shared.items(), key=lambda item: -len(item[1])):
        name, match = rows[0]
        raw = match.group(1)
        data = base64.b64decode(raw + b"=" * (-len(raw) % 4))
        target = os.path.join(VENDOR, digest[:12] + ".zip")
        exists = os.path.exists(target)
        if not check_only and not exists:
            os.makedirs(VENDOR, exist_ok=True)
            with open(target, "wb") as handle:
                handle.write(data)
            written += 1

        for name, match in rows:
            text = texts[name]
            text = text.replace(match.group(0), b'"../vendor/ruffle/%s.zip"' % digest[:12].encode("ascii"), 1)
            if len(DECODE_OLD_RE.findall(text)) != 1:
                raise SystemExit("%s: loader no longer matches the expected shape" % name)
            newline = b"\r\n" if b"\r\n" in text else b"\n"
            text = DECODE_OLD_RE.sub(lambda _match: decode_block(newline), text, count=1)
            texts[name] = text
            touched.add(name)

        print("%-18s %5.2f MB  shared by %2d pages" % (digest[:12] + ".zip", len(data) / 1048576, len(rows)))

    if check_only:
        print("\n%d shared payloads would move to %s" % (len(shared), os.path.relpath(VENDOR, ROOT)))
        return 0

    for name in touched:
        with open(os.path.join(GAMES, name), "wb") as handle:
            handle.write(texts[name])

    after = sum(os.path.getsize(os.path.join(GAMES, name)) for name in texts)
    vendor = sum(os.path.getsize(os.path.join(VENDOR, name)) for name in os.listdir(VENDOR))
    print("\n%d vendor files written, %d pages repointed" % (written, sum(len(rows) for rows in shared.values())))
    print("games folder %.1f MB -> %.1f MB, vendor folder %.1f MB, net %.1f MB freed" % (
        before / 1048576, after / 1048576, vendor / 1048576, (before - after - vendor) / 1048576))
    return 0


if __name__ == "__main__":
    sys.exit(main(check_only="--check" in sys.argv))
