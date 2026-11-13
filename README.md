# Elementa

Roguelike de supervivencia para celular en pixel art. Eliges una criatura elemental, te mueves con el dedo y tu criatura ataca sola contra oleadas de enemigos. Sobrevive 8 minutos y vence al jefe final.

**Jugar:** https://elementa-e8p.pages.dev (instalable como app desde Safari o Chrome)

## Estructura

- `elementa/`: el juego que se publica (HTML, JavaScript y sprites; no necesita compilarse).
  - `game.js`: toda la lógica, el dibujo y el menú.
  - `sprites/`: arte de las criaturas en PNG con transparencia.
  - `sw.js`: modo sin internet. Cambia `VERSION` en cada publicación.
- `arte/`: imágenes originales y `procesar.py`, que les quita el fondo, ajusta el tamaño y agrega contorno.

## Probar en el PC

```bash
python -m http.server 8766 --directory elementa
```

Luego abre http://localhost:8766.

## Cambiar el arte

1. Pon las imágenes en `arte/` (fondo magenta liso, por ejemplo `agua1.jpg`).
2. Ejecuta `python arte/procesar.py` (necesita Pillow: `pip install pillow`).

## Publicar en Cloudflare Pages

```bash
npx wrangler@4 pages deploy elementa --project-name elementa --branch main --commit-dirty=true
```
