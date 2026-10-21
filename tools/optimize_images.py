"""Автосжатие картинок: любые .png/.jpg/.jpeg/.gif/.bmp в папках <страница>/img/ превращаются в WebP
двух размеров (<имя>-640.webp и <имя>-1200.webp или по исходной ширине), исходник удаляется.
В page.json картинку указывают по имени без размера: "name": "<имя>".
Запуск: python tools/optimize_images.py   (нужен Pillow: pip install pillow)
"""
import glob
import os
import re
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
EXT = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff')


def slug(name):
    name = os.path.splitext(name)[0].lower()
    tr = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
                  ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f',
                   'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya']))
    name = ''.join(tr.get(c, c) for c in name)
    return re.sub(r'[^a-z0-9]+', '-', name).strip('-') or 'image'


def main():
    done = 0
    for path in sorted(glob.glob('*/img/*')):
        if not path.lower().endswith(EXT):
            continue
        folder = os.path.dirname(path)
        name = slug(os.path.basename(path))
        im = ImageOps.exif_transpose(Image.open(path)).convert('RGB')
        portrait = im.height > im.width
        big = min(im.width, 900 if portrait else 1200)
        for w in sorted({min(640, im.width), big}):
            r = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS) if w != im.width else im
            r.save(os.path.join(folder, '%s-%d.webp' % (name, w)), 'WEBP', quality=74, method=6)
        kb = os.path.getsize(path) // 1024
        os.remove(path)
        done += 1
        print('%s → %s/%s-*.webp (было %d КБ)' % (path, folder, name, kb))
    print('Сжато картинок: %d' % done)


if __name__ == '__main__':
    sys.exit(main())
