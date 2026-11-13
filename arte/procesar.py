"""Convierte el arte (PNG/JPG con fondo de color) en sprites con transparencia para el juego.

Uso:  python arte/procesar.py
Lee las imágenes de arte/ y escribe los sprites listos en elementa/sprites/.
"""
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / 'elementa' / 'sprites'
OUT.mkdir(exist_ok=True)

# El juego mide 180 px lógicos de ancho y dibuja a RS veces esa resolución.
# Altura final de cada etapa en píxeles reales (= px lógicos x RS): 18, 25 y 33 px lógicos.
RS = 3
HEIGHT = {1: 18 * RS, 2: 25 * RS, 3: 33 * RS}
OUTLINE_PX = 2
OUTLINE = (20, 22, 34, 255)


def key_out(im, bg, tol):
    """Hace transparente todo lo que se parezca al color de fondo."""
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) < tol:
                px[x, y] = (0, 0, 0, 0)
    return im


def largest_blob_bbox(im):
    """Recorta al área con contenido (ignora puntitos sueltos)."""
    alpha = im.getchannel('A').point(lambda v: 255 if v > 0 else 0)
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return alpha.getbbox()


def finish(im, stage, name):
    bbox = largest_blob_bbox(im)
    im = im.crop(bbox)
    th = HEIGHT[stage]
    tw = max(1, round(im.width * th / im.height))
    # reducir con buena calidad y luego dejar bordes duros (estilo pixel art)
    small = im.resize((tw, th), Image.LANCZOS)
    px = small.load()
    for y in range(th):
        for x in range(tw):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    # contorno oscuro para que se lean bien sobre el pasto.
    # El lienzo final mide un múltiplo de RS, así cada píxel lógico calza exacto.
    pad = OUTLINE_PX
    w = -(-(tw + 2 * pad) // RS) * RS
    h = -(-(th + 2 * pad) // RS) * RS
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(small, ((w - tw) // 2, h - th - pad))
    op = out.load()
    for _ in range(OUTLINE_PX):
        solid = [[op[x, y][3] > 0 for x in range(w)] for y in range(h)]
        for y in range(h):
            for x in range(w):
                if solid[y][x]:
                    continue
                if any(0 <= x + dx < w and 0 <= y + dy < h and solid[y + dy][x + dx]
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    op[x, y] = OUTLINE
    out.save(OUT / f'{name}.png')
    return out


made = {}
# Agua: imágenes originales de Gemini con fondo magenta
for i in (1, 2, 3):
    im = Image.open(ROOT / f'agua{i}.jpg')
    made[f'water{i}'] = finish(key_out(im, (255, 0, 255), 200), i, f'water{i}')

# Fuego y planta: recortados de la foto con las 3 líneas (fondo verde)
grid = Image.open(ROOT / 'foto_lineas.png').convert('RGBA')
BG = (86, 172, 134)
cols = [(0, 92), (92, 205), (205, 312)]
rows = {'fire': (100, 200), 'plant': (200, 306)}
for name, (y0, y1) in rows.items():
    for i, (x0, x1) in enumerate(cols, start=1):
        cell = key_out(grid.crop((x0, y0, x1, y1)), BG, 70)
        made[f'{name}{i}'] = finish(cell, i, f'{name}{i}')

# Eléctrico: batería y nube (el primero se mantiene como el Voltín original del juego)
el = Image.open(ROOT / 'foto_electrico.png').convert('RGBA')
for i, (x0, x1) in ((2, (100, 215)), (3, (215, 336))):
    cell = key_out(el.crop((x0, 0, x1, 96)), BG, 70)
    made[f'elec{i}'] = finish(cell, i, f'elec{i}')

# hoja de vista previa ampliada x4
order = ['water1', 'water2', 'water3', 'fire1', 'fire2', 'fire3', 'plant1', 'plant2', 'plant3', 'elec2', 'elec3']
sheet = Image.new('RGBA', (3 * 150, 4 * 150), (43, 79, 54, 255))
for k, key in enumerate(order):
    im = made[key]
    big = im.resize((im.width * 4 // RS, im.height * 4 // RS), Image.NEAREST)
    cx, cy = (k % 3) * 150, (k // 3) * 150
    sheet.alpha_composite(big, (cx + (150 - big.width) // 2, cy + 145 - big.height))
sheet.save(ROOT / 'vista_previa.png')
print({k: v.size for k, v in made.items()})
