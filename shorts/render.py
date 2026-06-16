"""Frame rendering for the BOMB gameplay short (1080x1920 vertical).

Draws the game board in a style matching the BOMB web game:
dark navy background, red accents, hand-drawn bomb / apple icons,
3 player panels, declaration overlay, emote popups and a subtitle bar.
"""
from __future__ import annotations
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920

# Palette (matches the BOMB web game / blog)
BG = (26, 28, 48)
BG2 = (34, 37, 64)
RED = (220, 38, 38)
GREEN = (34, 197, 94)
GOLD = (255, 212, 59)
WHITE = (255, 255, 255)
MUTED = (255, 255, 255)

PLAYER_COLORS = {
    "red": (235, 64, 80),
    "blue": (66, 135, 245),
    "green": (52, 199, 120),
    "yellow": (240, 200, 70),
}

FONT_PATH = "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf"


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


F_TITLE = font(96)
F_H1 = font(64)
F_H2 = font(48)
F_NAME = font(40)
F_BODY = font(46)
F_SMALL = font(32)
F_TINY = font(26)
F_BIG = font(180)
F_BID = font(56)


def _i(seq):
    return [int(round(v)) for v in seq]


def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(_i(box), radius=int(radius), fill=fill,
                           outline=outline, width=width)


def text_center(draw, cx, y, text, fnt, fill, anchor="ma"):
    draw.text((cx, y), text, font=fnt, fill=fill, anchor=anchor)


def wrap_jp(text, fnt, max_w, draw):
    """Wrap Japanese text (no spaces) by measured width."""
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        test = cur + ch
        if draw.textlength(test, font=fnt) > max_w and cur:
            lines.append(cur)
            cur = ch
        else:
            cur = test
    if cur:
        lines.append(cur)
    return lines


# ---------- icons ----------

def draw_bomb(draw, cx, cy, r, lit=False):
    w12 = max(2, int(r // 12)); w10 = max(3, int(r // 10))
    # body
    draw.ellipse(_i([cx - r, cy - r, cx + r, cy + r]), fill=(20, 22, 30),
                 outline=(70, 74, 95), width=w12)
    # highlight
    hr = r * 0.34
    draw.ellipse(_i([cx - r * 0.45 - hr, cy - r * 0.45 - hr,
                  cx - r * 0.45 + hr, cy - r * 0.45 + hr]), fill=(70, 74, 95))
    # fuse cap
    cap = r * 0.42
    draw.rectangle(_i([cx - cap * 0.5, cy - r - cap * 0.6, cx + cap * 0.5, cy - r + cap * 0.2]),
                   fill=(90, 60, 30))
    # fuse
    draw.arc(_i([cx - 2, cy - r - cap * 1.9, cx + cap * 2.2, cy - r - cap * 0.2]),
             200, 20, fill=(150, 110, 60), width=w10)
    # spark
    sx, sy = cx + cap * 1.7, cy - r - cap * 1.4
    if lit:
        for a in range(0, 360, 45):
            ex = sx + math.cos(math.radians(a)) * r * 0.5
            ey = sy + math.sin(math.radians(a)) * r * 0.5
            draw.line(_i([sx, sy, ex, ey]), fill=GOLD, width=w10)
    draw.ellipse(_i([sx - r * 0.22, sy - r * 0.22, sx + r * 0.22, sy + r * 0.22]),
                 fill=(255, 160, 40) if lit else (200, 90, 40))


def draw_apple(draw, cx, cy, r):
    col = (225, 55, 60)
    w9 = max(3, int(r // 9))
    draw.ellipse(_i([cx - r, cy - r * 0.92, cx - r * 0.02, cy + r]), fill=col)
    draw.ellipse(_i([cx + r * 0.02, cy - r * 0.92, cx + r, cy + r]), fill=col)
    # dimple
    draw.ellipse(_i([cx - r * 0.12, cy - r, cx + r * 0.12, cy - r * 0.7]), fill=BG)
    # stem
    draw.line(_i([cx, cy - r * 0.85, cx + r * 0.08, cy - r * 1.25]),
              fill=(110, 70, 40), width=w9)
    # leaf
    draw.ellipse(_i([cx + r * 0.05, cy - r * 1.25, cx + r * 0.6, cy - r * 0.9]), fill=GREEN)
    # shine
    draw.ellipse(_i([cx - r * 0.55, cy - r * 0.55, cx - r * 0.2, cy - r * 0.1]),
                 fill=(255, 180, 180))


def draw_card(draw, x, y, w, h, kind, flipped, lit=False):
    """kind: 'back' | 'apple' | 'bomb'. flipped=True shows the face."""
    if not flipped:
        rounded(draw, [x, y, x + w, y + h], 16, fill=(46, 21, 21),
                outline=(150, 50, 50), width=3)
        # back pattern: faint ?
        text_center(draw, x + w / 2, y + h / 2 - F_H2.size / 2, "?", F_H2,
                    (180, 90, 90), anchor="ma")
        return
    if kind == "bomb":
        rounded(draw, [x, y, x + w, y + h], 16, fill=(61, 10, 10),
                outline=RED, width=4)
        draw_bomb(draw, x + w / 2, y + h / 2, min(w, h) * 0.30, lit=lit)
    else:
        rounded(draw, [x, y, x + w, y + h], 16, fill=(10, 42, 10),
                outline=GREEN, width=3)
        draw_apple(draw, x + w / 2, y + h / 2, min(w, h) * 0.28)


# ---------- panels ----------

def draw_header(draw, round_no, phase_label):
    rounded(draw, [30, 28, W - 30, 200], 28, fill=BG2, outline=(60, 64, 92), width=2)
    draw_bomb(draw, 120, 114, 52, lit=True)
    draw.text((210, 58), "BOMB", font=F_TITLE, fill=WHITE)
    draw.text((212, 150), "ブラフ心理戦バトル", font=F_SMALL, fill=(180, 184, 210))
    # phase / round chip
    rounded(draw, [W - 360, 60, W - 60, 168], 22, fill=(61, 26, 26), outline=RED, width=2)
    text_center(draw, W - 210, 74, f"ROUND {round_no}", F_SMALL, GOLD)
    text_center(draw, W - 210, 112, phase_label, F_NAME, WHITE)


def draw_player_panel(draw, x, y, w, h, p, speaking=False, flip_lit_idx=None):
    col = PLAYER_COLORS[p["color"]]
    if p.get("eliminated"):
        fill, oc, ow = (30, 30, 38), (70, 70, 80), 2
    elif speaking:
        fill, oc, ow = (44, 47, 78), GOLD, 5
    else:
        fill, oc, ow = BG2, (60, 64, 92), 2
    rounded(draw, [x, y, x + w, y + h], 26, fill=fill, outline=oc, width=ow)

    # color chip + name + points
    draw.ellipse(_i([x + 28, y + 30, x + 28 + 44, y + 30 + 44]), fill=col)
    draw.text((x + 92, y + 28), p["name"], font=F_NAME, fill=WHITE)
    # win points (stars)
    for i in range(2):
        sx = x + w - 60 - i * 46
        c = GOLD if i < p.get("points", 0) else (70, 74, 95)
        draw_star(draw, sx, y + 50, 18, c)

    # bid badge
    if p.get("bid") is not None:
        bx = x + w - 230
        rounded(draw, [bx, y + 28, bx + 150, y + 90], 18,
                fill=(61, 26, 26), outline=RED, width=2)
        text_center(draw, bx + 75, y + 30, f"宣言{p['bid']}", F_BID, WHITE)
    elif p.get("folded"):
        bx = x + w - 230
        rounded(draw, [bx, y + 28, bx + 150, y + 90], 18,
                fill=(40, 40, 48), outline=(90, 94, 110), width=2)
        text_center(draw, bx + 75, y + 36, "パス", F_BID, (150, 154, 170))

    # card stack
    stack = p.get("stack", [])
    cw, ch = 132, 168
    gap = 26
    total = len(stack) * cw + max(0, len(stack) - 1) * gap
    sx = x + (w - total) / 2
    sy = y + h - ch - 36
    for i, c in enumerate(stack):
        lit = (flip_lit_idx is not None and i == flip_lit_idx and c["kind"] == "bomb")
        draw_card(draw, sx + i * (cw + gap), sy, cw, ch,
                  c["kind"], c.get("flipped", False), lit=lit)
    if not stack:
        text_center(draw, x + w / 2, sy + ch / 2 - 24, "脱落", F_H2, (120, 124, 140))


def draw_star(draw, cx, cy, r, fill):
    pts = []
    for i in range(10):
        ang = math.radians(-90 + i * 36)
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((int(cx + math.cos(ang) * rr), int(cy + math.sin(ang) * rr)))
    draw.polygon(pts, fill=fill)


def draw_emote(draw, x, y, kind):
    rounded(draw, [x, y, x + 110, y + 110], 24, fill=(255, 255, 255, 0))
    rounded(draw, [x, y, x + 110, y + 110], 24, fill=BG2, outline=GOLD, width=3)
    if kind == "bomb":
        draw_bomb(draw, x + 55, y + 58, 34, lit=True)
    else:
        draw_apple(draw, x + 55, y + 58, 30)


def draw_subtitle(draw, speaker_name, speaker_color, text):
    box_top = 1610
    rounded(draw, [30, box_top, W - 30, H - 40], 30, fill=(18, 19, 34),
            outline=(60, 64, 92), width=2)
    if speaker_name:
        chip_w = draw.textlength(speaker_name, font=F_NAME) + 56
        rounded(draw, [60, box_top - 34, 60 + chip_w, box_top + 34], 18,
                fill=speaker_color)
        draw.text((60 + chip_w / 2, box_top - 32), speaker_name, font=F_NAME,
                  fill=WHITE, anchor="ma")
    lines = wrap_jp(text, F_BODY, W - 130, draw)
    ty = box_top + 44 if len(lines) > 1 else box_top + 72
    for ln in lines[:3]:
        text_center(draw, W / 2, ty, ln, F_BODY, WHITE, anchor="ma")
        ty += 70


def base_frame():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    # subtle vignette stripes
    for i in range(0, H, 4):
        pass
    return img, d


def render_game(state):
    """state dict -> PIL image for an in-game beat."""
    img, d = base_frame()
    draw_header(d, state.get("round", 1), state.get("phase", ""))
    players = state["players"]
    # 3 vertical panels
    top = 230
    bottom = 1590
    n = len(players)
    gap = 22
    ph = (bottom - top - gap * (n - 1)) / n
    speaking = state.get("speaking")
    flip = state.get("flip_lit", {})  # {player_name: idx}
    for i, p in enumerate(players):
        y = top + i * (ph + gap)
        draw_player_panel(d, 30, y, W - 60, ph, p,
                          speaking=(p["name"] == speaking),
                          flip_lit_idx=flip.get(p["name"]))
        # emote popup
        em = state.get("emote")
        if em and em[0] == p["name"]:
            draw_emote(d, W - 200, y + 110, em[1])
    # declaration overlay
    if state.get("declare"):
        ov_y = top + ph + gap / 2
        text_center(d, W / 2, top + (bottom - top) / 2 - 150, "宣言", F_H2, GOLD, anchor="mm")
        text_center(d, W / 2, top + (bottom - top) / 2, str(state["declare"]),
                    F_BIG, RED, anchor="mm")
        text_center(d, W / 2, top + (bottom - top) / 2 + 120, "枚めくる！", F_H2, WHITE, anchor="mm")
    sub = state.get("subtitle")
    if sub:
        spk = state.get("sub_speaker", ("", BG2))
        draw_subtitle(d, spk[0], spk[1], sub)
    return img


def render_title(text, sub, accent=RED, big_icon="bomb"):
    img, d = base_frame()
    cx = W / 2
    if big_icon == "bomb":
        draw_bomb(d, cx, 560, 180, lit=True)
    text_center(d, cx, 800, "BOMB", F_TITLE, WHITE, anchor="ma")
    lines = wrap_jp(text, F_H1, W - 160, d)
    ty = 960
    for ln in lines:
        text_center(d, cx, ty, ln, F_H1, accent, anchor="ma")
        ty += 88
    if sub:
        slines = wrap_jp(sub, F_H2, W - 200, d)
        ty += 30
        for ln in slines:
            text_center(d, cx, ty, ln, F_H2, WHITE, anchor="ma")
            ty += 70
    return img


def render_rules(items):
    """Quick 2-second rules splash."""
    img, d = base_frame()
    cx = W / 2
    text_center(d, cx, 180, "ルールは超カンタン", F_H1, GOLD, anchor="ma")
    # two cards
    draw_card(d, cx - 360, 360, 300, 380, "bomb", True)
    draw_card(d, cx + 60, 360, 300, 380, "apple", True)
    text_center(d, cx - 210, 770, "爆弾=アウト", F_H2, RED, anchor="ma")
    text_center(d, cx + 210, 770, "りんご=安全", F_H2, GREEN, anchor="ma")
    ty = 920
    for it in items:
        lines = wrap_jp(it, F_BODY, W - 160, d)
        for ln in lines:
            text_center(d, cx, ty, ln, F_BODY, WHITE, anchor="ma")
            ty += 66
        ty += 18
    return img


def render_outro():
    img, d = base_frame()
    cx = W / 2
    draw_bomb(d, cx, 470, 150, lit=True)
    text_center(d, cx, 660, "今すぐ無料で遊べる！", F_H1, GOLD, anchor="ma")
    text_center(d, cx, 770, "登録不要・ブラウザで即プレイ", F_H2, WHITE, anchor="ma")
    # CTA button
    rounded(d, [120, 940, W - 120, 1120], 90, fill=RED)
    text_center(d, cx, 980, "ボードゲーム広場", F_H1, WHITE, anchor="ma")
    text_center(d, cx, 1230, "bomb.boardgamecat.com", F_H2, GOLD, anchor="ma")
    text_center(d, cx, 1380, "BOMB・謀略・ページワン etc.", F_SMALL, (180, 184, 210), anchor="ma")
    return img
