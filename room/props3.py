# ---------------------------------------------------------------- v3 detail props (reference-level clutter, all original)
import random, numpy as np
random.seed(11)
RECIPES3 = {}
def M(name, color, rough=0.6, kind=None, **kw):
    m = mat(name, color, rough, **kw)
    if kind: RECIPES3[name] = kind
    return m
chairWood = M('chairWood', (0.50, 0.30, 0.13), 0.45, 'wood')
shelfWood = M('shelfWood', (0.36, 0.21, 0.10), 0.5, 'wood')
cardboard = M('cardboard', (0.55, 0.40, 0.24), 0.9, 'paper')
gold = M('gold', (0.85, 0.62, 0.20), 0.25, 'metal', metal=1.0)
chrome = M('chrome', (0.8, 0.8, 0.82), 0.15, 'metal', metal=1.0)
toyYellow = M('toyYellow', (0.95, 0.72, 0.05), 0.35, 'plastic'); toyOrange = M('toyOrange', (0.92, 0.33, 0.05), 0.35, 'plastic')
toyRed = M('toyRed', (0.75, 0.08, 0.06), 0.35, 'plastic'); toyBlue = M('toyBlue', (0.08, 0.25, 0.7), 0.35, 'plastic')
toyGreen = M('toyGreen', (0.10, 0.55, 0.25), 0.35, 'plastic')
rubber = M('rubber', (0.03, 0.03, 0.03), 0.8, 'plastic')
boomGrey = M('boomGrey', (0.20, 0.21, 0.23), 0.4, 'plastic'); boomSilver = M('boomSilver', (0.62, 0.63, 0.65), 0.3, 'metal', metal=0.8)
globeBlue = M('globeBlue', (0.10, 0.32, 0.62), 0.35, 'plastic'); globeLand = M('globeLand', (0.30, 0.50, 0.20), 0.6, 'plastic')
clockRed = M('clockRed', (0.70, 0.07, 0.06), 0.3, 'plastic'); clockFace = M('clockFace', (0.95, 0.93, 0.85), 0.6, 'paper')
tapeBody = M('tapeBody', (0.10, 0.10, 0.11), 0.4, 'plastic'); tapeClear = M('tapeClear', (0.55, 0.50, 0.42), 0.3, 'plastic')
bagBlue = M('bagBlue', (0.08, 0.14, 0.38), 0.85, 'fabric'); bagRed = M('bagRed', (0.60, 0.10, 0.08), 0.85, 'fabric')
pinRed = M('pinRed', (0.85, 0.08, 0.08), 0.3, 'plastic'); pinYel = M('pinYel', (0.95, 0.8, 0.1), 0.3, 'plastic')
paperW = M('paperW', (0.93, 0.92, 0.88), 0.85, 'paper')
pencilY = M('pencilY', (0.95, 0.72, 0.10), 0.5, 'plastic'); eraserP = M('eraserP', (0.92, 0.55, 0.62), 0.8, 'plastic')
glassM = bpy.data.materials.new('winGlass'); glassM.use_nodes = True
_g = glassM.node_tree.nodes['Principled BSDF']; _g.inputs['Transmission Weight'].default_value = 1.0; _g.inputs['Roughness'].default_value = 0.03; _g.inputs['IOR'].default_value = 1.1

def pic(name, img, w, h, loc, rot, rough=0.75):
    m = mat('pic_' + name, (1, 1, 1), rough, image=img); RECIPES3['pic_' + name] = 'paper'
    return plane(name, w, h, loc, rot, m)

# ---- generated textures: persian-style rug + golden-hour view outside the window
def make_image(name, arr):
    h, w, _ = arr.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.concatenate([arr, np.ones((h, w, 1), np.float32)], axis=2)
    img.pixels = rgba[::-1].ravel().tolist(); img.pack(); return img
def img_mat(name, img, rough=0.9, emit=0.0, kind=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.name = 'albedo'
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if emit:
        nt.links.new(tex.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    if kind: RECIPES3[name] = kind
    return m
W_, H_ = 1024, 720
yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
u = xx / W_; v = yy / H_
red = np.array([0.42, 0.05, 0.06], np.float32); navy = np.array([0.05, 0.07, 0.20], np.float32); cream = np.array([0.80, 0.70, 0.50], np.float32); rust = np.array([0.55, 0.20, 0.08], np.float32)
rugA = np.zeros((H_, W_, 3), np.float32) + red
edge = np.minimum(np.minimum(u, 1 - u) * (W_ / H_), np.minimum(v, 1 - v))
lat = (np.abs(((u * 14 + v * 10) % 1) - 0.5) < 0.07) | (np.abs(((u * 14 - v * 10) % 1) - 0.5) < 0.07)
rugA[lat] = rust
dots = (((u * 14 + v * 10) % 1 - 0.5) ** 2 + ((u * 14 - v * 10) % 1 - 0.5) ** 2) < 0.012
rugA[dots] = cream
rugA[edge < 0.16] = navy
zig = np.abs(((u * 40 + np.abs(((v * 30) % 1) - 0.5)) % 1) - 0.5) < 0.12
rugA[(edge < 0.16) & (edge > 0.05) & zig] = cream
rugA[(edge < 0.05)] = red
rugA[(np.abs(edge - 0.165) < 0.006) | (np.abs(edge - 0.045) < 0.006)] = cream
md = np.abs(u - 0.5) * 2.2 + np.abs(v - 0.5) * 2.6
rugA[md < 0.62] = navy; rugA[md < 0.52] = cream; rugA[md < 0.47] = red; rugA[md < 0.30] = navy; rugA[md < 0.2] = rust; rugA[md < 0.08] = cream
rugA *= (0.85 + 0.3 * np.random.RandomState(3).rand(H_, W_, 1).astype(np.float32))
rugM = img_mat('rugImg', make_image('rugTex', rugA), 0.95, kind='rugimg')
rugO = S(box('rug', (2.3, 1.6, 0.008), (0.25, -0.15, 0.004), rugM))
# outside: warm sky, low sun glow, soft tree line
Ws, Hs = 512, 512
yy, xx = np.mgrid[0:Hs, 0:Ws].astype(np.float32); u = xx / Ws; v = yy / Hs   # v=0 top
top = np.array([0.45, 0.62, 0.95], np.float32); mid = np.array([1.0, 0.72, 0.42], np.float32); low = np.array([1.0, 0.50, 0.22], np.float32)
t = np.clip(v * 1.5, 0, 1)[..., None]
skyA = top * (1 - t) + mid * t
t2 = np.clip((v - 0.55) * 4, 0, 1)[..., None]; skyA = skyA * (1 - t2) + low * t2
glow = np.exp(-(((u - 0.72) * 2.2) ** 2 + ((v - 0.62) * 3.0) ** 2))[..., None]; skyA = skyA + glow * np.array([1.2, 0.9, 0.5], np.float32)
hill = 0.70 + 0.05 * np.sin(u * 9) + 0.03 * np.sin(u * 23 + 1) + 0.015 * np.sin(u * 61)
tree = np.clip((v - hill) * 40, 0, 1)[..., None]
skyA = skyA * (1 - tree) + np.array([0.10, 0.12, 0.05], np.float32) * tree
skyM = img_mat('outside', make_image('outsideTex', skyA.astype(np.float32)), 1.0, emit=3.2)
for o in list(bpy.data.objects):
    if o.name == 'sky':
        o.data.materials.clear(); o.data.materials.append(skyM); o.visible_shadow = False; S(o)
S(plane('win_glass', WX1 - WX0, WZ1 - WZ0, ((WX0 + WX1) / 2, Y1 + 0.05, (WZ0 + WZ1) / 2), (R90, 0, 0), glassM)).visible_shadow = False

# ---- wooden chair, pulled out to the right (only its back top is in frame; catches the sun)
def chair(loc, rz):
    p = []
    sw, sd, sh = 0.42, 0.42, 0.46
    p.append(box('c', (sw, sd, 0.03), (0, 0, sh), chairWood, bevel=0.008))
    for sx in (-1, 1):
        p.append(box('c', (0.04, 0.04, sh), (sx * (sw / 2 - 0.03), sd / 2 - 0.03, sh / 2), chairWood, bevel=0.006))
        p.append(box('c', (0.04, 0.04, 0.95), (sx * (sw / 2 - 0.03), -sd / 2 + 0.03, 0.475), chairWood, bevel=0.006))
        p.append(box('c', (0.025, sd - 0.08, 0.03), (sx * (sw / 2 - 0.03), 0, 0.22), chairWood, bevel=0.004))
    p.append(box('c', (sw - 0.02, 0.028, 0.09), (0, -sd / 2 + 0.03, 0.90), chairWood, bevel=0.012))
    p.append(box('c', (sw - 0.06, 0.02, 0.05), (0, -sd / 2 + 0.03, 0.62), chairWood, bevel=0.006))
    for k in range(4):
        p.append(box('c', (0.03, 0.016, 0.22), (-0.12 + k * 0.08, -sd / 2 + 0.03, 0.75), chairWood, bevel=0.004))
    return G('chair', p, loc, (0, 0, rz))
chair((0.80, -0.55, 0), 0.38)
floppy((0.74, -0.50, 0.477), (0, 0, 0.9), 0, 'SAVE 2')

# ---- low bookshelf on the left wall area, loaded with books and toys
SX0, SX1, SD, SHH = -1.44, -0.84, 0.30, 0.94
SY = Y1 - SD / 2 - 0.01
S(box('shelf_l', (0.025, SD, SHH), (SX0, SY, SHH / 2), shelfWood, bevel=0.003)); S(box('shelf_r', (0.025, SD, SHH), (SX1, SY, SHH / 2), shelfWood, bevel=0.003))
for z in (0.06, 0.36, 0.66, SHH):
    S(box('shelf_b', (SX1 - SX0 + 0.03, SD + 0.01, 0.025), ((SX0 + SX1) / 2, SY, z), shelfWood, bevel=0.003))
S(box('shelf_back', (SX1 - SX0, 0.01, SHH), ((SX0 + SX1) / 2, Y1 - 0.012, SHH / 2), shelfWood))
bcols = [M('bk%d' % i, c, 0.7, 'plastic') for i, c in enumerate([(0.6, 0.1, 0.1), (0.1, 0.25, 0.5), (0.85, 0.6, 0.15), (0.12, 0.4, 0.25), (0.35, 0.16, 0.4), (0.88, 0.85, 0.75), (0.15, 0.15, 0.17), (0.8, 0.35, 0.1), (0.1, 0.45, 0.5)])]
for z0 in (0.0725, 0.3725, 0.6725):
    x = SX0 + 0.02
    while x < SX1 - 0.06:
        w = random.uniform(0.018, 0.042); h = random.uniform(0.17, 0.26); d = random.uniform(0.15, 0.22)
        if random.random() < 0.12:   # a gap with a few lying books
            for k in range(random.randint(2, 4)):
                S(box('book_lie', (random.uniform(0.15, 0.2), 0.14, 0.022), (x + 0.09, SY - 0.02, z0 + 0.011 + k * 0.023), random.choice(bcols), bevel=0.002, rot=(0, 0, random.uniform(-0.1, 0.1))))
            x += 0.2; continue
        lean = random.uniform(-0.03, 0.03) if random.random() < 0.8 else random.uniform(0.12, 0.2)
        S(box('book_s', (w, d, h), (x + w / 2 + abs(lean) * h / 2, SY + (SD - d) / 2 - 0.02, z0 + h / 2), random.choice(bcols), bevel=0.002, rot=(0, lean, 0)))
        x += w + 0.0015 + abs(lean) * h
# boombox (generic radio-cassette) on top of the shelf
def boombox(loc, rz):
    p = [box('b', (0.36, 0.10, 0.18), (0, 0, 0.09), boomGrey, bevel=0.012)]
    for sx in (-1, 1):
        p.append(cyl('b', 0.062, 0.012, (sx * 0.115, -0.052, 0.085), boomSilver, rot=(R90, 0, 0)))
        p.append(cyl('b', 0.048, 0.016, (sx * 0.115, -0.054, 0.085), rubber, rot=(R90, 0, 0)))
        p.append(cyl('b', 0.016, 0.02, (sx * 0.115, -0.056, 0.085), boomSilver, rot=(R90, 0, 0)))
    p.append(box('b', (0.10, 0.008, 0.06), (0, -0.052, 0.075), tapeClear, bevel=0.003))
    p.append(box('b', (0.30, 0.008, 0.022), (0, -0.052, 0.155), boomSilver, bevel=0.002))
    for k in range(6): p.append(box('b', (0.022, 0.016, 0.012), (-0.07 + k * 0.028, -0.02, 0.186), boomSilver, bevel=0.002))
    p.append(bez('b', [(-0.16, 0, 0.17), (-0.15, 0, 0.25), (0.15, 0, 0.25), (0.16, 0, 0.17)], 0.008, boomGrey))
    p.append(rod('b', (0.15, 0.03, 0.18), (0.27, 0.05, 0.42), 0.003, chrome))
    return G('boombox', p, loc, (0, 0, rz))
boombox((-1.20, SY - 0.02, SHH + 0.0125), 0.12)
# globe + trophy on the shelf
gp = [sphere('g', 0.075, (0, 0, 0.13), globeBlue)]
for k in range(7):
    a, e = random.uniform(0, 6.28), random.uniform(-0.9, 0.9)
    gp.append(sphere('g', random.uniform(0.02, 0.04), (math.cos(a) * math.cos(e) * 0.062, math.sin(a) * math.cos(e) * 0.062, 0.13 + math.sin(e) * 0.062), globeLand, scale=(1, 1, 0.6)))
gp.append(cyl('g', 0.05, 0.012, (0, 0, 0.006), shelfWood)); gp.append(rod('g', (0, 0, 0.01), (0, 0, 0.055), 0.006, gold))
gp.append(bez('g', [(0, 0, 0.045), (0.085, 0, 0.07), (0.092, 0, 0.14), (0.04, 0, 0.21)], 0.004, gold))
G('globe', gp, (-0.95, SY, SHH + 0.0125), (0, 0.0, 0.5))
tp = [cyl('t', 0.035, 0.02, (0, 0, 0.01), shelfWood), rod('t', (0, 0, 0.02), (0, 0, 0.06), 0.008, gold), cyl('t', 0.012, 0.06, (0, 0, 0.09), gold, r2=0.038)]
for sx in (-1, 1): tp.append(bez('t', [(sx * 0.03, 0, 0.11), (sx * 0.055, 0, 0.10), (sx * 0.05, 0, 0.075), (sx * 0.02, 0, 0.07)], 0.003, gold))
G('trophy', tp, ((WX0 + WX1) / 2 - 0.22, Y1 - 0.08, WZ0 - 0.05), (0, 0, 0.3))

# ---- toy cars (one on the tower like the reference, one on the desk)
def car(loc, rz, body):
    p = [box('k', (0.095, 0.045, 0.02), (0, 0, 0.02), body, bevel=0.007), box('k', (0.05, 0.04, 0.018), (-0.005, 0, 0.037), body, bevel=0.007),
         box('k', (0.046, 0.042, 0.011), (-0.005, 0, 0.038), black)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            p.append(cyl('k', 0.011, 0.01, (sx * 0.03, sy * 0.022, 0.011), rubber, rot=(R90, 0, 0), verts=16))
            p.append(cyl('k', 0.005, 0.011, (sx * 0.03, sy * 0.022, 0.011), chrome, rot=(R90, 0, 0), verts=12))
    return G('toycar', p, loc, (0, 0, rz))
car((TX + 0.01, MY - 0.06, DZ + 0.44), 0.5, toyYellow)
car((0.60, 0.40, DZ), -0.6, toyOrange)

# ---- twin-bell alarm clock, left of the monitor
cp = [cyl('a', 0.04, 0.03, (0, 0, 0.05), clockRed, rot=(R90, 0, 0)), cyl('a', 0.034, 0.002, (0, -0.0155, 0.05), clockFace, rot=(R90, 0, 0)),
      box('a', (0.003, 0.002, 0.024), (0.004, -0.017, 0.058), black, rot=(0, 0.35, 0)), box('a', (0.003, 0.002, 0.017), (-0.006, -0.017, 0.053), black, rot=(0, -1.1, 0))]
for sx in (-1, 1):
    cp.append(sphere('a', 0.017, (sx * 0.024, 0, 0.094), chrome, scale=(1, 1, 0.7)))
    cp.append(rod('a', (sx * 0.02, 0, 0.012), (sx * 0.028, 0, 0.0), 0.004, chrome))
cp.append(rod('a', (0, 0, 0.09), (0, 0, 0.108), 0.003, chrome)); cp.append(sphere('a', 0.006, (0, 0, 0.11), chrome))
for k in range(12):
    a = k * math.pi / 6
    cp.append(box('a', (0.002, 0.002, 0.005), (math.sin(a) * 0.028, -0.017, 0.05 + math.cos(a) * 0.028), black, rot=(0, a, 0)))
G('alarm_clock', cp, (-0.36, 0.52, DZ), (0, 0, 0.25))

# ---- cassette tapes, magazines with a floppy on top, second cube, pencil + eraser, paper ball
def cassette(loc, rz, lab):
    p = [box('t', (0.10, 0.064, 0.012), (0, 0, 0.006), tapeBody, bevel=0.002), box('t', (0.084, 0.036, 0.0125), (0, 0.006, 0.006), lab),
         box('t', (0.05, 0.016, 0.013), (0, 0.004, 0.006), tapeClear)]
    for sx in (-1, 1): p.append(cyl('t', 0.006, 0.0135, (sx * 0.02, 0.004, 0.006), black, verts=12))
    return G('cassette', p, loc, (0, 0, rz))
for k, (lab, rz) in enumerate(((paperW, 0.15), (sticky, -0.2), (stickyP, 0.05))):
    cassette((-0.46, 0.40, DZ + k * 0.0125), rz, lab)
mags = ['mag-2-everything-due.png', 'mag-5-start-small.png', 'mag-6-not-alone.png']
for k in range(4):
    rz = 0.25 + random.uniform(-0.12, 0.12)
    S(box('mag', (0.20, 0.25, 0.004), (-0.60 + random.uniform(-0.01, 0.01), 0.19 + random.uniform(-0.01, 0.01), DZ + 0.002 + k * 0.0042), paperW, rot=(0, 0, rz)))
S(pic('mag_cover', mags[0], 0.20, 0.25, (-0.60, 0.19, DZ + 0.0190), (0, 0, rz), rough=0.35))
floppy((-0.585, 0.20, DZ + 0.0215), (0, 0, -0.3), 3, 'PHOTOS')
for ix in range(3):
    for iy in range(3):
        for iz in range(3):
            S(box('cubie2', (rs * 0.95,) * 3, (-0.72 + (ix - 1) * rs, 0.36 + (iy - 1) * rs, DZ + rs / 2 + iz * rs), cube_cols[(2 * ix + iy + iz) % 6], bevel=0.002, rot=(0, 0, 0.0)))
G('pencil', [rod('p', (-0.07, 0, 0.0035), (0.07, 0, 0.0035), 0.0035, pencilY), cyl('p', 0.0035, 0.012, (0.076, 0, 0.0035), M('pencilTip', (0.75, 0.6, 0.4), 0.6), rot=(0, R90, 0), r2=0.0005),
             cyl('p', 0.0037, 0.01, (-0.075, 0, 0.0035), eraserP, rot=(0, R90, 0))], (0.29, 0.10, DZ), (0, 0, 0.5))
S(box('eraser', (0.04, 0.018, 0.01), (-0.24, 0.09, DZ + 0.005), eraserP, bevel=0.003, rot=(0, 0, 0.3)))
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.022, subdivisions=2, location=(0.93, 0.11, DZ + 0.02))
ball = bpy.context.active_object; ball.name = 'paper_ball'
for vtx in ball.data.vertices: vtx.co *= random.uniform(0.75, 1.1)
S(assign(ball, paperW))
# floppy holder with disks standing between monitor and tower
S(box('disk_box', (0.105, 0.11, 0.05), (0.275, 0.42, DZ + 0.025), beigeDark, bevel=0.004))
for k in range(5):
    floppy((0.275, 0.385 + k * 0.016, DZ + 0.055), (R90 + random.uniform(-0.12, 0.05), 0, 0), k, ('DEMO', 'PRESS', 'DRONE', 'SU', 'MIX')[k])

# ---- under the desk + floor: comic stack, cardboard box of stuff, backpack, toy robot
for k in range(11):
    S(box('comic', (0.19, 0.26, 0.006), (-0.20 + random.uniform(-0.012, 0.012), 0.52 + random.uniform(-0.012, 0.012), 0.012 + k * 0.0065), random.choice([paperW] + bcols[:5]), rot=(0, 0, random.uniform(-0.18, 0.18))))
S(pic('comic_cover', mags[2], 0.19, 0.26, (-0.20, 0.52, 0.012 + 11 * 0.0065 - 0.002), (0, 0, 0.1), rough=0.4))
bxp = [box('x', (0.36, 0.28, 0.012), (0, 0, 0.006), cardboard)]
for sx in (-1, 1): bxp.append(box('x', (0.012, 0.28, 0.24), (sx * 0.18, 0, 0.12), cardboard)); bxp.append(box('x', (0.012, 0.28, 0.12), (sx * 0.23, 0, 0.27), cardboard, rot=(0, sx * 0.9, 0)))
for sy in (-1, 1): bxp.append(box('x', (0.36, 0.012, 0.24), (0, sy * 0.14, 0.12), cardboard))
bxp += [sphere('x', 0.06, (-0.06, 0.02, 0.24), toyRed), box('x', (0.12, 0.08, 0.10), (0.08, -0.03, 0.24), toyBlue, bevel=0.01, rot=(0.3, 0.2, 0.4)), rod('x', (-0.1, -0.08, 0.2), (0.12, 0.1, 0.33), 0.012, toyYellow)]
G('toybox', bxp, (0.28, 0.50, 0.008), (0, 0, -0.15))
bg = [sphere('g', 0.17, (0, 0, 0.21), bagBlue, scale=(1, 0.6, 1.25)), sphere('g', 0.10, (0, -0.09, 0.14), bagRed, scale=(1.1, 0.5, 1.0))]
for sx in (-1, 1): bg.append(bez('g', [(sx * 0.08, 0.09, 0.36), (sx * 0.11, 0.14, 0.22), (sx * 0.09, 0.10, 0.06)], 0.012, bagRed))
bg.append(bez('g', [(-0.03, 0, 0.42), (0, 0, 0.47), (0.03, 0, 0.42)], 0.008, bagRed))
G('backpack', bg, (-0.52, 0.30, 0.008), (0.12, 0, 0.5))
rb = [box('r', (0.09, 0.06, 0.10), (0, 0, 0.11), toyYellow, bevel=0.008), box('r', (0.07, 0.055, 0.06), (0, 0, 0.195), toyBlue, bevel=0.008),
      box('r', (0.05, 0.004, 0.02), (0, -0.03, 0.2), black), box('r', (0.04, 0.004, 0.03), (0, -0.031, 0.115), toyRed)]
for sx in (-1, 1):
    rb += [box('r', (0.03, 0.04, 0.06), (sx * 0.025, 0, 0.03), toyBlue, bevel=0.005), box('r', (0.022, 0.03, 0.08), (sx * 0.058, 0, 0.115), toyRed, bevel=0.005),
           sphere('r', 0.007, (sx * 0.014, -0.031, 0.203), toyYellow)]
rb.append(rod('r', (0, 0, 0.225), (0, 0, 0.25), 0.003, chrome)); rb.append(sphere('r', 0.007, (0, 0, 0.253), toyRed))
G('robot', rb, (-1.05, SY - 0.03, SHH + 0.0125), (0, 0, -0.25))

# ---- wall: crayon drawings pinned up (your Reset illustrations), pins, light switch
draws = [('draw-2-breathe-in-a-box.png', -0.10, 1.83, 0.17, 0.07), ('draw-6-go-look-at-the-sky.png', 0.02, 1.57, 0.17, -0.06),
         ('draw-3-shake-it-out.png', 0.42, 1.36, 0.16, 0.05), ('draw-5-look-around.png', -0.74, 1.24, 0.17, -0.08), ('draw-8-do-it-together.png', 0.15, 1.34, 0.15, 0.04)]
for k, (img, cx, cz, w, rz) in enumerate(draws):
    h = w * 1.25
    S(pic('drawing%d' % k, img, w, h, (cx, Y1 - 0.003 - k * 0.0004, cz), (R90, rz, 0)))
    S(sphere('pin', 0.006, (cx - math.sin(rz) * h * 0.44, Y1 - 0.008, cz + math.cos(rz) * h * 0.44), pinRed if k % 2 else pinYel))
S(box('switch_plate', (0.085, 0.01, 0.085), (0.72, Y1 - 0.005, 1.25), M('switchW', (0.9, 0.89, 0.85), 0.4, 'plastic'), bevel=0.004))
S(box('switch_rocker', (0.025, 0.012, 0.04), (0.72, Y1 - 0.009, 1.25), M('switchW2', (0.95, 0.94, 0.9), 0.35, 'plastic'), bevel=0.003, rot=(0.12, 0, 0)))

# ---- computer details: vents, labels, knobs, badge
for k in range(9):
    S(box('crt_vent', (CW * 0.5, 0.006, 0.004), (MX, MY + 0.02 + k * 0.014, MZ + CH + 0.0005), black))
S(text_mesh('crt_label', 'kayzee', 0.012, (MX - CW / 2 + 0.07, MY - 0.02 - CD / 2 - 0.0015, MZ + 0.024), (R90, 0, 0), beigeDark))
for k in range(2): S(cyl('crt_knob', 0.007, 0.006, (MX + CW / 2 - 0.15 - k * 0.022, MY - 0.02 - CD / 2 - 0.004, MZ + 0.03), beigeDark, rot=(R90, 0, 0), verts=16))
for k in range(10):
    S(box('tower_vent', (0.11, 0.004, 0.004), (TX, MY + 0.02 - 0.222, DZ + 0.13 + k * 0.009), beigeDark))
S(box('tower_badge', (0.03, 0.003, 0.012), (TX + 0.06, MY + 0.02 - 0.2215, DZ + 0.405), M('badge', (0.1, 0.25, 0.6), 0.25, 'metal', metal=0.6)))
S(text_mesh('tower_label', 'KZ-486 TURBO', 0.008, (TX - 0.02, MY + 0.02 - 0.2222, DZ + 0.40), (R90, 0, 0), beigeDark))
S(box('cd_tray', (0.13, 0.004, 0.012), (TX, MY + 0.02 - 0.2235, DZ + 0.362), beige, bevel=0.001))
S(cyl('cd_btn', 0.004, 0.004, (TX + 0.055, MY + 0.02 - 0.2245, DZ + 0.347), beigeDark, rot=(R90, 0, 0), verts=12))

