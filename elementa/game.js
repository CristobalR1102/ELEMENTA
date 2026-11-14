'use strict';
// ELEMENTA — survivor roguelike de criaturas elementales.
// Canvas 2D a baja resolución (216 px de ancho) escalado con píxeles nítidos:
// pocos píxeles que pintar = poco trabajo para la GPU y menos calor.
(() => {

// ---------- Utilidades ----------
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const $ = (id) => document.getElementById(id);
function load(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ---------- Pantalla ----------
const W = 180; // ancho lógico: menos píxeles = menos trabajo y criaturas más grandes en pantalla
let H = 320;
// Resolución real del lienzo: RS veces la lógica. El arte de las criaturas viene a esta densidad,
// así se ve con todo su detalle; el resto del pixel art se dibuja igual que antes, solo que ampliado.
const RS = 3;
const cv = $('game');
const ctx = cv.getContext('2d', { alpha: false });

// ---------- Sprites (pixel art definido como texto) ----------
const BASE = { k: '#1a1c2c', w: '#f4f4f4', p: '#ff8fa3', e: '#f2d3ab' };
const P = (o) => Object.assign({}, BASE, o);

function makeSprite(rows, pal) {
  const h = rows.length, w = rows[0].length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = pal[rows[y][x]];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}
function variant(src, mode) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  if (mode === 'flip') { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); }
  else { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = mode === 'dark' ? '#0b0e15' : '#fff'; g.fillRect(0, 0, c.width, c.height); }
  return c;
}
// Un sprite = lista de cuadros de animación, con versión espejada y versión blanca (golpe)
function sprite(frames, pal) {
  const r = frames.map((f) => makeSprite(f, pal));
  return { r, l: r.map((c) => variant(c, 'flip')), white: r.map((c) => variant(c, 'white')), dark: r.map((c) => variant(c, 'dark')), w: r[0].width, h: r[0].height };
}
// Segundo cuadro automático: quita una fila del cuerpo y baja todo 1 px (efecto "respirar/saltito")
function squash(rows, i) { return ['.'.repeat(rows[0].length), ...rows.slice(0, i), ...rows.slice(i + 1)]; }

// Criaturas originales. o = contorno, k = ojos, w = brillo, p = mejillas, s = sombra.
const ROWS = {
  water: [ // Gotín: gotita
    '.......oo.......',
    '......ocBo......',
    '.....ocBBBo.....',
    '....ocBBBBBo....',
    '...ocBBBBBBBo...',
    '..ocBBBBBBBBBo..',
    '..oBBBBBBBBBBo..',
    '.oBBBkkBBkkBBBo.',
    '.oBBBkwBBkwBBBo.',
    '.oBpBBBBBBBBpBo.',
    '.oBBBBBkkBBBBBo.',
    '.osBBBBBBBBBBso.',
    '..osBBBBBBBBso..',
    '...ossBBBBsso...',
    '....oooooooo....',
    '................',
  ],
  fire: [ // Chispín: brasa con pelo de llamas
    '....y...y...y...',
    '...yOy.yOy.yOy..',
    '...yOOyOOOyOOy..',
    '..oOOOOOOOOOOo..',
    '.oOOOOOOOOOOOOo.',
    '.oOOOOOOOOOOOOo.',
    'orOOkkOOOOkkOOro',
    'orOOkwOOOOkwOOro',
    'orOpOOOOOOOOpOro',
    'orOOOeekkeeOOOro',
    '.orOOeeeeeeOOro.',
    '.orrOOOOOOOOrro.',
    '..orrrOOOOrrro..',
    '...oooooooooo...',
    '...oro....oro...',
    '...ooo....ooo...',
  ],
  plant: [ // Brotín: bolita con brote
    '....lll..lll....',
    '...lGGGl.lGGGl..',
    '....lGGGgGGGl...',
    '.......g........',
    '....oooggooo....',
    '...oGGGGGGGGo...',
    '..oGGGGGGGGGGo..',
    '.oGGkkGGGGkkGGo.',
    '.oGGkwGGGGkwGGo.',
    '.oGpGGGGGGGGpGo.',
    '.oGGGGGkkGGGGGo.',
    '.osGGGGGGGGGGso.',
    '..osGGGGGGGGso..',
    '...oossssssoo...',
    '...ogo....ogo...',
    '...ooo....ooo...',
  ],
  slime: [
    '............',
    '.....oo.....',
    '....ohAo....',
    '...ohAAAo...',
    '..oAAAAAAo..',
    '.oAAkAAkAAo.',
    '.oAAkAAkAAo.',
    'oAAAAAAAAAAo',
    'osAAAAAAAAso',
    '.oooooooooo.',
  ],
  wisp: [[
    '.....r......',
    '.....rr.....',
    '....rOr..r..',
    '...rOOr.rr..',
    '...rOOOrOr..',
    '..rOOyOOOOr.',
    '.rOOyyyyOOOr',
    '.rOykyyykyOr',
    '.rOyyyyyyyOr',
    '.rOOyyyyyOOr',
    '..rOOOOOOOr.',
    '...rrrrrrr..',
  ], [
    '......r.....',
    '......rr....',
    '..r..rOr....',
    '..rr.rOOr...',
    '..rOrOOOr...',
    '..rOOyOOOOr.',
    '.rOOyyyyOOOr',
    '.rOykyyykyOr',
    '.rOyyyyyyyOr',
    '.rOOyyyyyOOr',
    '..rOOOOOOOr.',
    '...rrrrrrr..',
  ]],
  mush: [
    '....oooo....',
    '..ooAAhAoo..',
    '.oAAhAAAAAo.',
    'oAhAAAAAhAAo',
    'oAAAAhAAAAAo',
    'oooooooooooo',
    '..oeeeeeeo..',
    '..oekeekeo..',
    '..oeeeeeeo..',
    '..oeeppeeo..',
    '...oeeeeo...',
    '...oo..oo...',
  ],
  bat: [[
    'oo........oo',
    'oAo..oo..oAo',
    'oAAooAAooAAo',
    'oAAAkAAkAAAo',
    '.oAAAAAAAAo.',
    '..o.oAAo.o..',
    '.....oo.....',
    '............',
  ], [
    '............',
    '.....oo.....',
    '....oAAo....',
    'oooAkAAkAooo',
    'oAAAAAAAAAAo',
    'oAAoAAAAoAAo',
    'oAo.oooo.oAo',
    'oo........oo',
  ]],
  rock: [
    '...oooooo...',
    '..oAAAhAAo..',
    '.oAAhAAAAAo.',
    'oAAAAAAsAAAo',
    'oAkkAAAAkkAo',
    'oAkwAAAAkwAo',
    'oAAAAsAAAAAo',
    'osAAAkkAAAso',
    'ossAAAAAAsso',
    '.oooooooooo.',
  ],
  bolt: ['.ccc.', 'cwBBc', 'cBBBc', 'cBBBc', '.ccc.'],
  bubble: ['.ccc.', 'cw..c', 'c...c', 'c...c', '.ccc.'],
  fireball: ['.rOOr.', 'rOyyOr', 'OyeeyO', 'OyeeyO', 'rOyyOr', '.rOOr.'],
  leaf: ['..lG', 'lGGg', 'Gg..'],
  thorn: ['.l.', 'lGl', '.g.'],
  crown: ['y..y..y', 'yy.y.yy', 'yyyyyyy', 'yryyyry'],
  chest: ['.ooooooo.', 'oYYYYYYYo', 'oYyYYYyYo', 'oooowoooo', 'oYYYwYYYo', 'oYYYYYYYo', '.ooooooo.'],
  tuft: ['...l...', '.l.G.l.', '.GlGlG.', 'gGGgGGg'],
  flower: ['.y.', 'ywy', '.y.', '.g.'],
  crystal: ['...c...', '..cCc..', '..cCc..', '.cCCwc.', '.cCCwc.', '.cCCwc.', 'cCCCCwc', 'cCCCCwc', 'cCCCCwc', 'sCCCCCs', '.sssss.'],
  boomer: ['tt.', 't..', 't..'],
  gem: ['..a..', '.aAa.', 'aAhAa', '.aAa.', '..a..'],
  berry: ['..g..', '.rgr.', 'rrrwr', 'rrrrr', '.rrr.'],
};
// fila del cuerpo que se "aplasta" en el segundo cuadro
const SQUASH = { water: 6, fire: 4, plant: 6, slime: 4, mush: 8, rock: 6 };
// Evoluciones: se dibuja solo la mitad izquierda y se refleja (simetría perfecta).
const hm = (rows) => rows.map((r) => r + [...r].reverse().join(''));
Object.assign(ROWS, {
  water2: hm([ // Oleín (Nv16) 20x20
    '..........',
    '........oo',
    '.......ocB',
    '......ocBB',
    '.....ocBBB',
    '....ocBBBB',
    '...ocBBBBB',
    'o..oBBBBBB',
    'ocoBBBBBBB',
    'ocoBkkkBBB',
    'ocoBkwkBBB',
    '.ooBkkkBBB',
    '..oBpBBBBB',
    '..oBBBBBkk',
    '..osBBBBBB',
    '..oscBBBBB',
    '...osBBBBB',
    '....ossBBB',
    '....oooooo',
    '....oo....',
  ]),
  water3: hm([ // Marejón (Nv32) 24x24
    '..........oo',
    '.....oo..ocB',
    '....ocBo.ocB',
    '....ocBBoBBB',
    '.....oBBBBBB',
    '....ocBBBBBB',
    '...ocBBBBBBB',
    '..ocBBBBBBBB',
    'o.oBBBBBBBBB',
    'ocoBBBBBBBBB',
    'ocoBkkkkBBBB',
    'ocoBkwwkBBBB',
    'ocoBkkkkBBBB',
    '.ooBBBBBBBBB',
    '..oBppBBBBBB',
    '..oBBBBBBkkk',
    '..oBBBBBBBBk',
    '..osBBBccccc',
    '..osBBcccccc',
    '...osBBccccc',
    '....ossBBBBB',
    '.....ooooooo',
    '....oBo.....',
    '....ooo.....',
  ]),
  fire2: hm([ // Brasón (Nv16) 20x20
    '....y....y',
    '...yOy..yO',
    '...yOOy.yO',
    '..yOOOyyOO',
    '...oOOOOOO',
    '..oOOOOOOO',
    '.oOOOOOOOO',
    'orOOOOOOOO',
    'orOOkkkOOO',
    'orOOkwkOOO',
    'orOOkkkOOO',
    'orOpOOOOOO',
    'orOOOeeekk',
    'orrOeeeeee',
    '.orOOeeeee',
    '.orrOOOOOO',
    '..orrrOOOO',
    '...ooooooo',
    '...oro....',
    '...ooo....',
  ]),
  fire3: hm([ // Fogarón (Nv32) 24x24
    '..y........y',
    '..yy......yO',
    '..yOy...y.yO',
    '..yOOy.yOyOO',
    '...yOOyOOOOO',
    '....oOOOOOOO',
    '...oOOOOOOOO',
    '..oOOOOOOOOO',
    '.orOOOOOOOOO',
    'orOOkOOOOOOO',
    'orOOkkkkOOOO',
    'orOOkwkkOOOO',
    'orOOOkkkOOOO',
    'orOpOOOOOOOO',
    'orOOOOeeeekk',
    'orrOOeeeeeee',
    '.orOOeeeeeee',
    '..orOOeeeeee',
    '..orrOOOOOOO',
    '...orrrrOOOO',
    '....oooooooo',
    '...orro.....',
    '...orro.....',
    '...oooo.....',
  ]),
  plant2: hm([ // Arbustín (Nv16) 20x20
    '..lll.....',
    '.lGGGl..yy',
    'lGGGGGlyey',
    'lGGGGGGlyy',
    '.lGGGGGl.g',
    '..lllll..g',
    '....oooooo',
    '...oGGGGGG',
    '..oGGGGGGG',
    '.oGGGGGGGG',
    '.oGGkkkGGG',
    'oGGGkwkGGG',
    'oGGGkkkGGG',
    'oGpGGGGGGG',
    'oGGGGGGGkk',
    'osGGGGGGGG',
    '.osGGGGGGG',
    '..oossssss',
    '...ogooooo',
    '...ooo....',
  ]),
  plant3: hm([ // Frondón (Nv32) 24x24
    '....llll....',
    '..llGGGGGlll',
    '.lGGGyGGGGGG',
    'lGGGyeyGGGGl',
    'lGGGGyGGGlGG',
    'lGGGGGGGGGGG',
    '.lGGGGGGGGGl',
    '..lllGGGllll',
    '....oooooooo',
    '...oGGGGGGGG',
    '..oGGGGGGGGG',
    '.oGGGGGGGGGG',
    '.oGGkkkkGGGG',
    'oGGGkwwkGGGG',
    'oGGGkkkkGGGG',
    'oGppGGGGGGGG',
    'oGGGGGGGkGGG',
    'oGGGGGGGGkkk',
    'osGGGGGGGGGG',
    '.osGGGGGGGGG',
    '..osssssssss',
    '...ooooooooo',
    '...ogggo....',
    '...ooooo....',
  ]),
});
Object.assign(ROWS, {
  elec: hm([ // Voltín: bolita de energía con antena
    '.......z',
    '......z.',
    '.......z',
    '....oooo',
    '...oyyYY',
    '..oyYYYY',
    '.oyYYYYY',
    '.oYYkkYY',
    'oYYYkwYY',
    'oYzYYYYY',
    'oYYYYYYk',
    'osYYYYYY',
    '.osYYYYY',
    '..ossYYY',
    '...ooooo',
    '...oo...',
  ]),
  elec2: hm([ // Dinamín (Nv16): dos antenas y rayo en la panza
    '...z......',
    '....z.....',
    '...z......',
    '....z.....',
    '....oooooo',
    '...oyyYYYY',
    '..oyYYYYYY',
    '.oyYYYYYYY',
    '.oYYkkkYYY',
    'oYYYkwkYYY',
    'oYYYkkkYYY',
    'oYzYYYYYYY',
    'oYYYYYYYkk',
    'osYYYYYYYY',
    'osYYYzzYYY',
    '.osYYYYYYY',
    '..osYYYYYY',
    '...ossssss',
    '...ooooooo',
    '...oo.....',
  ]),
  elec3: hm([ // Tormentón (Nv32): nube de tormenta flotando encima
    '......nnnn..',
    '....nnNnnnnn',
    '...nNNnnnNnn',
    '..nNNNNnNNNN',
    '...nNNNNNNNN',
    '....z....z..',
    '.....z..z...',
    '....z...oooo',
    '......ooYYYY',
    '.....oyYYYYY',
    '....oyYYYYYY',
    '...oyYYYYYYY',
    '..oYYkkkkYYY',
    '..oYYkwwkYYY',
    '.oYYYkkkkYYY',
    '.oYzzYYYYYYY',
    'oYYYYYYYYkkk',
    'oYYYYYYYYYYk',
    'osYYYYYYYYYY',
    '.osYYYYYYYYY',
    '..osYYYYYYYY',
    '...ossssssss',
    '...ooooooooo',
    '...ooo......',
  ]),
  spark: [[
    '..z......z..',
    '...z.oo.z...',
    '....oYYo....',
    '...oYyYYo...',
    'z.oYkYYkYo.z',
    '.zoYYYYYYoz.',
    '..oYYYYYYo..',
    '...oYYYYo...',
    '....oooo....',
    '...z....z...',
  ], [
    '...z....z...',
    '..z..oo..z..',
    '....oYYo....',
    '...oYyYYo...',
    '.zoYkYYkYoz.',
    'z.oYYYYYYo.z',
    '..oYYYYYYo..',
    '...oYYYYo...',
    '....oooo....',
    '..z......z..',
  ]],
});
Object.assign(SQUASH, { water2: 14, water3: 18, fire2: 15, fire3: 18, plant2: 15, plant3: 18, elec: 11, elec2: 13, elec3: 18 });


const PAL_PLAYER = {
  water: P({ o: '#1a2552', B: '#41a6f6', c: '#a5f0ff', s: '#2f7fcf' }),
  fire: P({ o: '#3d1414', O: '#ef7d57', r: '#b8452f', y: '#ffcd75', e: '#ffe3b0' }),
  plant: P({ o: '#173322', G: '#5ac46a', l: '#a7f070', g: '#2f7d45', s: '#38975a', y: '#ffcd75', e: '#fff3c4' }),
  elec: P({ o: '#3a2a10', Y: '#ffcd75', y: '#fff3b0', s: '#e0a040', z: '#73eff7' }),
};
const PAL_EVO = {
  water: P({ o: '#141a45', B: '#3b6fd9', c: '#73eff7', s: '#2a4fa8' }),
  fire: P({ o: '#2e0f0f', O: '#e04a3a', r: '#9c2a2a', y: '#ffd84a', e: '#ffd2a0' }),
  plant: P({ o: '#10261a', G: '#3aa35a', l: '#a7f070', g: '#1f5c38', s: '#2a7a48', y: '#ef7d57', e: '#ffcd75' }),
  elec: P({ o: '#2e2008', Y: '#ffd84a', y: '#fff3b0', s: '#d08a2a', z: '#a5f0ff', n: '#c2c3cc', N: '#8b8d99' }),
};

const SPR = {};
function anim(key) { const rows = ROWS[key]; return [rows, squash(rows, SQUASH[key])]; }
function buildSprites() {
  for (const t of ['water', 'fire', 'plant', 'elec']) {
    SPR[t] = sprite(anim(t), PAL_PLAYER[t]);
    SPR[t + '2'] = sprite(anim(t + '2'), PAL_PLAYER[t]);
    SPR[t + '3'] = sprite(anim(t + '3'), PAL_EVO[t]);
  }
  SPR.slimeW = sprite(anim('slime'), P({ o: '#1a2552', A: '#41a6f6', h: '#a5f0ff', s: '#2f7fcf' }));
  SPR.wisp = sprite(ROWS.wisp, P({ r: '#b8452f', O: '#ef7d57', y: '#ffcd75' }));
  SPR.mush = sprite(anim('mush'), P({ o: '#173322', A: '#38b764', h: '#a7f070' }));
  SPR.bat = sprite(ROWS.bat, P({ o: '#1a1424', A: '#6b4a8a', k: '#ffcd75' }));
  SPR.spark = sprite(ROWS.spark, P({ o: '#3a2a10', Y: '#ffcd75', y: '#fff3b0', z: '#73eff7' }));
  SPR.rock = sprite(anim('rock'), P({ o: '#2a2a33', A: '#8b8d99', h: '#c2c3cc', s: '#5f616d' }));
  SPR.bolt = sprite([ROWS.bolt], PAL_PLAYER.water);
  SPR.bubble = sprite([ROWS.bubble], PAL_PLAYER.water);
  SPR.fireball = sprite([ROWS.fireball], PAL_PLAYER.fire);
  SPR.leaf = sprite([ROWS.leaf], PAL_PLAYER.plant);
  SPR.thorn = sprite([ROWS.thorn], PAL_PLAYER.plant);
  SPR.crown = sprite([ROWS.crown], P({ y: '#ffcd75', r: '#b13e53' }));
  SPR.chest = sprite([ROWS.chest], P({ o: '#5d3a1a', Y: '#ffcd75', y: '#fff3b0', w: '#f4f4f4' }));
  SPR.tuft = sprite([ROWS.tuft], P({ g: '#1f4a2c', G: '#3b7d4a', l: '#5ac46a' }));
  SPR.flower = sprite([ROWS.flower], P({ y: '#ffcd75', w: '#f4f4f4', g: '#3b7d4a' }));
  SPR.crystal = sprite([ROWS.crystal], P({ c: '#a5f0ff', C: '#41a6f6', w: '#f4f4f4', s: '#29366f' }));
  SPR.boomer = sprite([ROWS.boomer], P({ t: '#e0b07a' }));
  SPR.gem1 = sprite([ROWS.gem], P({ a: '#257179', A: '#38b764', h: '#a7f070' }));
  SPR.gem5 = sprite([ROWS.gem], P({ a: '#29366f', A: '#41a6f6', h: '#73eff7' }));
  SPR.gem25 = sprite([ROWS.gem], P({ a: '#5d275d', A: '#b13e53', h: '#ffcd75' }));
  SPR.berry = sprite([ROWS.berry], P({ r: '#b13e53', g: '#38b764' }));
}

// Fuente de píxeles 3x5 para números (con borde oscuro)
const GLYPHS = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
  ':': ['0', '1', '0', '1', '0'],
};
const FONT = {}; // FONT[color][char]
function buildFont() {
  for (const [key, col] of [['w', '#f4f4f4'], ['y', '#ffcd75'], ['g', '#94a0b8']]) {
    FONT[key] = {};
    for (const ch in GLYPHS) {
      const gl = GLYPHS[ch], gw = gl[0].length;
      const c = document.createElement('canvas'); c.width = gw + 2; c.height = 7;
      const g = c.getContext('2d');
      for (let pass = 0; pass < 2; pass++) {
        g.fillStyle = pass ? col : '#1a1c2c';
        for (let y = 0; y < 5; y++) for (let x = 0; x < gw; x++) if (gl[y][x] === '1') {
          if (pass) g.fillRect(x + 1, y + 1, 1, 1);
          else g.fillRect(x, y, 3, 3);
        }
      }
      FONT[key][ch] = c;
    }
  }
}
function textWidth(str, s) { let w = 0; for (const ch of str) w += (FONT.w[ch].width - 1) * s; return w; }
function drawText(str, x, y, col, s) {
  const f = FONT[col];
  for (const ch of str) {
    const g = f[ch];
    ctx.drawImage(g, x | 0, y | 0, g.width * s, g.height * s);
    x += (g.width - 1) * s;
  }
}

// Suelo: un tile de 64x64 repetido con un patrón (muy barato de dibujar)
let groundPat;
function buildGround() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b4f36'; g.fillRect(0, 0, 64, 64);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) { g.fillStyle = r() < 0.5 ? '#325c3e' : '#26462f'; g.fillRect((r() * 64) | 0, (r() * 64) | 0, 1, 2); }
  for (let i = 0; i < 4; i++) {
    const x = (r() * 60) | 0, y = (r() * 60) | 0;
    g.fillStyle = pick(['#ffcd75', '#f4f4f4', '#ff8fa3']); g.fillRect(x, y, 1, 1);
  }
  groundPat = ctx.createPattern(c, 'repeat');
}

// ---------- Datos del juego ----------
const TYPE_NAME = { water: 'AGUA', fire: 'FUEGO', plant: 'PLANTA', elec: 'ELÉC', normal: 'NORMAL' };
function eff(a, d) {
  if ((a === 'water' && d === 'fire') || (a === 'fire' && d === 'plant') || (a === 'plant' && d === 'water') ||
      (a === 'elec' && d === 'water') || (a === 'plant' && d === 'elec')) return 2;
  if ((a === 'fire' && d === 'water') || (a === 'plant' && d === 'fire') || (a === 'water' && d === 'plant') || (a === 'elec' && d === 'plant')) return 0.5;
  if (a === d && (a === 'water' || a === 'fire' || a === 'plant' || a === 'elec')) return 0.5;
  return 1;
}

const STARTERS = {
  water: { names: ['Gotín', 'Oleín', 'Marejón'], move: 'chorro', desc: 'Equilibrado. Dispara chorros de agua que atraviesan.' },
  fire: { names: ['Chispín', 'Brasón', 'Fogarón'], move: 'ascuas', desc: 'Frágil pero explosivo. Bolas de fuego con área.' },
  plant: { names: ['Brotín', 'Arbustín', 'Frondón'], move: 'hojas', desc: 'Resistente. Hojas que giran a su alrededor.' },
  elec: { names: ['Voltín', 'Dinamín', 'Tormentón'], move: 'rayo', desc: 'Veloz. Rayos que caen sobre enemigos al azar.' },
};
// Evoluciones: nivel en que ocurren, y radio de golpe según el tamaño del sprite
const EVO_LEVELS = [16, 32];
const STAGE_RADIUS = [6, 8, 10];
const pname = (p) => STARTERS[p.type].names[p.stage];

const MOVES = {
  chorro: { name: 'Chorro', type: 'water', desc: 'Agua al enemigo más cercano. Atraviesa.',
    cd: (l) => 0.95 - 0.07 * l,
    fire(m) {
      const t = nearest(player.x, player.y, 150); if (!t) return false;
      const n = 1 + (m.lvl >= 3) + (m.lvl >= 5);
      const a0 = Math.atan2(t.y - player.y, t.x - player.x);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * 0.18;
        addBullet(player.x, player.y, Math.cos(a) * 180, Math.sin(a) * 180, 8 + 3 * m.lvl, 'water', 1 + (m.lvl >> 1), 0.9, SPR.bolt, 3, 0);
      }
    } },
  burbujas: { name: 'Burbujas', type: 'water', desc: 'Burbujas lentas en todas direcciones. Empujan.',
    cd: (l) => 2.2 - 0.15 * l,
    fire(m) {
      const n = 3 + m.lvl;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2), sp = rand(45, 70);
        const b = addBullet(player.x, player.y, Math.cos(a) * sp, Math.sin(a) * sp, 5 + 2 * m.lvl, 'water', 3, 2.4, SPR.bubble, 4, 0);
        b.kb = 70;
      }
    } },
  ascuas: { name: 'Ascuas', type: 'fire', desc: 'Bola de fuego que explota en área.',
    cd: (l) => 1.25 - 0.08 * l,
    fire(m) {
      const t = nearest(player.x, player.y, 150); if (!t) return false;
      const n = 1 + (m.lvl >= 4);
      for (let i = 0; i < n; i++) {
        const a = Math.atan2(t.y - player.y, t.x - player.x) + (i ? 0.35 : 0);
        addBullet(player.x, player.y, Math.cos(a) * 125, Math.sin(a) * 125, 9 + 4 * m.lvl, 'fire', 0, 1.3, SPR.fireball, 3, 16 + 3 * m.lvl);
      }
    } },
  anillo: { name: 'Anillo Ígneo', type: 'fire', desc: 'Onda de fuego alrededor tuyo.',
    cd: (l) => 2.6 - 0.2 * l,
    fire(m) {
      const R = 30 + 6 * m.lvl;
      addFx('ring', player.x, player.y, R, 0.3, '#ef7d57');
      forNear(player.x, player.y, R, (e) => {
        const dx = e.x - player.x, dy = e.y - player.y, d = Math.hypot(dx, dy) || 1;
        if (d < R + e.r) hurt(e, 7 + 3 * m.lvl, 'fire', dx / d * 50, dy / d * 50);
      });
    } },
  hojas: { name: 'Hojas Giratorias', type: 'plant', desc: 'Hojas que orbitan y cortan.',
    cd: () => 99, fire() {},
    count: (l) => 2 + ((l + 1) >> 1),
    radius: (l) => 22 + 2 * l,
    tick(m, dt) {
      m.ang = (m.ang || 0) + dt * (3 + 0.3 * m.lvl);
      const n = this.count(m.lvl), R = this.radius(m.lvl), dmg = 5 + 2 * m.lvl;
      for (let i = 0; i < n; i++) {
        const a = m.ang + i * Math.PI * 2 / n;
        const lx = player.x + Math.cos(a) * R, ly = player.y + Math.sin(a) * R;
        forNear(lx, ly, 6, (e) => {
          if (e.leafT > T) return;
          const dx = e.x - lx, dy = e.y - ly;
          if (dx * dx + dy * dy < (e.r + 4) * (e.r + 4)) { e.leafT = T + 0.45; hurt(e, dmg, 'plant', Math.cos(a) * 40, Math.sin(a) * 40); }
        });
      }
    } },
  latigo: { name: 'Látigo Cepa', type: 'plant', desc: 'Azote horizontal. Nv3: ambos lados.',
    cd: (l) => 1.5 - 0.1 * l,
    fire(m) {
      const len = 52 + 6 * m.lvl;
      const sides = m.lvl >= 3 ? [1, -1] : [player.face];
      for (const s of sides) {
        addFx('whip', player.x, player.y, len * s, 0.18, '#a7f070');
        const cx = player.x + s * len / 2;
        forNear(cx, player.y, len / 2 + 6, (e) => {
          const dx = (e.x - player.x) * s;
          if (dx > -4 && dx < len && Math.abs(e.y - player.y) < 10 + e.r) hurt(e, 10 + 4 * m.lvl, 'plant', s * 60, 0);
        });
      }
    } },
  rayo: { name: 'Relámpago', type: 'elec', desc: 'Rayos sobre enemigos al azar.',
    cd: (l) => 1.8 - 0.12 * l,
    fire(m) {
      tmp.length = 0;
      for (const e of enemies) if (!e.dead && Math.abs(e.x - player.x) < W / 2 && Math.abs(e.y - player.y) < H / 2) tmp.push(e);
      if (!tmp.length) return false;
      const n = 1 + ((m.lvl + 1) >> 1);
      for (let i = 0; i < n && tmp.length; i++) {
        const j = (Math.random() * tmp.length) | 0, e = tmp[j];
        tmp[j] = tmp[tmp.length - 1]; tmp.pop();
        addFx('bolt', e.x, e.y, 0, 0.15, '#ffcd75');
        hurt(e, 12 + 5 * m.lvl, 'elec', 0, 0);
      }
    } },
};

const PASSIVES = {
  vida: { name: 'Caparazón', desc: '+20 de vida máxima.', apply: (p) => { p.maxHp += 20; p.hp += 20; } },
  vel: { name: 'Patas Ligeras', desc: '+10% de velocidad.', apply: (p) => { p.speed *= 1.1; } },
  iman: { name: 'Imán', desc: '+40% radio para recoger cristales.', apply: (p) => { p.magnet *= 1.4; } },
  fuerza: { name: 'Fuerza', desc: '+12% de daño.', apply: (p) => { p.dmgMul += 0.12; } },
  prisa: { name: 'Prisa', desc: '-8% tiempo entre ataques.', apply: (p) => { p.cdMul *= 0.92; } },
  regen: { name: 'Regeneración', desc: '+0.6 de vida por segundo.', apply: (p) => { p.regen += 0.6; } },
};
// Más ataques para variar cada partida
Object.assign(MOVES, {
  geiser: { name: 'Géiser', type: 'water', desc: 'Columnas de agua brotan bajo enemigos cercanos.',
    cd: (l) => 2.0 - 0.1 * l,
    fire(m) {
      const n = 1 + (m.lvl >= 4) + (m.lvl >= 7);
      let ok = false;
      for (let i = 0; i < n; i++) {
        const e = randomEnemy(110); if (!e) break; ok = true;
        addZone({ x: e.x, y: e.y, r: 14 + 2 * m.lvl, delay: 0.45, life: 0.15, every: 99, dmg: 14 + 5 * m.lvl, type: 'water', col: '#73eff7', burst: 'geyser' });
      }
      return ok;
    } },
  marea: { name: 'Marea', type: 'water', desc: 'Ola ancha hacia donde caminas. Empuja todo.',
    cd: (l) => 3.0 - 0.15 * l,
    fire(m) {
      const b = addBullet(player.x, player.y, player.dirX * 95, player.dirY * 95, 8 + 3 * m.lvl, 'water', 999, 1.3, null, 9 + m.lvl, 0);
      b.kb = 110; b.col = '#41a6f6';
    } },
  estela: { name: 'Estela Ígnea', type: 'fire', desc: 'Dejas fuego en el suelo al moverte.',
    cd: () => 0.3,
    fire(m) {
      if (!player.moving) return false;
      addZone({ x: player.x, y: player.y + 5, r: 8 + m.lvl, delay: 0, life: 1.4 + 0.2 * m.lvl, every: 0.4, dmg: 4 + 2 * m.lvl, type: 'fire', col: '#ef7d57' });
    } },
  meteoro: { name: 'Meteoro', type: 'fire', desc: 'Roca ardiente cae sobre el enemigo más fuerte.',
    cd: (l) => 3.6 - 0.22 * l,
    fire(m) {
      let best = null;
      for (const e of enemies) if (!e.dead && onScreen(e) && (!best || e.hp > best.hp)) best = e;
      if (!best) return false;
      addZone({ x: best.x, y: best.y, r: 22 + 3 * m.lvl, delay: 0.8, life: 0.15, every: 99, dmg: 30 + 12 * m.lvl, type: 'fire', col: '#ef7d57', burst: 'boom' });
    } },
  espinas: { name: 'Espinas', type: 'plant', desc: 'Espinas en todas direcciones.',
    cd: (l) => 1.6 - 0.08 * l,
    fire(m) {
      const n = 6 + 2 * Math.floor(m.lvl / 3), a0 = T * 1.3;
      for (let i = 0; i < n; i++) {
        const a = a0 + i * Math.PI * 2 / n;
        addBullet(player.x, player.y, Math.cos(a) * 140, Math.sin(a) * 140, 6 + 2 * m.lvl, 'plant', m.lvl >= 5 ? 1 : 0, 0.6, SPR.thorn, 2, 0);
      }
    } },
  raices: { name: 'Raíces', type: 'plant', desc: 'Raíces atrapan y frenan enemigos.',
    cd: (l) => 2.6 - 0.15 * l,
    fire(m) {
      const n = 2 + (m.lvl >> 1);
      let ok = false;
      for (let i = 0; i < n; i++) {
        const e = randomEnemy(110); if (!e) break; ok = true;
        addZone({ x: e.x, y: e.y, r: 11, delay: 0.25, life: 1.4, every: 0.35, dmg: 4 + 2 * m.lvl, type: 'plant', col: '#2f7d45', slow: true });
      }
      return ok;
    } },
  orbe: { name: 'Orbe Eléctrico', type: 'elec', desc: 'Descarga que salta de enemigo en enemigo.',
    cd: (l) => 1.7 - 0.1 * l,
    fire(m) {
      let e = nearest(player.x, player.y, 120); if (!e) return false;
      const pts = [player.x, player.y], hit = [];
      for (let j = 0; j < 2 + m.lvl && e; j++) {
        pts.push(e.x, e.y); hit.push(e.id);
        const nx = e.x, ny = e.y;
        hurt(e, 10 + 4 * m.lvl, 'elec', 0, 0);
        let nb = null, bd = 55 * 55;
        forNear(nx, ny, 55, (o) => {
          if (hit.indexOf(o.id) !== -1) return;
          const dx = o.x - nx, dy = o.y - ny, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; nb = o; }
        });
        e = nb;
      }
      addFx('chain', 0, 0, pts, 0.15, '#ffcd75');
    } },
  campo: { name: 'Campo Estático', type: 'elec', desc: 'Electricidad constante a tu alrededor.',
    cd: () => 0.6,
    radius: (l) => 24 + 3 * l,
    fire(m) {
      const R = this.radius(m.lvl);
      forNear(player.x, player.y, R, (e) => {
        const dx = e.x - player.x, dy = e.y - player.y;
        if (dx * dx + dy * dy < (R + e.r) * (R + e.r)) hurt(e, 3 + 1.5 * m.lvl, 'elec', 0, 0);
      });
    } },
  bumeran: { name: 'Bumerán', type: 'normal', desc: 'Va y vuelve atravesando enemigos.',
    cd: (l) => 1.7 - 0.1 * l,
    fire(m) {
      const t = nearest(player.x, player.y, 140);
      const a0 = t ? Math.atan2(t.y - player.y, t.x - player.x) : Math.atan2(player.dirY, player.dirX);
      const n = 1 + (m.lvl >= 4) + (m.lvl >= 7);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * 0.5;
        const b = addBullet(player.x, player.y, Math.cos(a) * 160, Math.sin(a) * 160, 9 + 3 * m.lvl, 'normal', 999, 2.5, SPR.boomer, 3, 0);
        b.boomer = 0.45;
      }
    } },
});
// Máximo de ataques: al completarlo, solo aparecen mejoras de los que ya tienes
const MOVE_MAX_LVL = 8, PAS_MAX_LVL = 5, MAX_MOVES = 4;

const ENEMY = {
  murci: { type: 'normal', hp: 9, spd: 44, dmg: 6, xp: 1, spr: 'bat', r: 5 },
  charco: { type: 'water', hp: 16, spd: 30, dmg: 7, xp: 2, spr: 'slimeW', r: 5 },
  brasa: { type: 'fire', hp: 13, spd: 37, dmg: 8, xp: 2, spr: 'wisp', r: 5 },
  hongo: { type: 'plant', hp: 22, spd: 26, dmg: 8, xp: 2, spr: 'mush', r: 5 },
  chispa: { type: 'elec', hp: 12, spd: 46, dmg: 7, xp: 2, spr: 'spark', r: 5 },
  piedrin: { type: 'normal', hp: 45, spd: 20, dmg: 11, xp: 4, spr: 'rock', r: 6 },
};
// Oleadas: cada 40 s cambia el tipo dominante, para obligarte a variar ataques
const WAVES = [
  ['murci', 'murci', 'murci', 'charco', 'brasa', 'hongo'],
  ['charco', 'charco', 'charco', 'murci', 'hongo'],
  ['brasa', 'brasa', 'brasa', 'murci', 'charco'],
  ['hongo', 'hongo', 'hongo', 'murci', 'brasa'],
  ['chispa', 'chispa', 'chispa', 'murci', 'charco'],
];
const BOSS_TIMES = [240, 480];
// Minijefes: aparecen en estos segundos y sueltan un cofre con una reliquia
const MINI_TIMES = [90, 180, 300, 400];
const TYPE_COL = { water: '#41a6f6', fire: '#ef7d57', plant: '#5ac46a', elec: '#ffcd75' };
const RELICS = {
  frenesi: { name: 'Frenesí', desc: 'Todos tus ataques son 35% más rápidos.', apply: (p) => { p.cdMul *= 0.65; } },
  nova: { name: 'Nova Elemental', epic: true, desc: 'Cada 6 s una explosión de tu tipo golpea toda la pantalla.', apply: (p) => { p.novaT = 1; } },
  orbes: { name: 'Orbes Guardianes', epic: true, desc: '3 orbes de tu tipo giran a tu alrededor y golpean fuerte.', apply: () => {} },
  escudo: { name: 'Escudo de Cristal', desc: 'Bloquea por completo un golpe cada 8 s.', apply: (p) => { p.shieldT = 0; } },
  critico: { name: 'Golpe Crítico', desc: 'El 20% de tus golpes hace daño x2.5.', apply: () => {} },
  robo: { name: 'Robo de Vida', desc: 'Cada enemigo derrotado te cura 1 de vida.', apply: () => {} },
};
const WIN_TIME = 480;

// ---------- Estado ----------
let state = 'menu';
let T = 0, kills = 0, spawnT = 0, nextElite = 50, nextHorde = 75, bossIdx = 0, won = false, winAt = -1;
let player = null;
let enemies = [], bullets = [], gems = [], fx = [], nums = [], zones = [];
const tmp = [];
let miniIdx = 0, pendingRelic = 0;
let pendingLv = 0, uid = 0, hurtFlash = 0;
let lowPower = load('elementa.low', false);
let dirty = true;

// ---------- Rejilla espacial (colisiones sin generar basura) ----------
const CELL = 24, MARGIN = 64, MAXE = 220;
let gCols = 0, gRows = 0, gOx = 0, gOy = 0, cellHead = new Int32Array(1);
const nextIdx = new Int32Array(MAXE);
function buildGrid() {
  gCols = Math.ceil((W + MARGIN * 2) / CELL); gRows = Math.ceil((H + MARGIN * 2) / CELL);
  cellHead = new Int32Array(gCols * gRows);
}
function fillGrid() {
  cellHead.fill(-1);
  gOx = player.x - W / 2 - MARGIN; gOy = player.y - H / 2 - MARGIN;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const cx = Math.floor((e.x - gOx) / CELL), cy = Math.floor((e.y - gOy) / CELL);
    if (cx < 0 || cy < 0 || cx >= gCols || cy >= gRows) continue;
    const ci = cy * gCols + cx;
    nextIdx[i] = cellHead[ci]; cellHead[ci] = i;
  }
}
function forNear(x, y, r, fn) {
  const r2 = r + 16; // margen por radio de enemigos grandes
  const x0 = Math.max(0, Math.floor((x - r2 - gOx) / CELL)), x1 = Math.min(gCols - 1, Math.floor((x + r2 - gOx) / CELL));
  const y0 = Math.max(0, Math.floor((y - r2 - gOy) / CELL)), y1 = Math.min(gRows - 1, Math.floor((y + r2 - gOy) / CELL));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    let i = cellHead[cy * gCols + cx];
    while (i !== -1) {
      const e = enemies[i];
      if (!e.dead && fn(e) === true) return;
      i = nextIdx[i];
    }
  }
}
function nearest(x, y, maxR) {
  let best = null, bd = maxR * maxR;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- Entidades ----------
function newPlayer(type) {
  const base = { water: { hp: 100, spd: 52 }, fire: { hp: 80, spd: 56 }, plant: { hp: 130, spd: 48 }, elec: { hp: 90, spd: 60 } }[type];
  return {
    x: 0, y: 0, type, hp: base.hp, maxHp: base.hp, speed: base.spd, face: 1,
    level: 1, xp: 0, xpNext: 4, moving: false, dirX: 1, dirY: 0, magnet: 22, dmgMul: 1, cdMul: 1, regen: 0, inv: 0, stage: 0,
    moves: [{ id: STARTERS[type].move, lvl: 1, t: 0.3 }], passives: {},
    relics: {}, novaT: 0, shieldT: 0, orbAng: 0,
  };
}
function addBullet(x, y, vx, vy, dmg, type, pierce, life, spr, r, aoe) {
  const b = { x, y, vx, vy, dmg, type, pierce, life, spr, r, aoe, kb: 25, hit: [] };
  bullets.push(b);
  return b;
}
function addZone(z) { if (zones.length < 80) { z.tickT = 0; zones.push(z); } }
function onScreen(e) { return Math.abs(e.x - player.x) < W / 2 && Math.abs(e.y - player.y) < H / 2; }
function randomEnemy(maxR) {
  tmp.length = 0;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x, dy = e.y - player.y;
    if (dx * dx + dy * dy < maxR * maxR) tmp.push(e);
  }
  return tmp.length ? tmp[(Math.random() * tmp.length) | 0] : null;
}
function addFx(kind, x, y, v, life, col) { if (fx.length < 60) fx.push({ kind, x, y, v, life, max: life, col }); }
function addNum(x, y, n, kind) {
  if (nums.length >= 40) nums.shift();
  nums.push({ x, y, s: String(n), col: kind === 1 ? 'y' : kind === 2 ? 'g' : 'w', life: 0.6 });
}
function spawnEnemy(kind, opts) {
  if (enemies.length >= MAXE - 4 && !(opts && (opts.boss || opts.mini))) return;
  if (enemies.length >= MAXE) return;
  const d = ENEMY[kind];
  let x, y;
  if (opts && opts.x !== undefined) { x = opts.x; y = opts.y; }
  else {
    const a = rand(0, Math.PI * 2), R = Math.hypot(W, H) / 2 + 12;
    x = player.x + Math.cos(a) * R; y = player.y + Math.sin(a) * R;
  }
  const scale = opts && opts.scale || 1;
  const hpMul = (1 + T / 80) * (opts && opts.hpMul || 1);
  enemies.push({
    id: ++uid, kind, type: d.type, x, y, kx: 0, ky: 0,
    hp: d.hp * hpMul, maxHp: d.hp * hpMul,
    spd: d.spd * (1 + Math.min(0.35, T / 1200)) * (opts && opts.spdMul || 1),
    dmg: d.dmg * (opts && opts.dmgMul || 1), xp: d.xp * (opts && opts.xpMul || 1),
    spr: SPR[d.spr], scale, r: d.r * scale, kbRes: opts && (opts.boss || opts.mini) ? 0.12 : scale > 1 ? 0.4 : 1,
    flash: 0, leafT: 0, slowT: 0, orbT: 0, dead: false, boss: !!(opts && opts.boss), final: !!(opts && opts.final),
    mini: !!(opts && opts.mini), dashT: 2.5, dash: 0,
  });
}
function hurt(e, base, atkType, kbx, kby) {
  if (e.dead) return;
  const m = eff(atkType, e.type);
  const stab = atkType === player.type ? 1.2 : 1;
  const crit = player.relics.critico && Math.random() < 0.2;
  const d = Math.max(1, Math.round(base * player.dmgMul * m * stab * (crit ? 2.5 : 1) * rand(0.9, 1.1)));
  e.hp -= d; e.flash = 0.08;
  sfx('hit', 70);
  e.kx += kbx * e.kbRes; e.ky += kby * e.kbRes;
  addNum(e.x, e.y - e.r - 4, d, crit || m > 1 ? 1 : m < 1 ? 2 : 0);
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true; kills++;
  sfx('kill', 60);
  addFx('puff', e.x, e.y, e.r, 0.25, '#f4f4f4');
  if (player.relics.robo) player.hp = Math.min(player.maxHp, player.hp + 1);
  if (e.mini) { gems.push({ x: e.x, y: e.y, v: 0, chest: true, mag: false }); banner('¡Recoge el cofre!'); }
  if (e.boss) {
    for (let i = 0; i < 12; i++) dropGem(e.x + rand(-20, 20), e.y + rand(-20, 20), 25);
    gems.push({ x: e.x, y: e.y, v: 0, berry: true, mag: false });
    if (e.final) { won = true; winAt = T + 1.5; banner('¡Venciste al jefe final!'); }
    return;
  }
  let v = e.xp;
  while (v >= 25) { dropGem(e.x + rand(-6, 6), e.y + rand(-6, 6), 25); v -= 25; }
  while (v >= 5) { dropGem(e.x + rand(-4, 4), e.y + rand(-4, 4), 5); v -= 5; }
  if (v > 0) dropGem(e.x, e.y, v);
  if (Math.random() < 0.012) gems.push({ x: e.x, y: e.y, v: 0, berry: true, mag: false });
}
function dropGem(x, y, v) {
  if (gems.length >= 260) { gems[(Math.random() * gems.length) | 0].v += v; return; }
  gems.push({ x, y, v, berry: false, mag: false });
}

// ---------- Entrada (joystick flotante + teclado) ----------
const joy = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
const keys = {};
function toGame(cx, cy) {
  const r = cv.getBoundingClientRect();
  return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H];
}
window.addEventListener('pointerdown', (e) => {
  if (state !== 'play' || joy.on || e.target !== cv && e.target !== document.body) return;
  joy.on = true; joy.id = e.pointerId;
  [joy.ox, joy.oy] = toGame(e.clientX, e.clientY); joy.x = joy.ox; joy.y = joy.oy;
});
window.addEventListener('pointermove', (e) => {
  if (!joy.on || e.pointerId !== joy.id) return;
  [joy.x, joy.y] = toGame(e.clientX, e.clientY);
});
const endJoy = (e) => { if (e.pointerId === joy.id) { joy.on = false; joy.id = -1; } };
window.addEventListener('pointerup', endJoy);
window.addEventListener('pointercancel', endJoy);
window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape' || e.key === 'p') togglePause(); });
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('gesturestart', (e) => e.preventDefault());

function inputVec() {
  let x = 0, y = 0;
  if (keys.a || keys.arrowleft) x--; if (keys.d || keys.arrowright) x++;
  if (keys.w || keys.arrowup) y--; if (keys.s || keys.arrowdown) y++;
  if (x || y) { const l = Math.hypot(x, y); return [x / l, y / l]; }
  if (joy.on) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy);
    if (l > 2) { const k = Math.min(1, l / 22) / l; return [dx * k, dy * k]; }
  }
  return [0, 0];
}

// ---------- Actualización ----------
function update(dt) {
  T += dt;
  const p = player;

  // jugador
  const [ix, iy] = inputVec();
  p.x += ix * p.speed * dt; p.y += iy * p.speed * dt;
  if (ix > 0.1) p.face = 1; else if (ix < -0.1) p.face = -1;
  p.moving = ix !== 0 || iy !== 0;
  if (p.moving) { const l = Math.hypot(ix, iy); p.dirX = ix / l; p.dirY = iy / l; }
  p.inv -= dt; hurtFlash -= dt;
  if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  fillGrid();

  // ataques
  for (const m of p.moves) {
    const def = MOVES[m.id];
    if (def.tick) def.tick(m, dt);
    m.t -= dt;
    if (m.t <= 0) m.t = def.fire(m) === false ? 0.2 : def.cd(m.lvl) * p.cdMul;
  }

  // reliquias
  if (p.relics.nova) { p.novaT -= dt; if (p.novaT <= 0) { p.novaT = 6; nova(); } }
  if (p.relics.escudo && p.shieldT > 0) p.shieldT -= dt;
  if (p.relics.orbes) {
    p.orbAng += dt * 2.4;
    const dmg = 14 + p.level;
    for (let i = 0; i < 3; i++) {
      const a = p.orbAng + i * Math.PI * 2 / 3, ox = p.x + Math.cos(a) * 38, oy = p.y + Math.sin(a) * 38;
      forNear(ox, oy, 8, (e) => {
        if (e.orbT > T) return;
        const dx = e.x - ox, dy = e.y - oy;
        if (dx * dx + dy * dy < (e.r + 6) * (e.r + 6)) { e.orbT = T + 0.5; hurt(e, dmg, p.type, Math.cos(a) * 60, Math.sin(a) * 60); }
      });
    }
  }

  // proyectiles
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.boomer !== undefined) { // bumerán: tras un momento vuelve hacia ti
      b.boomer -= dt;
      if (b.boomer <= 0) {
        if (!b.back) { b.back = true; b.hit.length = 0; }
        const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
        b.vx = dx / d * 190; b.vy = dy / d * 190;
        if (d < 8) b.life = 0;
      }
    }
    if (b.life > 0) forNear(b.x, b.y, b.r + 8, (e) => {
      if (b.hit.indexOf(e.id) !== -1) return;
      const dx = e.x - b.x, dy = e.y - b.y;
      if (dx * dx + dy * dy > (e.r + b.r) * (e.r + b.r)) return;
      if (b.aoe) {
        addFx('boom', b.x, b.y, b.aoe, 0.25, '#ef7d57');
        forNear(b.x, b.y, b.aoe, (o) => {
          const ox = o.x - b.x, oy = o.y - b.y, d = Math.hypot(ox, oy) || 1;
          if (d < b.aoe + o.r) hurt(o, b.dmg, b.type, ox / d * 40, oy / d * 40);
        });
        b.life = 0; return true;
      }
      const sp = Math.hypot(b.vx, b.vy) || 1;
      hurt(e, b.dmg, b.type, b.vx / sp * b.kb, b.vy / sp * b.kb);
      b.hit.push(e.id);
      if (--b.pierce < 0) { b.life = 0; return true; }
    });
    if (b.life <= 0) { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); }
  }

  // enemigos
  const scaleDmg = 1 + T / 400;
  for (const e of enemies) {
    if (e.dead) continue;
    let dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 340 && !e.boss && !e.mini) { // se quedó atrás: reaparece adelante
      const a = Math.atan2(-dy, -dx) + Math.PI + rand(-1, 1), R = Math.hypot(W, H) / 2 + 12;
      e.x = p.x + Math.cos(a) * R; e.y = p.y + Math.sin(a) * R; continue;
    }
    let spd = e.slowT > T ? e.spd * 0.35 : e.spd; // atrapado por raíces
    if (e.mini) { // el minijefe embiste cada pocos segundos
      e.dashT -= dt;
      if (e.dashT <= 0) { e.dashT = 3.2; e.dash = 0.45; }
      if (e.dash > 0) { e.dash -= dt; spd *= 3.2; }
    }
    e.x += (dx / d * spd + e.kx) * dt; e.y += (dy / d * spd + e.ky) * dt;
    const decay = Math.min(1, dt * 9); e.kx -= e.kx * decay; e.ky -= e.ky * decay;
    e.flash -= dt;
    if (d < e.r + STAGE_RADIUS[p.stage] && p.inv <= 0) {
      const m = eff(e.type, p.type), mm = m > 1 ? 1.5 : m < 1 ? 0.66 : 1;
      if (p.relics.escudo && p.shieldT <= 0) { p.shieldT = 8; p.inv = 0.5; addFx('ring', p.x, p.y, 20, 0.3, '#a5f0ff'); sfx('block'); }
      else { p.hp -= e.dmg * mm * scaleDmg; p.inv = 0.5; hurtFlash = 0.15; sfx('hurt', 150); }
    }
  }
  // separación suave entre enemigos de la misma celda
  for (let c = 0; c < cellHead.length; c++) {
    for (let i = cellHead[c]; i !== -1; i = nextIdx[i]) {
      const a = enemies[i];
      for (let j = nextIdx[i]; j !== -1; j = nextIdx[j]) {
        const b = enemies[j];
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5 / d;
          const wa = a.boss ? 0 : 1, wb = b.boss ? 0 : 1;
          a.x -= dx * push * wa; a.y -= dy * push * wa; b.x += dx * push * wb; b.y += dy * push * wb;
        }
      }
    }
  }
  // limpiar muertos
  for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) { enemies[i] = enemies[enemies.length - 1]; enemies.pop(); }

  // cristales
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
    if (!g.mag && d < p.magnet) g.mag = true;
    if (g.mag) { const sp = 160 * dt / (d || 1); g.x += dx * Math.min(1, sp); g.y += dy * Math.min(1, sp); }
    if (d < 7) {
      if (g.chest) { pendingRelic++; sfx('chest'); }
      else if (g.berry) { p.hp = Math.min(p.maxHp, p.hp + 30); addFx('puff', p.x, p.y, 8, 0.3, '#ff8fa3'); }
      else gainXp(g.v);
      gems[i] = gems[gems.length - 1]; gems.pop();
    }
  }

  // zonas en el suelo (géiser, meteoro, fuego, raíces)
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (z.delay > 0) {
      z.delay -= dt;
      if (z.delay <= 0 && z.burst) addFx(z.burst, z.x, z.y, z.r, 0.3, z.col);
    } else {
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = z.every;
        forNear(z.x, z.y, z.r, (e) => {
          const dx = e.x - z.x, dy = e.y - z.y;
          if (dx * dx + dy * dy < (z.r + e.r) * (z.r + e.r)) { if (z.slow) e.slowT = T + 0.5; hurt(e, z.dmg, z.type, 0, 0); }
        });
      }
      z.life -= dt;
      if (z.life <= 0) { zones[i] = zones[zones.length - 1]; zones.pop(); }
    }
  }

  // efectos y números
  for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) { fx[i] = fx[fx.length - 1]; fx.pop(); } }
  for (let i = nums.length - 1; i >= 0; i--) { const n = nums[i]; n.life -= dt; n.y -= 18 * dt; if (n.life <= 0) nums.splice(i, 1); }

  spawner(dt);

  if (p.hp <= 0) {
    if (p.revives > 0) revive(); // aquí se podrá ofrecer también revivir viendo un anuncio
    else return gameOver(false);
  }
  if (won && T >= winAt) return gameOver(true);
  if (pendingRelic > 0) openRelic();
  else if (pendingLv > 0) openLevelUp();
}

function spawner(dt) {
  const wave = WAVES[Math.floor(T / 40) % WAVES.length];
  const rate = Math.min(9, 1.2 + T / 25);
  const cap = Math.min(170, 40 + T / 2);
  spawnT -= dt;
  while (spawnT <= 0) {
    spawnT += 1 / rate;
    if (enemies.length < cap) spawnEnemy(T > 100 && Math.random() < 0.12 ? 'piedrin' : pick(wave));
  }
  if (T >= nextElite) {
    nextElite += 50;
    spawnEnemy(wave[0] === 'murci' ? pick(['charco', 'brasa', 'hongo', 'chispa']) : wave[0], { scale: 2, hpMul: 9, xpMul: 12, dmgMul: 1.6, spdMul: 0.85 });
  }
  if (T >= nextHorde) {
    nextHorde += 75;
    const n = 24, R = 140;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      spawnEnemy('murci', { x: player.x + Math.cos(a) * R, y: player.y + Math.sin(a) * R });
    }
    banner('¡Una bandada te rodea!');
  }
  if (miniIdx < MINI_TIMES.length && T >= MINI_TIMES[miniIdx]) {
    const kind = pick(['charco', 'brasa', 'hongo', 'chispa', 'piedrin']);
    spawnEnemy(kind, { scale: 2, hpMul: 22 + miniIdx * 6, xpMul: 15, dmgMul: 2, spdMul: 0.95, mini: true });
    banner('¡Minijefe! Derrótalo y abre su cofre'); sfx('boss');
    miniIdx++;
  }
  if (bossIdx < BOSS_TIMES.length && T >= BOSS_TIMES[bossIdx]) {
    const final = bossIdx === BOSS_TIMES.length - 1;
    const kind = pick(['charco', 'brasa', 'hongo', 'chispa']);
    spawnEnemy(kind, { scale: 3, hpMul: final ? 75 : 35, xpMul: 1, dmgMul: 2.5, spdMul: 0.75, boss: true, final });
    sfx('boss');
    banner(final ? '¡Jefe final: ' + TYPE_NAME[ENEMY[kind].type] + '!' : '¡Apareció un jefe de tipo ' + TYPE_NAME[ENEMY[kind].type] + '!');
    bossIdx++;
  }
}

function gainXp(v) {
  const p = player;
  p.xp += v * (p.xpMul || 1);
  while (p.xp >= p.xpNext) { p.xp -= p.xpNext; p.level++; p.xpNext = Math.floor(6 + p.level * 4 + p.level * p.level * 0.15); pendingLv++; }
}

// ---------- Subida de nivel ----------
function options() {
  const p = player, opts = [];
  for (const m of p.moves) if (m.lvl < MOVE_MAX_LVL) opts.push({ kind: 'up', id: m.id, w: 3 });
  if (p.moves.length < MAX_MOVES) for (const id in MOVES) if (!p.moves.some((m) => m.id === id)) opts.push({ kind: 'new', id, w: MOVES[id].type === p.type ? 1.2 : 0.8 });
  for (const id in PASSIVES) if ((p.passives[id] || 0) < PAS_MAX_LVL) opts.push({ kind: 'pas', id, w: 1.2 });
  const out = [];
  while (out.length < 3 && opts.length) {
    let sum = 0; for (const o of opts) sum += o.w;
    let r = Math.random() * sum, k = 0;
    while (r > opts[k].w) { r -= opts[k].w; k++; }
    out.push(opts.splice(Math.min(k, opts.length - 1), 1)[0]);
  }
  if (!out.length) out.push({ kind: 'heal' });
  return out;
}
function nova() {
  const p = player, dmg = 40 + 4 * p.level;
  addFx('ring', p.x, p.y, 130, 0.5, TYPE_COL[p.type]); sfx('boom');
  for (const e of enemies) if (!e.dead && onScreen(e)) hurt(e, dmg, p.type, 0, 0);
}
function openRelic() {
  state = 'levelup'; joy.on = false;
  $('lvTitle').textContent = '¡Cofre de minijefe!';
  $('lvMoves').textContent = 'Elige una reliquia. Solo puedes tener una de cada una.';
  const box = $('choices'); box.innerHTML = '';
  const ids = Object.keys(RELICS).filter((id) => !player.relics[id]);
  const opts = [];
  while (opts.length < 3 && ids.length) opts.push(ids.splice((Math.random() * ids.length) | 0, 1)[0]);
  if (!opts.length) opts.push('_heal');
  for (const id of opts) {
    const r = RELICS[id] || { name: 'Gran Baya', desc: 'Ya tienes todas las reliquias: recuperas toda tu vida.' };
    const b = document.createElement('button'); b.className = 'card';
    b.innerHTML = '<div><div class="t">' + r.name + '<span class="badge b-new">' + (r.epic ? 'ÉPICO' : 'RELIQUIA') +
      '</span></div><div class="d">' + r.desc + '</div></div>';
    b.onclick = () => {
      if (RELICS[id]) { player.relics[id] = true; RELICS[id].apply(player); banner('Reliquia: ' + r.name); sfx('relic'); }
      else player.hp = player.maxHp;
      pendingRelic--;
      nextScreen();
    };
    box.appendChild(b);
  }
  $('levelup').classList.add('show');
}
// después de elegir: otra reliquia, otra subida de nivel, o volver a jugar
function nextScreen() {
  if (pendingRelic > 0) openRelic();
  else if (pendingLv > 0) openLevelUp();
  else { $('levelup').classList.remove('show'); state = 'play'; resetClock(); }
}
function openLevelUp() {
  state = 'levelup'; joy.on = false;
  $('lvTitle').textContent = '¡Subiste de nivel!'; sfx('level');
  const box = $('choices'); box.innerHTML = '';
  const full = player.moves.length >= MAX_MOVES;
  $('lvMoves').innerHTML = 'Nivel ' + player.level + ' · Ataques ' + player.moves.length + '/' + MAX_MOVES +
    (full ? ' (completo: solo mejoras)' : '') + '<br>' +
    player.moves.map((m) => MOVES[m.id].name + ' ' + m.lvl).join(' · ');
  for (const o of options()) {
    const b = document.createElement('button'); b.className = 'card';
    let title, desc, badge;
    if (o.kind === 'heal') { title = 'Baya'; desc = 'Recupera 40 de vida.'; badge = '<span class="badge b-pas">CURA</span>'; }
    else if (o.kind === 'pas') {
      const d = PASSIVES[o.id], lv = (player.passives[o.id] || 0) + 1;
      title = d.name + ' Nv' + lv; desc = d.desc; badge = '<span class="badge b-pas">PASIVA</span>';
    } else {
      const d = MOVES[o.id];
      const lv = o.kind === 'new' ? 1 : player.moves.find((m) => m.id === o.id).lvl + 1;
      title = d.name + (o.kind === 'new' ? '' : ' Nv' + lv);
      desc = d.desc;
      badge = '<span class="badge b-' + d.type + '">' + TYPE_NAME[d.type] + '</span>' + (o.kind === 'new' ? '<span class="badge b-new">NUEVO</span>' : '');
    }
    b.innerHTML = '<div><div class="t">' + title + badge + '</div><div class="d">' + desc + '</div></div>';
    b.onclick = () => choose(o);
    box.appendChild(b);
  }
  $('levelup').classList.add('show');
}
function choose(o) {
  const p = player;
  if (o.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + 40);
  else if (o.kind === 'pas') { p.passives[o.id] = (p.passives[o.id] || 0) + 1; PASSIVES[o.id].apply(p); }
  else if (o.kind === 'new') p.moves.push({ id: o.id, lvl: 1, t: 0.2 });
  else p.moves.find((m) => m.id === o.id).lvl++;
  pendingLv--;
  if (p.stage < EVO_LEVELS.length && p.level >= EVO_LEVELS[p.stage]) {
    const before = pname(p);
    p.stage++;
    const hp = p.stage === 1 ? 30 : 50;
    p.maxHp += hp; p.hp = p.maxHp; p.dmgMul += p.stage === 1 ? 0.15 : 0.25; p.speed += 3;
    addFx('ring', p.x, p.y, 60, 0.6, '#ffcd75');
    banner('¡' + before + ' evolucionó en ' + pname(p) + '!'); sfx('evolve');
    markSeen(p.type, p.stage);
  }
  updateHud();
  nextScreen();
}

// ---------- Dibujo ----------
function render() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0); // todo se dibuja en coordenadas lógicas; el lienzo es RS veces más grande
  const p = player;
  const cx = Math.round(p.x) - (W >> 1), cy = Math.round(p.y) - (H >> 1);
  // suelo
  const ox = ((cx % 64) + 64) % 64, oy = ((cy % 64) + 64) % 64;
  ctx.save(); ctx.translate(-ox, -oy); ctx.fillStyle = groundPat; ctx.fillRect(0, 0, W + 64, H + 64); ctx.restore();

  // cristales
  for (const g of gems) {
    const x = g.x - cx, y = g.y - cy;
    if (x < -6 || y < -6 || x > W + 6 || y > H + 6) continue;
    const s = g.chest ? SPR.chest : g.berry ? SPR.berry : g.v >= 25 ? SPR.gem25 : g.v >= 5 ? SPR.gem5 : SPR.gem1;
    if (g.chest) { // brillo para que se note
      ctx.globalAlpha = 0.35 + 0.25 * (((T * 4) | 0) & 1); ctx.fillStyle = '#ffcd75';
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      ctx.drawImage(s.r[0], (x - 4) | 0, (y - 3) | 0);
    } else ctx.drawImage(s.r[0], (x - 2) | 0, (y - 2) | 0);
  }

  // zonas: aviso (círculo) antes de golpear, y manchas en el suelo
  for (const z of zones) {
    const x = z.x - cx, y = z.y - cy;
    if (z.delay > 0) {
      ctx.globalAlpha = 0.75; ctx.strokeStyle = z.col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, z.r, 0, Math.PI * 2); ctx.stroke();
    } else if (!z.burst) {
      ctx.globalAlpha = Math.min(0.4, z.life); ctx.fillStyle = z.col;
      ctx.beginPath(); ctx.arc(x, y, z.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // campo estático alrededor del jugador
  for (const m of p.moves) if (m.id === 'campo') {
    ctx.globalAlpha = 0.18 + 0.1 * (((T * 10) | 0) & 1); ctx.fillStyle = '#ffcd75';
    ctx.beginPath(); ctx.arc(W >> 1, H >> 1, MOVES.campo.radius(m.lvl), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // efectos de suelo (anillos, explosiones)
  for (const f of fx) {
    const k = 1 - f.life / f.max, x = f.x - cx, y = f.y - cy;
    if (f.kind === 'ring' || f.kind === 'boom') {
      ctx.globalAlpha = 0.5 * (1 - k);
      ctx.fillStyle = f.col;
      ctx.beginPath(); ctx.arc(x, y, f.v * (f.kind === 'ring' ? k : 0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // enemigos
  for (const e of enemies) {
    const x = e.x - cx, y = e.y - cy, s = e.spr, w = s.w * e.scale, h = s.h * e.scale;
    if (x < -w || y < -h || x > W + w || y > H + h) continue;
    const fr = ((T * 5 + e.id * 0.37) | 0) & 1;
    const img = e.flash > 0 ? s.white[fr] : (e.x > p.x ? s.l[fr] : s.r[fr]);
    ctx.drawImage(img, (x - w / 2) | 0, (y - h / 2) | 0, w, h);
    if (e.boss || e.mini) {
      ctx.fillStyle = '#1a1c2c'; ctx.fillRect((x - 16) | 0, (y - h / 2 - 5) | 0, 32, 3);
      ctx.fillStyle = e.mini ? '#ffcd75' : '#b13e53';
      ctx.fillRect((x - 15) | 0, (y - h / 2 - 4) | 0, Math.max(0, 30 * e.hp / e.maxHp) | 0, 1);
    }
    if (e.mini) ctx.drawImage(SPR.crown.r[0], (x - 3) | 0, (y - h / 2 - 10) | 0);
  }

  // jugador
  // los pies quedan siempre en la misma línea; las evoluciones crecen hacia arriba
  const ps = SPR[p.type + (p.stage ? p.stage + 1 : '')];
  const foot = (H >> 1) + 8, px = (W >> 1) - (ps.w >> 1), py = foot - ps.h;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(px + 3, foot - 1, ps.w - 6, 2);
  const fr = p.moving ? ((T * 8) | 0) & 1 : ((T * 2.5) | 0) & 1;
  if (p.inv <= 0 || ((T * 20) | 0) % 2) ctx.drawImage((p.face > 0 ? ps.r : ps.l)[fr], px, py, ps.w, ps.h);
  if (p.stage === 2 && ((T * 3) | 0) % 2) { ctx.fillStyle = '#ffcd75'; ctx.fillRect(px - 1, py + 4, 1, 1); ctx.fillRect(px + ps.w, py + 10, 1, 1); }
  // barra de vida
  const bx = (W >> 1) - 8;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(bx + 1, foot + 2, 14, 3);
  ctx.fillStyle = p.hp / p.maxHp < 0.3 ? '#ef7d57' : '#38b764';
  ctx.fillRect(bx + 2, foot + 3, Math.max(0, Math.round(12 * p.hp / p.maxHp)), 1);

  // reliquias visibles: orbes y escudo
  if (p.relics.orbes) {
    for (let i = 0; i < 3; i++) {
      const a = p.orbAng + i * Math.PI * 2 / 3, ox = Math.round(W / 2 + Math.cos(a) * 38), oy = Math.round(H / 2 + Math.sin(a) * 38);
      ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.arc(ox, oy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = TYPE_COL[p.type]; ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect(ox - 2, oy - 2, 1, 1);
    }
  }
  if (p.relics.escudo && p.shieldT <= 0) {
    ctx.globalAlpha = 0.55; ctx.strokeStyle = '#a5f0ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(W >> 1, foot - (ps.h >> 1), (ps.h >> 1) + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // hojas orbitando
  for (const m of p.moves) if (m.id === 'hojas') {
    const d = MOVES.hojas, n = d.count(m.lvl), R = d.radius(m.lvl);
    for (let i = 0; i < n; i++) {
      const a = (m.ang || 0) + i * Math.PI * 2 / n;
      ctx.drawImage(SPR.leaf.r[0],Math.round(W / 2 + Math.cos(a) * R - 2), Math.round(H / 2 + Math.sin(a) * R - 1));
    }
  }

  // proyectiles
  for (const b of bullets) {
    const x = b.x - cx, y = b.y - cy;
    if (!b.spr) { // ola: círculo semitransparente con borde claro
      ctx.globalAlpha = 0.55; ctx.fillStyle = b.col;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#a5f0ff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    const img = b.boomer !== undefined && ((T * 14) | 0) & 1 ? b.spr.l[0] : b.spr.r[0];
    ctx.drawImage(img, Math.round(x - b.spr.w / 2), Math.round(y - b.spr.h / 2));
  }

  // efectos encima (látigo, rayo, humo)
  for (const f of fx) {
    const k = 1 - f.life / f.max, x = f.x - cx, y = f.y - cy;
    if (f.kind === 'whip') {
      ctx.fillStyle = f.col; const len = f.v * Math.min(1, k * 3);
      ctx.fillRect(Math.min(x, x + len) | 0, (y - 1) | 0, Math.abs(len) | 0, 2);
    } else if (f.kind === 'bolt') {
      ctx.fillStyle = f.col; let bx = x;
      for (let yy = y - 80; yy < y; yy += 6) { ctx.fillRect(bx | 0, yy | 0, 2, 6); bx += ((yy * 7) & 2) - 1; }
      ctx.fillRect((x - 3) | 0, (y - 1) | 0, 6, 2);
    } else if (f.kind === 'geyser') {
      const h = Math.round(28 * (1 - k)), wd = Math.max(4, Math.round(f.v * 0.6));
      ctx.globalAlpha = 0.8; ctx.fillStyle = f.col;
      ctx.fillRect((x - wd / 2) | 0, (y - h) | 0, wd, h);
      ctx.fillStyle = '#f4f4f4'; ctx.fillRect((x - 1) | 0, (y - h) | 0, 2, 2);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'chain') {
      const pt = f.v;
      ctx.strokeStyle = f.col; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(pt[0] - cx, pt[1] - cy);
      for (let i = 2; i < pt.length; i += 2) {
        const mx = (pt[i - 2] + pt[i]) / 2 - cx + rand(-3, 3), my = (pt[i - 1] + pt[i + 1]) / 2 - cy + rand(-3, 3);
        ctx.lineTo(mx, my); ctx.lineTo(pt[i] - cx, pt[i + 1] - cy);
      }
      ctx.stroke();
    } else if (f.kind === 'puff') {
      ctx.fillStyle = f.col; const r = f.v * (0.5 + k);
      ctx.globalAlpha = 1 - k;
      ctx.fillRect((x - r) | 0, (y) | 0, 1, 1); ctx.fillRect((x + r) | 0, (y) | 0, 1, 1);
      ctx.fillRect((x) | 0, (y - r) | 0, 1, 1); ctx.fillRect((x) | 0, (y + r) | 0, 1, 1);
      ctx.globalAlpha = 1;
    }
  }

  // números de daño
  for (const n of nums) drawText(n.s, n.x - cx - textWidth(n.s, 1) / 2, n.y - cy, n.col, 1);

  // HUD: barra de experiencia y tiempo
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = '#73eff7'; ctx.fillRect(0, 1, Math.round(W * p.xp / p.xpNext), 2);
  const tt = Math.floor(T), ts = Math.floor(tt / 60) + ':' + String(tt % 60).padStart(2, '0');
  drawText(ts, (W - textWidth(ts, 2)) / 2, 8, T >= WIN_TIME - 30 ? 'y' : 'w', 2);

  if (hurtFlash > 0) { ctx.fillStyle = 'rgba(177,62,83,.25)'; ctx.fillRect(0, 0, W, H); }

  // joystick
  if (joy.on) {
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#f4f4f4';
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 20, 0, Math.PI * 2); ctx.fill();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, l = Math.hypot(dx, dy), k = l > 20 ? 20 / l : 1;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(joy.ox + dx * k, joy.oy + dy * k, 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------- Interfaz ----------
let bannerTimer = 0;
function banner(txt) {
  const b = $('banner'); b.textContent = txt; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), 2200);
}
let lastHudLv = -1, lastHudKills = -1;
function updateHud() {
  const lvKey = player.level * 10 + player.stage;
  if (lvKey !== lastHudLv) { lastHudLv = lvKey; $('hudLv').textContent = pname(player) + ' Nv ' + player.level; }
  if (kills !== lastHudKills) { lastHudKills = kills; $('hudKills').textContent = kills + ' ☠'; }
}

// ---------- Sonido ----------
// Todo se genera con el sintetizador del navegador: no hay archivos de audio que descargar.
const audio = { ctx: null, master: null, musicGain: null, noiseBuf: null, last: {},
  sfx: load('elementa.sfx', true), music: load('elementa.music', true) };
function audioInit() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audio.ctx = new AC();
  audio.master = audio.ctx.createGain(); audio.master.gain.value = 0.35; audio.master.connect(audio.ctx.destination);
  audio.musicGain = audio.ctx.createGain(); audio.musicGain.gain.value = 0.16; audio.musicGain.connect(audio.master);
  const len = audio.ctx.sampleRate * 0.4;
  audio.noiseBuf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
  const d = audio.noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
// iPhone solo permite sonido después de que el jugador toca la pantalla
window.addEventListener('pointerdown', audioInit);
const audioOn = () => audio.ctx && audio.ctx.state === 'running';
function tone(freq, dur, type, vol, slide, delay, dest) {
  const c = audio.ctx, t = c.currentTime + (delay || 0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || audio.master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol) {
  const c = audio.ctx, t = c.currentTime, s = c.createBufferSource(), g = c.createGain();
  s.buffer = audio.noiseBuf;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g); g.connect(audio.master); s.start(t); s.stop(t + dur);
}
const arp = (notes, step, type, vol) => notes.forEach((f, i) => tone(f, step * 1.6, type, vol, 0, i * step));
const SFX = {
  hit: () => tone(320, 0.05, 'square', 0.04, 0.6),
  kill: () => tone(480, 0.08, 'triangle', 0.07, 1.8),
  hurt: () => { tone(170, 0.2, 'sawtooth', 0.12, 0.45); noise(0.08, 0.06); },
  block: () => tone(1200, 0.12, 'sine', 0.08, 0.7),
  level: () => arp([523, 659, 784, 1047], 0.06, 'square', 0.06),
  evolve: () => arp([392, 523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.12),
  chest: () => arp([659, 880, 1175], 0.07, 'square', 0.07),
  relic: () => arp([784, 988, 1319, 1568], 0.06, 'triangle', 0.1),
  boss: () => { tone(110, 0.7, 'sawtooth', 0.12, 0.6); noise(0.4, 0.05); },
  boom: () => { noise(0.35, 0.12); tone(90, 0.3, 'sine', 0.15, 0.5); },
  revive: () => arp([262, 392, 523, 784], 0.1, 'triangle', 0.12),
  win: () => arp([523, 659, 784, 1047, 784, 1047], 0.13, 'square', 0.08),
  lose: () => arp([392, 330, 262, 196], 0.16, 'triangle', 0.1),
};
function sfx(name, minGapMs) {
  if (!audio.sfx || !audioOn()) return;
  const now = performance.now();
  if (now - (audio.last[name] || 0) < (minGapMs || 0)) return;
  audio.last[name] = now;
  SFX[name]();
}
// Música: un bucle original en escala pentatónica, generado una vez con notas al azar
const SCALE = [0, 3, 5, 7, 10, 12, 15];
const ROOTS = [57, 53, 48, 55];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const MELODY = (() => {
  let s = 1234;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 32 }, (_, i) => (i % 8 === 0 || r() < 0.5) ? (r() * SCALE.length) | 0 : -1);
})();
let musicNext = 0, musicStep = 0;
function musicTick() {
  if (!audio.music || !audioOn()) return;
  const c = audio.ctx, beat = 0.22;
  if (musicNext < c.currentTime) musicNext = c.currentTime + 0.05;
  while (musicNext < c.currentTime + 0.25) {
    const s = musicStep % 32, root = ROOTS[s >> 3], at = musicNext - c.currentTime;
    if (s % 4 === 0) tone(mtof(root - 12), beat * 3.5, 'triangle', 0.3, 0, at, audio.musicGain);
    if (MELODY[s] >= 0) tone(mtof(root + 12 + SCALE[MELODY[s]]), beat * 0.9, 'square', 0.07, 0, at, audio.musicGain);
    musicNext += beat; musicStep++;
  }
}

// ---------- Monedas y mejoras permanentes ----------
const META_UP = {
  vida: { name: 'Vida', desc: '+12 de vida inicial', max: 5, cost: (l) => 40 + l * 45 },
  fuerza: { name: 'Fuerza', desc: '+6% de daño', max: 5, cost: (l) => 50 + l * 55 },
  velocidad: { name: 'Velocidad', desc: '+4% de velocidad', max: 5, cost: (l) => 40 + l * 40 },
  iman: { name: 'Imán', desc: '+15% radio para recoger cristales', max: 5, cost: (l) => 30 + l * 35 },
  sabiduria: { name: 'Sabiduría', desc: '+8% de experiencia', max: 5, cost: (l) => 60 + l * 60 },
  revivir: { name: 'Segunda Oportunidad', desc: 'Revives una vez por partida con 50% de vida', max: 1, cost: () => 350 },
};
function meta() { const m = Object.assign({ coins: 0, up: {} }, load('elementa.meta', {})); m.up = m.up || {}; return m; }
function applyMeta(p) {
  const u = meta().up;
  p.maxHp += 12 * (u.vida || 0); p.hp = p.maxHp;
  p.dmgMul += 0.06 * (u.fuerza || 0);
  p.speed *= 1 + 0.04 * (u.velocidad || 0);
  p.magnet *= 1 + 0.15 * (u.iman || 0);
  p.xpMul = 1 + 0.08 * (u.sabiduria || 0);
  p.revives = u.revivir ? 1 : 0;
}
function runCoins(win) { return Math.floor(kills / 4 + T / 10 + (win ? 150 : 0)); }
function openShop() {
  const m = meta(), list = $('shopList');
  $('shopCoins').innerHTML = '<span class="coin"></span> ' + m.coins + ' monedas';
  list.innerHTML = '';
  for (const id in META_UP) {
    const u = META_UP[id], lv = m.up[id] || 0, maxed = lv >= u.max, cost = u.cost(lv);
    const row = document.createElement('div'); row.className = 'card shop-row';
    row.innerHTML = '<div style="flex:1"><div class="t">' + u.name + ' <span class="badge b-pas">' + (u.max > 1 ? 'Nv ' + lv + '/' + u.max : (lv ? 'LISTO' : 'ÚNICA')) +
      '</span></div><div class="d">' + u.desc + '</div></div>';
    const b = document.createElement('button'); b.className = 'btn buy';
    b.innerHTML = maxed ? 'Máx' : '<span class="coin"></span> ' + cost;
    b.disabled = maxed || m.coins < cost;
    b.onclick = () => {
      const mm = meta(), l2 = mm.up[id] || 0, c2 = u.cost(l2);
      if (l2 >= u.max || mm.coins < c2) return;
      mm.coins -= c2; mm.up[id] = l2 + 1; save('elementa.meta', mm);
      sfx('relic'); openShop(); updateMenuCoins();
    };
    row.appendChild(b); list.appendChild(row);
  }
  $('shop').classList.add('show');
}
function updateMenuCoins() { const el = $('menuCoins'); if (el) el.innerHTML = '<span class="coin"></span> ' + meta().coins; }
// Revivir: empuja y daña a los enemigos cercanos para darte un respiro
function revive() {
  const p = player;
  p.revives--; p.hp = Math.round(p.maxHp * 0.5); p.inv = 2.5; hurtFlash = 0;
  addFx('ring', p.x, p.y, 90, 0.6, '#ffcd75');
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 90) { e.kx += dx / d * 260 * e.kbRes; e.ky += dy / d * 260 * e.kbRes; hurt(e, 30, p.type, 0, 0); }
  }
  banner('¡Segunda oportunidad!'); sfx('revive');
}

// ---------- Menú principal ----------
const TYPES = ['water', 'fire', 'plant', 'elec'];
// Voltín se desbloquea al ganar una partida (si ya ganaste antes, queda desbloqueado de inmediato)
function isOpen(type) {
  if (type !== 'elec') return true;
  const best = load('elementa.best', null);
  return load('elementa.unlocked', []).indexOf('elec') !== -1 || !!(best && best.win);
}
function unlock(type) {
  const u = load('elementa.unlocked', []);
  if (u.indexOf(type) === -1) { u.push(type); save('elementa.unlocked', u); }
}
let selIdx = Math.max(0, TYPES.indexOf(load('elementa.sel', 'water')));

function seen() { return Object.assign({ water: 0, fire: 0, plant: 0, elec: 0 }, load('elementa.seen', {})); }
function markSeen(type, stage) {
  const s = seen();
  if (s[type] < stage) { s[type] = stage; save('elementa.seen', s); }
}
// dibuja un sprite con los pies apoyados abajo y centrado en un lienzo
function drawFoot(canvas, img, w, h) {
  // el lienzo representa 36 píxeles lógicos; w y h vienen en píxeles lógicos
  const g = canvas.getContext('2d'), k = canvas.width / 36;
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.drawImage(img, Math.round((canvas.width - w * k) / 2), Math.round(canvas.height - h * k), Math.round(w * k), Math.round(h * k));
}

function showMenu() {
  state = 'menu';
  $('hud').style.display = 'none';
  for (const id of ['levelup', 'pause', 'over', 'dex', 'settings', 'shop']) $(id).classList.remove('show');
  updateMenuCoins();
  $('menu').classList.add('show');
  const best = load('elementa.best', null);
  $('best').innerHTML = best
    ? 'Récord ' + fmt(best.t) + ' · Nivel ' + best.lv + (best.win ? ' · ¡Ganaste!' : '')
    : 'Aún no tienes récord';
  selectStarter(0);
  if (!scene.mobs.length) initScene();
}
function fmt(t) { t = Math.floor(t); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }

function selectStarter(delta) {
  selIdx = (selIdx + delta + TYPES.length) % TYPES.length;
  const type = TYPES[selIdx], st = STARTERS[type];
  save('elementa.sel', type);
  const open = isOpen(type);
  $('vitrina').className = 'vitrina ' + type + (open ? '' : ' locked');
  $('sName').textContent = open ? st.names[0] : '???';
  $('sBadge').innerHTML = '<span class="badge b-' + type + '">' + TYPE_NAME[type] + '</span>' +
    (open ? '<span class="badge b-pas">' + MOVES[st.move].name + '</span>' : '<span class="badge b-pas">BLOQUEADO</span>');
  $('sDesc').textContent = open ? st.desc : 'Gana una partida (vence al jefe final) para desbloquearlo.';
  $('btnPlay').disabled = !open;
  $('btnPlay').textContent = open ? 'JUGAR' : 'BLOQUEADO';
  $('dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i === selIdx));
}

function buildMenu() {
  $('prevS').onclick = () => selectStarter(-1);
  $('nextS').onclick = () => selectStarter(1);
  $('btnPlay').onclick = () => { if (isOpen(TYPES[selIdx])) start(TYPES[selIdx]); };
  // deslizar el dedo sobre la vitrina también cambia de criatura
  let sx = null;
  $('vitrina').addEventListener('pointerdown', (e) => { sx = e.clientX; });
  $('vitrina').addEventListener('pointerup', (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 30) selectStarter(e.clientX < sx ? 1 : -1);
    sx = null;
  });
  $('btnDex').onclick = openDex;
  $('dexBack').onclick = () => $('dex').classList.remove('show');
  $('btnSet').onclick = () => $('settings').classList.add('show');
  $('setBack').onclick = () => $('settings').classList.remove('show');
  $('btnShop').onclick = openShop;
  $('shopBack').onclick = () => $('shop').classList.remove('show');
  const sf = $('optSfx'), mu = $('optMusic');
  sf.checked = audio.sfx; mu.checked = audio.music;
  sf.onchange = () => { audio.sfx = sf.checked; save('elementa.sfx', audio.sfx); };
  mu.onchange = () => { audio.music = mu.checked; save('elementa.music', audio.music); };
  const lp = $('lowPower'); lp.checked = lowPower;
  lp.onchange = () => { lowPower = lp.checked; save('elementa.low', lowPower); };
}

function openDex() {
  const grid = $('dexGrid'), s = seen();
  grid.innerHTML = '';
  for (const type of TYPES) for (let st = 0; st < 3; st++) {
    const sp = SPR[type + (st ? st + 1 : '')], open = isOpen(type) && st <= s[type];
    const cell = document.createElement('div');
    const c = document.createElement('canvas'); c.width = 36 * RS; c.height = 36 * RS;
    drawFoot(c, open ? sp.r[0] : sp.dark[0], sp.w, sp.h);
    cell.appendChild(c);
    const label = document.createElement('span');
    label.innerHTML = (open ? STARTERS[type].names[st] : '???') + '<small>' + (st ? 'Nv ' + EVO_LEVELS[st - 1] : 'Inicial') + '</small>';
    cell.appendChild(label);
    grid.appendChild(cell);
  }
  $('dex').classList.add('show');
}

// Fondo del menú: el mapa con criaturas paseando (a 20 FPS para no gastar batería)
const scene = { t: 0, cam: 0, decor: [], mobs: [] };
const SCENE_SPAN = 260;
function initScene() {
  let s = 11;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  scene.decor = [];
  for (let i = 0; i < 30; i++) {
    const k = r();
    scene.decor.push({ x: r() * SCENE_SPAN, y: 10 + r() * (H - 10), spr: k < 0.7 ? SPR.tuft : k < 0.85 ? SPR.flower : SPR.crystal });
  }
  scene.mobs = [];
  for (const k of ['water', 'fire', 'plant', 'water2', 'fire2', 'plant2', 'slimeW', 'wisp', 'mush', 'bat', 'rock', 'spark', 'slimeW', 'mush']) {
    scene.mobs.push({ x: r() * W, y: 30 + r() * (H - 40), spr: SPR[k], vx: 0, vy: 0, t: r() * 2, face: 1 });
  }
}
function updateScene(dt) {
  scene.t += dt; scene.cam += 4 * dt;
  for (const m of scene.mobs) {
    m.t -= dt;
    if (m.t <= 0) {
      m.t = rand(1, 3);
      if (Math.random() < 0.35) { m.vx = 0; m.vy = 0; }
      else { const a = rand(0, Math.PI * 2), sp = rand(7, 16); m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp * 0.6; }
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.vx > 1) m.face = 1; else if (m.vx < -1) m.face = -1;
    if (m.x < -16) m.x = W + 16; else if (m.x > W + 16) m.x = -16;
    if (m.y < 24 || m.y > H - 4) { m.vy = -m.vy; m.y = Math.max(24, Math.min(H - 4, m.y)); }
  }
}
function renderScene() {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  const cam = scene.cam;
  const ox = (cam | 0) % 64;
  ctx.save(); ctx.translate(-ox, 0); ctx.fillStyle = groundPat; ctx.fillRect(0, 0, W + 64, H); ctx.restore();
  // ordenar por altura para que lo de abajo tape lo de arriba
  tmp.length = 0;
  for (const d of scene.decor) tmp.push(d);
  for (const m of scene.mobs) tmp.push(m);
  tmp.sort((a, b) => a.y - b.y);
  for (const o of tmp) {
    const s = o.spr;
    if (o.vx !== undefined) {
      const moving = o.vx || o.vy, fr = ((scene.t * (moving ? 6 : 2)) | 0) & 1;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect((o.x - s.w / 2 + 2) | 0, (o.y - 1) | 0, s.w - 4, 2);
      ctx.drawImage((o.face > 0 ? s.r : s.l)[fr], (o.x - s.w / 2) | 0, (o.y - s.h) | 0, s.w, s.h);
    } else {
      const x = ((o.x - cam) % SCENE_SPAN + SCENE_SPAN) % SCENE_SPAN - 40;
      ctx.drawImage(s.r[0], x | 0, (o.y - s.h) | 0);
    }
  }
}
function drawShowcase() {
  const type = TYPES[selIdx], sp = SPR[type], fr = ((scene.t * 2.5) | 0) & 1;
  drawFoot($('showCv'), (isOpen(type) ? sp.r : sp.dark)[fr], sp.w, sp.h);
}
function start(type) {
  player = newPlayer(type);
  applyMeta(player);
  musicStep = 0;
  T = 0; kills = 0; spawnT = 0; nextElite = 50; nextHorde = 75; bossIdx = 0; miniIdx = 0; pendingRelic = 0; won = false; winAt = -1;
  enemies = []; bullets = []; gems = []; fx = []; nums = []; zones = []; pendingLv = 0; uid = 0; hurtFlash = 0;
  lastHudLv = -1; lastHudKills = -1;
  $('menu').classList.remove('show'); $('over').classList.remove('show');
  $('hud').style.display = 'flex';
  updateHud();
  state = 'play'; resetClock();
}
function togglePause() {
  if (state === 'play') {
    state = 'pause'; joy.on = false;
    $('pauseInfo').innerHTML = pname(player) + ' · Nv ' + player.level + '<br>' +
      player.moves.map((m) => MOVES[m.id].name + ' ' + m.lvl).join(' · ') +
      (Object.keys(player.relics).length ? '<br>Reliquias: ' + Object.keys(player.relics).map((id) => RELICS[id].name).join(' · ') : '');
    $('pause').classList.add('show');
  } else if (state === 'pause') {
    $('pause').classList.remove('show'); state = 'play'; resetClock();
  }
}
function gameOver(win) {
  state = 'over'; joy.on = false;
  render();
  const best = load('elementa.best', null);
  const rec = { t: T, lv: player.level, win };
  const isBest = !best || (win && !best.win) || (win === best.win && T > best.t);
  if (isBest) save('elementa.best', rec);
  const newChar = win && load('elementa.unlocked', []).indexOf('elec') === -1;
  if (win) unlock('elec');
  const coins = runCoins(win), m = meta();
  m.coins += coins; save('elementa.meta', m);
  sfx(win ? 'win' : 'lose');
  $('overTitle').textContent = win ? '¡Victoria!' : 'Derrota';
  $('overStats').innerHTML = 'Tiempo ' + fmt(T) + '<br>Nivel ' + player.level + '<br>Derrotados ' + kills +
    '<br><span style="color:var(--gold)"><span class="coin"></span> +' + coins + ' monedas</span>' + (isBest ? '<br><span style="color:var(--gold)">¡Nuevo récord!</span>' : '') +
    (newChar ? '<br><span style="color:var(--elec)">¡Desbloqueaste a Voltín (Eléctrico)!</span>' : '');
  $('over').classList.add('show');
}
$('btnPause').addEventListener('click', togglePause);
$('btnResume').addEventListener('click', togglePause);
$('btnQuit').addEventListener('click', showMenu);
$('btnAgain').addEventListener('click', showMenu);
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });

// ---------- Bucle principal ----------
// Solo dibuja mientras se juega; en menús la pantalla queda quieta (cero consumo).
let last = 0, menuLast = 0;
function resetClock() { last = 0; dirty = true; }
function loop(ts) {
  requestAnimationFrame(loop);
  if (state === 'menu') { // menú animado a 20 FPS
    if (ts - menuLast < 48) return;
    const mdt = menuLast ? Math.min(0.1, (ts - menuLast) / 1000) : 0.05;
    menuLast = ts;
    updateScene(mdt); renderScene(); drawShowcase();
    return;
  }
  menuLast = 0;
  if (state !== 'play') {
    if (dirty && player) { render(); dirty = false; }
    return;
  }
  if (last && lowPower && ts - last < 1000 / 30 - 3) return;
  const dt = last ? Math.min(0.05, (ts - last) / 1000) : 1 / 60;
  last = ts;
  update(dt);
  musicTick();
  if (state === 'play' || state === 'levelup') render();
  updateHud();
}

function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  H = Math.round(Math.min(420, Math.max(260, W * vh / vw)));
  cv.width = W * RS; cv.height = H * RS;
  const s = Math.min(vw / W, vh / H);
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
  ctx.imageSmoothingEnabled = false;
  buildGrid();
  if (player) fillGrid();
  dirty = true;
}

buildSprites(); buildFont(); buildGround(); buildMenu();
// Atajo de prueba solo en tu PC (localhost): __dev.xp(500) da experiencia
if (location.hostname === 'localhost') window.__dev = {
  xp: (v) => gainXp(v), get player() { return player; }, SPR,
  sound: () => { audioInit(); Object.keys(SFX).forEach((k) => SFX[k]()); const was = audio.ctx.state; musicNext = 0; for (let i = 0; i < 3; i++) { const s = audio.ctx.state; Object.defineProperty(audio.ctx, 'state', { value: 'running', configurable: true }); musicTick(); Object.defineProperty(audio.ctx, 'state', { value: s, configurable: true }); } return [was, musicStep]; },
  coins: (n) => { const m = meta(); m.coins += n; save('elementa.meta', m); updateMenuCoins(); },
  relic: (id) => { player.relics[id] = true; RELICS[id].apply(player); },
  chests: () => gems.filter((g) => g.chest).length,
  openRelic: () => { pendingRelic = 1; openRelic(); },
  minis: () => enemies.filter((e) => e.mini).map((e) => Math.round(e.hp)),
  mini: () => spawnEnemy('piedrin', { scale: 2, hpMul: 22, xpMul: 15, dmgMul: 2, spdMul: 0.95, mini: true, x: player.x + 40, y: player.y }),
  give: (ids) => { player.moves = ids.map((id) => ({ id, lvl: 4, t: 0.2 })); },
  stats: () => ({ enemies: enemies.length, bullets: bullets.length, zones: zones.length, fx: fx.length, kills, hp: Math.round(player.hp), T: Math.round(T) }),
  // avanza n cuadros a mano (sirve aunque la pestaña esté en segundo plano)
  step: (n) => {
    for (const id of ['pause', 'levelup']) $(id).classList.remove('show');
    pendingLv = 0;
    for (let i = 0; i < n; i++) { state = 'play'; update(1 / 60); player.hp = player.maxHp; pendingLv = 0; pendingRelic = 0; }
    render(); state = 'pause';
    return window.__dev.stats();
  },
};
// Arte de las criaturas (PNG con transparencia en sprites/). Reemplaza a los sprites dibujados con código.
// Si una imagen no carga, el juego sigue usando el sprite de código para esa criatura.
const ART = ['water1', 'water2', 'water3', 'fire1', 'fire2', 'fire3', 'plant1', 'plant2', 'plant3', 'elec2', 'elec3'];
const ART_FACES_LEFT = { fire2: true }; // dibujos que miran a la izquierda
function imgSprite(img, facesLeft) {
  // la imagen viene a RS veces la resolución lógica
  const iw = img.width, ih = img.height;
  const f0 = document.createElement('canvas'); f0.width = iw; f0.height = ih;
  f0.getContext('2d').drawImage(img, 0, 0);
  // segundo cuadro: 1 px lógico más bajo, apoyado en los pies (efecto respirar)
  const f1 = document.createElement('canvas'); f1.width = iw; f1.height = ih;
  const g = f1.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0, iw, ih, 0, RS, iw, ih - RS);
  const r = [f0, f1], l = r.map((c) => variant(c, 'flip'));
  return { r: facesLeft ? l : r, l: facesLeft ? r : l, white: r.map((c) => variant(c, 'white')), dark: r.map((c) => variant(c, 'dark')), w: iw / RS, h: ih / RS };
}
function loadArt() {
  return Promise.all(ART.map((k) => new Promise((done) => {
    const im = new Image();
    im.onload = () => { SPR[k.replace(/1$/, '')] = imgSprite(im, ART_FACES_LEFT[k]); done(); };
    im.onerror = () => done();
    im.src = 'sprites/' + k + '.png';
  })));
}

window.addEventListener('resize', resize);
resize();
loadArt().then(() => { showMenu(); requestAnimationFrame(loop); });
})();
