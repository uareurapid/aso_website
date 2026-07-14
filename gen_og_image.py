#!/usr/bin/env python3
"""Generate og-image.png directly with Pillow — no browser, no fonts issues."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

# --- Colors ---
BG_TOP = (13, 13, 13)
BG_MID = (17, 17, 17)
BG_BOT = (26, 26, 26)
GOLD_LIGHT = (231, 216, 181)
GOLD = (201, 162, 74)
WHITE = (245, 240, 232)
SUBTLE = (245, 240, 232)
MUTED = (140, 135, 128)

# --- Fonts ---
SERIF = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SANS = "/Library/Fonts/SF-Pro.ttf"

import os

# Try common macOS sans-serif font paths
SANS_CANDIDATES = [
    "/Library/Fonts/SF-Pro.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/SFNS.ttf",
]
for c in SANS_CANDIDATES:
    if os.path.exists(c):
        SANS = c
        break

SERIF_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/System/Library/Fonts/SFGeorgian.ttf",
    "/System/Library/Fonts/Times.ttc",
]
for c in SERIF_CANDIDATES:
    if os.path.exists(c):
        SERIF = c
        break

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.truetype(SANS, size)

# --- Create gradient background ---
img = Image.new("RGB", (W, H), BG_MID)
draw = ImageDraw.Draw(img)

for y in range(H):
    t = y / H
    if t < 0.5:
        ratio = t / 0.5
        r = int(BG_TOP[0] + (BG_MID[0] - BG_TOP[0]) * ratio)
        g = int(BG_TOP[1] + (BG_MID[1] - BG_TOP[1]) * ratio)
        b = int(BG_TOP[2] + (BG_MID[2] - BG_TOP[2]) * ratio)
    else:
        ratio = (t - 0.5) / 0.5
        r = int(BG_MID[0] + (BG_BOT[0] - BG_MID[0]) * ratio)
        g = int(BG_MID[1] + (BG_BOT[1] - BG_MID[1]) * ratio)
        b = int(BG_MID[2] + (BG_BOT[2] - BG_MID[2]) * ratio)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# --- Subtle grid pattern ---
grid_color = (255, 255, 255, 8)
grid_overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
grid_draw = ImageDraw.Draw(grid_overlay)
for x in range(0, W, 60):
    grid_draw.line([(x, 0), (x, H)], fill=grid_color)
for y in range(0, H, 60):
    grid_draw.line([(0, y), (W, y)], fill=grid_color)
img = Image.alpha_composite(img.convert("RGBA"), grid_overlay).convert("RGB")
draw = ImageDraw.Draw(img)

# --- Glow orbs ---
orb1 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
orb1_draw = ImageDraw.Draw(orb1)
for radius in range(250, 0, -5):
    alpha = int(30 * (1 - radius / 250) ** 2)
    orb1_draw.ellipse(
        [W - 100 - radius, -150 - radius, W - 100 + radius, -150 + radius],
        fill=(201, 162, 74, alpha),
    )
img = Image.alpha_composite(img.convert("RGBA"), orb1).convert("RGB")

orb2 = Image.new("RGBA", (W, H), (0, 0, 0, 0))
orb2_draw = ImageDraw.Draw(orb2)
for radius in range(200, 0, -5):
    alpha = int(25 * (1 - radius / 200) ** 2)
    orb2_draw.ellipse(
        [-80 - radius, H + 120 - radius, -80 + radius, H + 120 + radius],
        fill=(231, 216, 181, alpha),
    )
img = Image.alpha_composite(img.convert("RGBA"), orb2).convert("RGB")
draw = ImageDraw.Draw(img)

# --- Layout constants ---
ICON_X = 72
ICON_Y = (H - 160) // 2
ICON_SIZE = 160
TEXT_X = ICON_X + ICON_SIZE + 56

# --- Icon container (dark rounded square) ---
draw.rounded_rectangle(
    [ICON_X, ICON_Y, ICON_X + ICON_SIZE, ICON_Y + ICON_SIZE],
    radius=24,
    fill=(17, 17, 17),
    outline=(201, 162, 74, 30),
    width=1,
)

# --- Draw the triangle/arrow icon (favicon-inspired) inside the container ---
# Scale from 32x32 viewBox to fit ~100px inside the 160px container
cx = ICON_X + ICON_SIZE // 2
cy = ICON_Y + ICON_SIZE // 2
scale = 2.8  # 32 * 2.8 ≈ 90px
ox = cx - 16 * scale  # offset to center
oy = cy - 16 * scale

def s(x, y):
    return (ox + x * scale, oy + y * scale)

# Inner dark triangle body
draw.polygon(
    [s(2, 30), s(16, 2), s(30, 30)],
    fill=(34, 34, 34),
)

# Inner arrow (M shape) - gold
arrow_pts = [s(8, 27), s(16, 9), s(24, 27)]
for i in range(len(arrow_pts) - 1):
    draw.line(
        [arrow_pts[i], arrow_pts[i + 1]],
        fill=GOLD,
        width=int(3 * scale / 3.2),
    )
# Make it thicker with parallel lines
offset = 1
for i in range(len(arrow_pts) - 1):
    draw.line(
        [arrow_pts[i], arrow_pts[i + 1]],
        fill=GOLD,
        width=int(3 * scale / 3.2),
    )

# Upward tail stroke
draw.line(
    [s(20, 15), s(27, 8)],
    fill=GOLD_LIGHT,
    width=int(3 * scale / 3.2),
)

# --- Brand label ---
brand_font = font(SANS, 20)
brand_text = "ASO ANALYTICS"
bbox = draw.textbbox((0, 0), brand_text, font=brand_font)
bw = bbox[2] - bbox[0]
draw.text((TEXT_X, 165), brand_text, font=brand_font, fill=GOLD)

# --- Headline (2 lines) ---
h1_font = font(SERIF, 44)
gold_font = font(SERIF, 44)
line1 = "App Store Optimization"
line2_a = "Intelligence for "
line2_b = "iOS Developers"

draw.text((TEXT_X, 205), line1, font=h1_font, fill=WHITE)

# Line 2 — measure "Intelligence for " then draw "iOS Developers" in gold
draw.text((TEXT_X, 265), line2_a, font=h1_font, fill=WHITE)
bbox_la = draw.textbbox((0, 0), line2_a, font=h1_font)
la_w = bbox_la[2] - bbox_la[0]
draw.text((TEXT_X + la_w, 265), line2_b, font=gold_font, fill=GOLD)

# --- Subtitle ---
sub_font = font(SANS, 20)
sub_lines = [
    "Track keyword rankings, monitor competitors, analyze",
    "performance intelligence, and grow your app's",
    "visibility — all in one place.",
]
sy = 330
for line in sub_lines:
    draw.text((TEXT_X, sy), line, font=sub_font, fill=MUTED)
    sy += 30

# --- Pills ---
pill_font = font(SANS, 15)
pills = ["Keyword Tracking", "Competitor Analysis", "Performance Analytics", "Screenshots Generator"]
px = TEXT_X
py = 440
for pill_text in pills:
    bbox = draw.textbbox((0, 0), pill_text, font=pill_font)
    tw = bbox[2] - bbox[0]
    pw = tw + 32
    ph = 32
    # Pill background
    draw.rounded_rectangle(
        [px, py, px + pw, py + ph],
        radius=16,
        fill=(201, 162, 74, 16),
        outline=(201, 162, 74, 30),
        width=1,
    )
    draw.text((px + 16, py + 6), pill_text, font=pill_font, fill=(201, 162, 74, 220))
    px += pw + 12

# --- Bottom bar ---
bar_font = font(SANS, 16)
draw.text((72, H - 50), "cristomade.it", font=bar_font, fill=(90, 88, 82))

logo_text = "CRISTOMADE"
bbox = draw.textbbox((0, 0), logo_text, font=bar_font)
lw = bbox[2] - bbox[0]
draw.text((W - 72 - lw, H - 50), logo_text, font=bar_font, fill=(201, 162, 74, 130))

# --- Save ---
output = "/Users/paulocristo/workspace/mines/MARKETING/WEBSITES/aso_website/og-image.png"
img.save(output, "PNG")
print(f"Saved: {output} ({W}x{H})")
