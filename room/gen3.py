# Generates build_room3.py from build_room.py: richer scene + cinematic render + camera-projection export.
s = open('build_room.py').read()
i_real = s.index("# ---------------------------------------------------------------- realism pass")
i_light = s.index("# ---------------------------------------------------------------- lights")
head, pbr = s[:i_real], s[i_real:i_light]

def rep(txt, a, b, n=1):
    assert txt.count(a) == n, (a[:70], txt.count(a))
    return txt.replace(a, b)

# ---- keyboard: real layout, two-tone caps
ka = head.index("kb = S(box('keyboard'"); kb_end = head.index("# rainbow mouse pad: 3 strips")
head = head[:ka] + r'''keysDark = mat('keysDark', (0.56, 0.54, 0.50), 0.55)
TILT = math.radians(6); U = 0.019
kb = S(box('keyboard', (0.475, 0.175, 0.022), (KX, KY, DZ + 0.016), beige, bevel=0.007, rot=(TILT, 0, 0)))
S(box('keyboard_foot', (0.44, 0.02, 0.012), (KX, KY + 0.07, DZ + 0.006), beigeDark))
def keyrow(x0, yrow, widths, dark=()):
    x = x0
    for i, w in enumerate(widths):
        if w < 0: x += -w * U; continue
        ww = w * U
        z = DZ + 0.034 + (yrow - (KY - 0.07)) * math.tan(TILT)
        S(box('key', (ww - 0.002, U - 0.002, 0.009), (x + ww / 2, yrow, z), keysDark if (i in dark or w > 1.2 and w < 5) else keycap, bevel=0.0025, rot=(TILT, 0, 0)))
        x += ww
KL = KX - 0.2255; ky0 = KY - 0.058
keyrow(KL, ky0, [1.5, 1.25, 1.25, 6, 1.25, 1.25, 1.25, 1.25], dark=(0, 1, 2, 4, 5, 6, 7))
keyrow(KL, ky0 + U, [2.25] + [1] * 10 + [2.75])
keyrow(KL, ky0 + 2 * U, [1.75] + [1] * 11 + [2.25])
keyrow(KL, ky0 + 3 * U, [1.5] + [1] * 12 + [1.5])
keyrow(KL, ky0 + 4 * U, [1] * 13 + [2], dark=(0,))
keyrow(KL, ky0 + 5 * U + 0.008, [1, -1, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1, 1], dark=(0, 7, 8, 9, 10))
NX = KL + 15 * U + 0.010
for r in range(3): keyrow(NX, ky0 + (2 + r) * U + (0.008 if r == 2 else 0) + (U if r == 2 else 0), [1, 1, 1], dark=(0, 1, 2))
keyrow(NX, ky0, [1, 1, 1], dark=(0, 1, 2)); keyrow(NX + U, ky0 + U, [1], dark=(0,))
PXn = NX + 3 * U + 0.010
for r in range(5): keyrow(PXn, ky0 + r * U, [1, 1, 1, 1] if r else [2, 1, 1], dark=(3,) if r else (2,))
for k in range(3): S(box('kb_led', (0.006, 0.003, 0.002), (PXn + 0.02 + k * 0.016, KY + 0.075, DZ + 0.047), led))
''' + head[kb_end:]
# ---- mouse pad (tie-dye gradient) + mouse with buttons
ma = head.index("# rainbow mouse pad: 3 strips"); mb = head.index("# ---------------------------------------------------------------- desk lamp")
head = head[:ma] + r'''# tie-dye mouse pad + two-button mouse
padM = bpy.data.materials.new('padRainbow'); padM.use_nodes = True
_nt = padM.node_tree; _b = _nt.nodes['Principled BSDF']; _b.inputs['Roughness'].default_value = 0.85; _b.inputs['Sheen Weight'].default_value = 0.5
_tc = _nt.nodes.new('ShaderNodeTexCoord'); _no = _nt.nodes.new('ShaderNodeTexNoise'); _no.inputs['Scale'].default_value = 5.0; _no.inputs['Detail'].default_value = 1.0
_nt.links.new(_tc.outputs['Object'], _no.inputs['Vector'])
_ramp = _nt.nodes.new('ShaderNodeValToRGB'); _nt.links.new(_no.outputs['Fac'], _ramp.inputs['Fac'])
_e = _ramp.color_ramp.elements; _e[0].position = 0.30; _e[0].color = (0.05, 0.25, 0.85, 1); _e[1].position = 0.70; _e[1].color = (0.9, 0.12, 0.15, 1)
for pos, c in ((0.42, (0.05, 0.7, 0.75, 1)), (0.52, (0.95, 0.85, 0.1, 1)), (0.61, (0.98, 0.5, 0.1, 1))):
    el = _ramp.color_ramp.elements.new(pos); el.color = c
_nt.links.new(_ramp.outputs['Color'], _b.inputs['Base Color'])
S(box('pad', (0.25, 0.21, 0.004), (0.50, 0.14, DZ + 0.002), padM, bevel=0.0015, rot=(0, 0, -0.08)))
S(sphere('mouse', 0.035, (0.50, 0.13, DZ + 0.02), beige, scale=(0.85, 1.45, 0.52)))
S(box('mouse_split', (0.002, 0.045, 0.004), (0.50, 0.155, DZ + 0.036), beigeDark))
S(box('mouse_seam', (0.055, 0.002, 0.004), (0.50, 0.135, DZ + 0.0375), beigeDark))

''' + head[mb:]
# ---- floppies: proper disks, more of them
fa = head.index("# floppy disks + mug"); fb = head.index("S(cyl('mug', 0.035")
head = head[:fa] + r'''# floppy disks (proper: body, shutter, label with handwriting)
def G(name, parts, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1: bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)   # parts keep their own placement
    o.location = loc; o.rotation_euler = rot
    return S(o)
def text_flat(name, body, size, loc, m, rz=0.0):
    bpy.ops.object.text_add(location=loc, rotation=(0, 0, rz))
    t = bpy.context.active_object; t.data.body = body; t.data.size = size; t.data.align_x = 'CENTER'
    bpy.ops.object.convert(target='MESH'); t.name = name
    t.data.materials.clear(); t.data.materials.append(m); return t
fl_cols = [mat('floppyBlack', (0.03, 0.03, 0.035), 0.45), mat('floppyBlue', (0.05, 0.12, 0.45), 0.45), mat('floppyRed', (0.5, 0.05, 0.05), 0.45), mat('floppyGrey', (0.45, 0.45, 0.47), 0.45)]
fl_label = mat('floppyLabel', (0.93, 0.92, 0.86), 0.8); fl_ink = mat('floppyInk', (0.05, 0.08, 0.35), 0.6)
def floppy(loc, rot, ci=0, text='CV.DOC'):
    parts = [box('f', (0.09, 0.094, 0.0033), (0, 0, 0), fl_cols[ci % 4], bevel=0.001),
             box('f', (0.045, 0.03, 0.0038), (0.008, 0.032, 0), metal),
             box('f', (0.012, 0.022, 0.0040), (0.016, 0.032, 0), fl_cols[ci % 4]),
             box('f', (0.07, 0.05, 0.0036), (0, -0.018, 0), fl_label),
             text_flat('f', text, 0.011, (0, -0.022, 0.0019), fl_ink)]
    return G('floppy', parts, loc, rot)
floppy((-0.26, 0.42, DZ + 0.002), (0, 0, 0.5), 1, 'GAMES')
floppy((0.30, 0.20, DZ + 0.002), (0, 0, -0.35), 0, 'CV.DOC')
floppy((0.315, 0.225, DZ + 0.0055), (0, 0, 0.25), 2, 'SU 26')
''' + head[fb:]
# ---- rug: image textured, under desk and chair
head = rep(head, "S(box('rug', (1.8, 1.3, 0.008), (0.1, -0.5, 0.004), rug))", "RUG_SLOT = True")
# ---- fairy lights lower so they stay in frame
head = rep(head, "    z = 2.0 - 0.13 * math.sin(math.pi * ((u * 3) % 1))", "    z = 1.955 - 0.10 * math.sin(math.pi * ((u * 3) % 1))")
# rearrange a few desk items for the new props
head = rep(head, "RX, RY, rs = -0.36, 0.30, 0.019", "RX, RY, rs = -0.33, 0.33, 0.019")
head = rep(head, "CX, CY = -0.47, 0.14", "CX, CY = -0.40, 0.19")

head = rep(head, "wood = mat('desk', (0.42, 0.24, 0.11), 0.42)", "wood = mat('desk', (0.58, 0.34, 0.16), 0.40)")
head = rep(head, "bear = mat('bear', (0.45, 0.25, 0.10), 0.95)", "bear = mat('bear', (0.66, 0.42, 0.20), 0.95)")
head = rep(head, "bearLight = mat('bearLight', (0.75, 0.55, 0.35), 0.95)", "bearLight = mat('bearLight', (0.88, 0.70, 0.46), 0.95)")
head = rep(head, "LAMP_DIR = Vector((0.30, -0.45, -1.0))", "LAMP_DIR = Vector((0.30, -0.75, -1.0))")
head = rep(head, "S(curtain_panel('curtainL', WX0 - 0.22, WX0 + 0.16, 9))", "S(curtain_panel('curtainL', WX0 - 0.26, WX0 + 0.05, 9))")
head = rep(head, "S(curtain_panel('curtainR', WX1 - 0.12, WX1 + 0.24, 9))", "S(curtain_panel('curtainR', WX1 - 0.04, WX1 + 0.26, 9))")
head = rep(head, "plane('sky', 4, 3, ((WX0 + WX1) / 2, Y1 + 1.6, 1.6)", "plane('sky', 7, 5, ((WX0 + WX1) / 2, Y1 + 1.6, 1.9)")
head = rep(head, '("hire me :)", sticky, 0.17, 0.33, -0.08), ("call mum", stickyP, -0.19, 0.06, 0.06)', '("hire me :)", sticky, 0.226, 0.30, -0.08), ("call mum", stickyP, -0.06, 0.038, 0.05)')
# ---- v4: fairy lights strung low across the wall, just over the monitor, so wide screens still show them
fa = head.index("# fairy lights draped across the back wall"); fb = head.index("# tape on the poster corners")
head = head[:fa] + r"""# fairy lights: pinned low across the wall, sagging just above the monitor and tower
FP = [(-1.47, 1.41), (-0.84, 1.355), (-0.64, 1.335), (0.00, 1.285), (0.57, 1.30)]   # pins (x, z)
SAG = [0.10, 0.012, 0.075, 0.06]
fl_pts = []
for (xa, za), (xb, zb), sag in zip(FP[:-1], FP[1:], SAG):
    n = max(2, int(round(abs(xb - xa) / 0.033)))
    for k in range(n):
        u = k / n
        fl_pts.append((xa + (xb - xa) * u, Y1 - 0.012, za + (zb - za) * u - sag * 4 * u * (1 - u)))
fl_pts.append((FP[-1][0], Y1 - 0.012, FP[-1][1]))
for k in range(1, 6): fl_pts.append((FP[-1][0] + 0.004 * math.sin(k * 1.7), Y1 - 0.012, FP[-1][1] - 0.033 * k))   # loose end by the curtain
S(bez('fairy_wire', fl_pts, 0.0016, wire))
for k, p in enumerate(fl_pts):
    if k % 2 == 1: S(sphere('fairy_bulb', 0.009, (p[0], p[1] - 0.006, p[2] - 0.012), bulbs))
fairyTape = mat('fairyTape', (0.92, 0.90, 0.80), 0.8)
for (x, z) in FP: S(box('fairy_tape', (0.032, 0.002, 0.013), (x, Y1 - 0.004, z + 0.002), fairyTape, rot=(0, 0.3, 0)))
""" + head[fb:]
# ---- v4: sticky notes are blank in the render; the page writes on them (so a note can greet a recruiter by name)
head = rep(head, "for i, (txt, m, dx, dz, rz) in enumerate([", "NOTE_OBJS = []\nfor i, (txt, m, dx, dz, rz) in enumerate([")
head = rep(head, "    S(plane('sticky', 0.07, 0.07, (cx, cy, cz), (R90, rz, 0), m))\n    S(text_mesh('sticky_text', txt, 0.012, (cx, cy - 0.001, cz - 0.004), (R90, rz, 0), ink))",
           "    NOTE_OBJS.append((S(plane('sticky%d' % i, 0.07, 0.07, (cx, cy, cz), (R90, rz, 0), m)), txt))")
NEW = open('props3.py').read()
# ---- v4: nudge three drawings so the light string runs under them
# ---- v4: dusk sky outside (deep blue above, burning orange at the horizon) instead of a white-out
NEW = rep(NEW, "top = np.array([0.45, 0.62, 0.95], np.float32); mid = np.array([1.0, 0.72, 0.42], np.float32); low = np.array([1.0, 0.50, 0.22], np.float32)",
          "top = np.array([0.16, 0.22, 0.52], np.float32); mid = np.array([0.98, 0.52, 0.34], np.float32); low = np.array([1.0, 0.40, 0.14], np.float32)")
NEW = rep(NEW, "glow = np.exp(-(((u - 0.72) * 2.2) ** 2 + ((v - 0.62) * 3.0) ** 2))[..., None]; skyA = skyA + glow * np.array([1.2, 0.9, 0.5], np.float32)",
          "glow = np.exp(-(((u - 0.72) * 4.0) ** 2 + ((v - 0.66) * 6.0) ** 2))[..., None]; skyA = skyA + glow * np.array([0.9, 0.5, 0.18], np.float32)")
NEW = rep(NEW, "('draw-3-shake-it-out.png', 0.42, 1.36, 0.16, 0.05), ('draw-5-look-around.png', -0.74, 1.24, 0.17, -0.08), ('draw-8-do-it-together.png', 0.15, 1.34, 0.15, 0.04)",
          "('draw-3-shake-it-out.png', 0.43, 1.405, 0.16, 0.05), ('draw-5-look-around.png', -0.74, 1.212, 0.17, -0.08), ('draw-8-do-it-together.png', 0.19, 1.405, 0.15, 0.04)")
TAIL = open('tail3.py').read()
pbr = rep(pbr, "for m in list(bpy.data.materials):\n    k = RECIPES.get(m.name)", "RECIPES.update(RECIPES3)\nfor m in list(bpy.data.materials):\n    k = RECIPES.get(m.name)")
pbr = rep(pbr, "bump(fine.outputs['Fac'], 0.08)", "bump(fine.outputs['Fac'], 0.02)")
pbr = rep(pbr, "big = noise(2.5, 4); fine = noise(120.0, 10, 0.7)", "big = noise(2.5, 4); fine = noise(40.0, 6, 0.6)")
head = "import time; T0 = time.time()\n" + head
open('build_room3.py', 'w').write(head + NEW + pbr + TAIL)
print('generated', len(head + NEW + pbr + TAIL))
