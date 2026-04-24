#!/usr/bin/env python3
"""Generate resources/icons/icon.png for TMUX Manager without external dependencies."""

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'icons' / 'icon.png'
W = H = 256
img = [[(17, 24, 39, 255) for _ in range(W)] for _ in range(H)]


def rect(x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(H, y1)):
        row = img[y]
        for x in range(max(0, x0), min(W, x1)):
            row[x] = c


def border(x0, y0, x1, y1, t, c):
    rect(x0, y0, x1, y0 + t, c)
    rect(x0, y1 - t, x1, y1, c)
    rect(x0, y0, x0 + t, y1, c)
    rect(x1 - t, y0, x1, y1, c)


def line_h(x0, x1, y, t, c):
    rect(x0, y - t // 2, x1, y + (t + 1) // 2, c)


for y in range(H):
    for x in range(W):
        a = (x + y) / (2 * (W - 1))
        img[y][x] = (int(17 + 14 * a), int(24 + 17 * a), int(39 + 16 * a), 255)

rect(34, 48, 222, 208, (2, 6, 23, 255))
border(34, 48, 222, 208, 8, (34, 211, 238, 255))
rect(42, 56, 214, 80, (15, 23, 42, 255))

for cx, cy, c in [
    (58, 64, (248, 113, 113, 255)),
    (78, 64, (251, 191, 36, 255)),
    (98, 64, (52, 211, 153, 255)),
]:
    for yy in range(cy - 5, cy + 6):
        for xx in range(cx - 5, cx + 6):
            if (xx - cx) ** 2 + (yy - cy) ** 2 <= 25:
                img[yy][xx] = c

accent = (56, 189, 248, 255)
pane = (15, 23, 42, 255)
rect(64, 112, 118, 176, pane)
border(64, 112, 118, 176, 4, accent)
rect(138, 112, 192, 138, pane)
border(138, 112, 192, 138, 4, accent)
rect(138, 154, 192, 176, pane)
border(138, 154, 192, 176, 4, accent)

line_h(75, 91, 132, 6, (52, 211, 153, 255))
line_h(75, 91, 156, 6, (52, 211, 153, 255))
line_h(102, 124, 158, 8, (229, 231, 235, 255))
rect(150, 118, 180, 123, (229, 231, 235, 255))
rect(162, 118, 168, 136, (229, 231, 235, 255))
rect(182, 118, 188, 136, (229, 231, 235, 255))
rect(188, 124, 194, 130, (229, 231, 235, 255))
rect(194, 118, 200, 136, (229, 231, 235, 255))
line_h(152, 180, 164, 7, (52, 211, 153, 255))

raw = b''.join(b'\x00' + bytes(sum((list(px) for px in row), [])) for row in img)


def chunk(tag, data):
    return (
        struct.pack('>I', len(data))
        + tag
        + data
        + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    )

png = (
    b'\x89PNG\r\n\x1a\n'
    + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
    + chunk(b'IDAT', zlib.compress(raw, 9))
    + chunk(b'IEND', b'')
)
OUT.write_bytes(png)
print(OUT)
