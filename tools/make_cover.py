"""Делает обложку страницы (для превью в соцсетях, поиске и первого экрана), если своих картинок нет.

Запуск: python tools/make_cover.py <папка> "<Название>" "<подпись>"
Создаёт <папка>/img/<папка>-oblozhka-640.webp и -1200.webp. Нужен Pillow (pip install pillow).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

FONTS = ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf',
         '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
FONTS_R = ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf',
           '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
           '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
PALETTES = [((15, 26, 51), (29, 78, 216)), ((20, 24, 60), (124, 58, 237)), ((10, 40, 45), (15, 118, 110)),
            ((40, 20, 30), (190, 18, 60)), ((30, 30, 20), (180, 83, 9)), ((12, 30, 60), (2, 132, 199))]


def font(cands, size):
    for f in cands:
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def make(folder, title, sub):
    W, H = 1200, 630
    a, b = PALETTES[sum(map(ord, folder)) % len(PALETTES)]
    im = Image.new('RGB', (W, H), a)
    px = im.load()
    for x in range(W):
        for y in range(0, H, 1):
            t = (x / W) * 0.75 + (y / H) * 0.25
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
    d = ImageDraw.Draw(im)
    # декоративные круги
    for cx, cy, r, al in [(1050, 120, 220, 28), (980, 560, 160, 22), (120, 600, 120, 18)]:
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(ov).ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, al))
        im.paste(ov, (0, 0), ov)
    d = ImageDraw.Draw(im)
    # значок сайта
    gx, gy, k = 70, 70, 1.6
    d.rounded_rectangle((gx, gy, gx + 64 * k, gy + 64 * k), radius=14 * k, fill=(15, 26, 51))
    P = lambda pts: [(gx + x * k, gy + y * k) for x, y in pts]
    d.polygon(P([(32, 10), (52, 26), (32, 54), (12, 26)]), fill=(47, 107, 255))
    d.polygon(P([(32, 10), (40, 26), (32, 54), (24, 26)]), fill=(122, 162, 255))
    d.text((gx + 64 * k + 22, gy + 30), 'Digital World', font=font(FONTS, 34), fill=(220, 230, 250))
    size = 78
    while size > 44:
        f = font(FONTS, size)
        lines = wrap(d, title, f, W - 160)
        if len(lines) <= 3:
            break
        size -= 6
    y = 250 if len(lines) < 3 else 215
    for ln in lines:
        d.text((70, y), ln, font=f, fill=(255, 255, 255))
        y += int(size * 1.15)
    d.text((70, y + 18), sub, font=font(FONTS_R, 34), fill=(205, 220, 245))
    os.makedirs(os.path.join(folder, 'img'), exist_ok=True)
    for w in (640, 1200):
        r = im.resize((w, round(H * w / W)), Image.LANCZOS)
        r.save(os.path.join(folder, 'img', '%s-oblozhka-%d.webp' % (folder, w)), 'WEBP', quality=80, method=6)


if __name__ == '__main__':
    make(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '')
