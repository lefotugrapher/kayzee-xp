# Kayzee XP room: procedural Blender scene -> preview render / lightmap bake + glTF export.
# Run: Blender --background --factory-startup --python build_room.py -- preview|bake
import bpy, bmesh, math, os, sys
from mathutils import Vector, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'tex')
OUT = os.path.join(HERE, 'build')
MODE = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'preview'
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'METAL'; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = 'GPU'
except Exception as e:
    print('GPU setup failed, CPU', e)

MATS = {}
def mat(name, color=(0.8, 0.8, 0.8), rough=0.6, image=None, emit=None, strength=1.0, metal=0.0, sheen=0.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if image:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.name = 'albedo'
        tex.image = bpy.data.images.load(os.path.join(TEX, image))
        uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'
        nt.links.new(uv.outputs['UV'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    MATS[name] = m
    return m

def assign(o, m):
    o.data.materials.clear(); o.data.materials.append(m); return o

def box(name, size, loc, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    o.scale = size; bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        md = o.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 3; md.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=md.name)
    return assign(o, m)

def cyl(name, r, h, loc, m, rot=(0, 0, 0), verts=32, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=h, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object; o.name = name
    bpy.ops.object.shade_smooth()
    return assign(o, m)

def sphere(name, r, loc, m, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=24, ring_count=16)
    o = bpy.context.active_object; o.name = name
    o.scale = scale; bpy.ops.object.transform_apply(scale=True)
    bpy.ops.object.shade_smooth()
    return assign(o, m)

def plane(name, w, h, loc, rot, m):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    o.scale = (w, h, 1); bpy.ops.object.transform_apply(scale=True)
    return assign(o, m)

R90 = math.pi / 2
# ---------------------------------------------------------------- materials
wall = mat('wall', (0.80, 0.66, 0.50), 0.85)          # warm painted plaster
wallLow = mat('wainscot', (0.55, 0.40, 0.28), 0.6)
floor = mat('floor', (0.36, 0.22, 0.12), 0.45)
ceil = mat('ceiling', (0.85, 0.80, 0.72), 0.9)
wood = mat('desk', (0.42, 0.24, 0.11), 0.42)
woodDark = mat('deskDark', (0.25, 0.14, 0.07), 0.5)
beige = mat('beige', (0.80, 0.76, 0.66), 0.45)        # 90s computer plastic
beigeDark = mat('beigeDark', (0.62, 0.58, 0.50), 0.5)
glassDark = mat('crtGlass', (0.02, 0.03, 0.03), 0.15)
keycap = mat('keys', (0.78, 0.74, 0.64), 0.55)
white = mat('frame', (0.92, 0.91, 0.87), 0.5)
curtain = mat('curtain', (0.95, 0.90, 0.80), 0.9)
lampGreen = mat('lampGreen', (0.08, 0.36, 0.16), 0.3, metal=0.4)
metal = mat('metal', (0.6, 0.6, 0.62), 0.3, metal=1.0)
bear = mat('bear', (0.45, 0.25, 0.10), 0.95)
bearLight = mat('bearLight', (0.75, 0.55, 0.35), 0.95)
red = mat('ribbon', (0.65, 0.08, 0.06), 0.6)
black = mat('blackPlastic', (0.03, 0.03, 0.035), 0.4)
sky = mat('skyOutside', (1, 1, 1), 1, emit=(0.85, 0.92, 1.0), strength=4.0)
rug = mat('rug', (0.30, 0.08, 0.10), 0.95)
padA = mat('padYellow', (0.95, 0.75, 0.10), 0.7); padB = mat('padBlue', (0.10, 0.45, 0.85), 0.7)
padC = mat('padRed', (0.85, 0.15, 0.20), 0.7)
mug = mat('mug', (0.85, 0.30, 0.15), 0.3)
led = mat('led', (0.1, 1, 0.2), 0.3, emit=(0.1, 1, 0.2), strength=6)
screen = mat('screen', (0, 0, 0), 0.2, emit=(0.15, 0.35, 0.85), strength=1.5)
cube_cols = [mat('cubeR', (0.8, 0.05, 0.05), 0.3), mat('cubeG', (0.05, 0.6, 0.15), 0.3), mat('cubeB', (0.05, 0.2, 0.8), 0.3),
             mat('cubeY', (0.95, 0.85, 0.05), 0.3), mat('cubeO', (0.95, 0.45, 0.05), 0.3), mat('cubeW', (0.95, 0.95, 0.95), 0.3)]

static = []
def S(o): static.append(o); return o

# ---------------------------------------------------------------- room shell
X0, X1, Y0, Y1, H = -1.5, 1.95, -2.4, 0.80, 2.7
S(box('floor', (X1 - X0, Y1 - Y0, 0.05), ((X0 + X1) / 2, (Y0 + Y1) / 2, -0.025), floor))
S(box('ceiling', (X1 - X0, Y1 - Y0, 0.05), ((X0 + X1) / 2, (Y0 + Y1) / 2, H + 0.025), ceil))
S(box('wallL', (0.1, Y1 - Y0, H), (X0 - 0.05, (Y0 + Y1) / 2, H / 2), wall))
S(box('wallR', (0.1, Y1 - Y0, H), (X1 + 0.05, (Y0 + Y1) / 2, H / 2), wall))
S(box('wallF', (X1 - X0, 0.1, H), ((X0 + X1) / 2, Y0 - 0.05, H / 2), wall))
# back wall with a window hole (window: x 0.85..1.65, z 1.0..2.15)
WX0, WX1, WZ0, WZ1 = 0.85, 1.65, 1.0, 2.15
T = 0.12; BY = Y1 + T / 2
S(box('wallB_left', (WX0 - X0, T, H), ((X0 + WX0) / 2, BY, H / 2), wall))
S(box('wallB_right', (X1 - WX1, T, H), ((WX1 + X1) / 2, BY, H / 2), wall))
S(box('wallB_low', (WX1 - WX0, T, WZ0), ((WX0 + WX1) / 2, BY, WZ0 / 2), wall))
S(box('wallB_high', (WX1 - WX0, T, H - WZ1), ((WX0 + WX1) / 2, BY, (WZ1 + H) / 2), wall))
# skirting + chair rail for warmth
S(box('skirting', (X1 - X0, 0.02, 0.12), ((X0 + X1) / 2, Y1 - 0.01, 0.06), woodDark))
# window frame, mullions, sill
fw = 0.05
S(box('win_top', (WX1 - WX0 + 2 * fw, 0.10, fw), ((WX0 + WX1) / 2, Y1 + 0.02, WZ1 + fw / 2), white))
S(box('win_bot', (WX1 - WX0 + 2 * fw, 0.10, fw), ((WX0 + WX1) / 2, Y1 + 0.02, WZ0 - fw / 2), white))
S(box('win_l', (fw, 0.10, WZ1 - WZ0), (WX0 - fw / 2, Y1 + 0.02, (WZ0 + WZ1) / 2), white))
S(box('win_r', (fw, 0.10, WZ1 - WZ0), (WX1 + fw / 2, Y1 + 0.02, (WZ0 + WZ1) / 2), white))
S(box('win_mv', (0.03, 0.06, WZ1 - WZ0), ((WX0 + WX1) / 2, Y1 + 0.04, (WZ0 + WZ1) / 2), white))
S(box('win_mh', (WX1 - WX0, 0.045, 0.03), ((WX0 + WX1) / 2, Y1 + 0.04, WZ0 + (WZ1 - WZ0) * 0.62), white))
S(box('sill', (WX1 - WX0 + 0.2, 0.22, 0.04), ((WX0 + WX1) / 2, Y1 - 0.06, WZ0 - 0.07), white))
plane('sky', 4, 3, ((WX0 + WX1) / 2, Y1 + 1.6, 1.6), (R90, 0, 0), sky)   # bright sky seen through the window (not baked)

# sheer curtains: wavy panels gathered at both sides of the window
def curtain_panel(name, x0, x1, gather):
    bm = bmesh.new()
    nx, nz = 40, 30
    z0, z1 = WZ0 - 0.25, WZ1 + 0.18
    verts = []
    for j in range(nz + 1):
        row = []
        for i in range(nx + 1):
            u = i / nx; z = z0 + (z1 - z0) * j / nz
            x = x0 + (x1 - x0) * u
            y = Y1 - 0.08 - 0.035 * math.sin(u * math.pi * gather) * (0.6 + 0.4 * j / nz)
            row.append(bm.verts.new((x, y, z)))
        verts.append(row)
    for j in range(nz):
        for i in range(nx):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    me.uv_layers.new(name='UVMap')
    sol = o.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.006
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='sol')
    for p in me.polygons: p.use_smooth = True
    return assign(o, curtain)
S(curtain_panel('curtainL', WX0 - 0.22, WX0 + 0.16, 9))
S(curtain_panel('curtainR', WX1 - 0.12, WX1 + 0.24, 9))
S(cyl('curtain_rod', 0.012, WX1 - WX0 + 0.7, ((WX0 + WX1) / 2, Y1 - 0.08, WZ1 + 0.2), metal, rot=(0, R90, 0)))

# rug
S(box('rug', (1.8, 1.3, 0.008), (0.1, -0.5, 0.004), rug))

# ---------------------------------------------------------------- desk
DX, DY, DW, DD, DZ = 0.15, 0.40, 1.65, 0.70, 0.76
S(box('desk_top', (DW, DD, 0.04), (DX, DY, DZ - 0.02), wood, bevel=0.006))
for sx in (-1, 1):
    for sy in (-1, 1):
        S(box('desk_leg', (0.05, 0.05, DZ - 0.04), (DX + sx * (DW / 2 - 0.05), DY + sy * (DD / 2 - 0.05), (DZ - 0.04) / 2), wood))
S(box('desk_apron', (DW - 0.1, 0.02, 0.10), (DX, DY - DD / 2 + 0.06, DZ - 0.09), wood))
S(box('drawer', (0.42, 0.03, 0.12), (DX + 0.45, DY - DD / 2 + 0.035, DZ - 0.11), woodDark, bevel=0.004))
S(cyl('drawer_knob', 0.012, 0.03, (DX + 0.45, DY - DD / 2 + 0.01, DZ - 0.11), metal, rot=(R90, 0, 0)))

# ---------------------------------------------------------------- CRT monitor (faces the camera, -Y)
MX, MY = -0.02, 0.50
MZ = DZ + 0.06                                   # bottom of the monitor (sits on a small stand)
S(box('crt_stand', (0.24, 0.20, 0.03), (MX, MY + 0.02, DZ + 0.015), beigeDark, bevel=0.01))
S(box('crt_neck', (0.12, 0.10, 0.04), (MX, MY + 0.03, DZ + 0.045), beigeDark))
CW, CH, CD = 0.46, 0.40, 0.30
S(box('crt_front', (CW, CD, CH), (MX, MY - 0.02, MZ + CH / 2), beige, bevel=0.025))
S(box('crt_back', (CW * 0.66, 0.22, CH * 0.72), (MX, MY + 0.22, MZ + CH * 0.42), beige, bevel=0.03))
SW, SH = 0.36, 0.27                              # glass area 4:3
S(box('crt_bezel_inner', (SW + 0.02, 0.01, SH + 0.02), (MX, MY - 0.02 - CD / 2 - 0.002, MZ + CH / 2 + 0.015), beigeDark, bevel=0.004))
scr = plane('Screen', SW, SH, (MX, MY - 0.02 - CD / 2 - 0.009, MZ + CH / 2 + 0.015), (R90, 0, 0), screen)
S(box('crt_led', (0.012, 0.004, 0.006), (MX + CW / 2 - 0.05, MY - 0.02 - CD / 2 - 0.004, MZ + 0.03), led))
S(box('crt_button', (0.03, 0.006, 0.012), (MX + CW / 2 - 0.09, MY - 0.02 - CD / 2 - 0.004, MZ + 0.03), beigeDark))

# ---------------------------------------------------------------- tower (right of monitor)
TX = MX + 0.46
S(box('tower', (0.20, 0.44, 0.44), (TX, MY + 0.02, DZ + 0.22), beige, bevel=0.012))
for k in range(2):
    S(box('bay', (0.15, 0.006, 0.04), (TX, MY + 0.02 - 0.222, DZ + 0.36 - k * 0.055), beigeDark, bevel=0.002))
S(box('floppy_slot', (0.10, 0.006, 0.006), (TX, MY + 0.02 - 0.223, DZ + 0.25), black))
S(box('tower_led', (0.01, 0.004, 0.01), (TX - 0.05, MY + 0.02 - 0.222, DZ + 0.08), led))
S(cyl('power_btn', 0.016, 0.01, (TX + 0.04, MY + 0.02 - 0.222, DZ + 0.08), beigeDark, rot=(R90, 0, 0)))

# ---------------------------------------------------------------- keyboard + mouse + pad
KX, KY = MX - 0.02, 0.14
kb = S(box('keyboard', (0.46, 0.17, 0.025), (KX, KY, DZ + 0.0125), beige, bevel=0.006, rot=(math.radians(4), 0, 0)))
for r in range(5):
    for c in range(15):
        w = 0.024
        S(box('key', (w, w, 0.012), (KX - 0.20 + c * 0.0285, KY - 0.06 + r * 0.029, DZ + 0.03 + r * 0.002), keycap, bevel=0.002))
S(box('spacebar', (0.16, 0.024, 0.012), (KX, KY - 0.088, DZ + 0.03), keycap, bevel=0.002))
# rainbow mouse pad: 3 strips
for i, m in enumerate((padC, padA, padB)):
    S(box('pad', (0.08, 0.20, 0.004), (0.40 + i * 0.08, 0.14, DZ + 0.002), m))
S(sphere('mouse', 0.035, (0.48, 0.13, DZ + 0.018), beige, scale=(0.85, 1.4, 0.5)))

# ---------------------------------------------------------------- desk lamp (left): proper hinged arm, switched ON
def rod(name, p0, p1, r, m):
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, location=(p0 + p1) / 2, vertices=16)
    o = bpy.context.active_object; o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler(); bpy.ops.object.shade_smooth()
    return assign(o, m)
LX, LY = -0.60, 0.50
J0 = Vector((LX, LY, DZ + 0.03)); J1 = Vector((LX + 0.02, LY + 0.05, DZ + 0.36)); J2 = Vector((LX + 0.17, LY - 0.13, DZ + 0.43))
S(cyl('lamp_base', 0.08, 0.03, (LX, LY, DZ + 0.015), lampGreen))
S(sphere('lamp_j0', 0.016, J0, metal)); S(sphere('lamp_j1', 0.018, J1, lampGreen)); S(sphere('lamp_j2', 0.016, J2, metal))
S(rod('lamp_arm1', J0, J1, 0.009, metal)); S(rod('lamp_arm1b', J0 + Vector((0.025, 0, 0)), J1 + Vector((0.025, 0, 0)), 0.005, metal))
S(rod('lamp_arm2', J1, J2, 0.009, metal)); S(rod('lamp_arm2b', J1 + Vector((0, 0, 0.025)), J2 + Vector((0, 0, 0.025)), 0.005, metal))
LAMP_DIR = Vector((0.30, -0.45, -1.0)).normalized()          # shade points down onto the front-left of the desk
bpy.ops.mesh.primitive_cone_add(radius1=0.085, radius2=0.035, depth=0.15, vertices=32, end_fill_type='NOTHING')
shade = bpy.context.active_object; shade.name = 'lamp_shade'
shade.rotation_euler = (-LAMP_DIR).to_track_quat('Z', 'Y').to_euler()
shade.location = J2 + LAMP_DIR * 0.08
sol = shade.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.004; bpy.context.view_layer.objects.active = shade
bpy.ops.object.modifier_apply(modifier='s'); bpy.ops.object.shade_smooth(); S(assign(shade, lampGreen))
bulbMat = mat('lampBulb', (1, 0.9, 0.7), 0.3, emit=(1.0, 0.78, 0.45), strength=25)
S(sphere('lamp_bulb', 0.028, J2 + LAMP_DIR * 0.13, bulbMat))
bpy.ops.object.light_add(type='SPOT', location=J2 + LAMP_DIR * 0.12)
lamp_light = bpy.context.active_object; lamp_light.name = 'LampLight'
lamp_light.data.energy = 140; lamp_light.data.color = (1.0, 0.70, 0.40); lamp_light.data.spot_size = math.radians(95)
lamp_light.data.spot_blend = 0.6; lamp_light.data.shadow_soft_size = 0.02
lamp_light.rotation_euler = LAMP_DIR.to_track_quat('-Z', 'Y').to_euler()

# ---------------------------------------------------------------- props
# teddy bear right of tower
BX, BYb = TX + 0.30, 0.42
S(sphere('bear_body', 0.075, (BX, BYb, DZ + 0.075), bear, scale=(1, 0.85, 1.1)))
S(sphere('bear_belly', 0.05, (BX, BYb - 0.045, DZ + 0.07), bearLight, scale=(1, 0.5, 1.1)))
S(sphere('bear_head', 0.06, (BX, BYb - 0.01, DZ + 0.19), bear))
S(sphere('bear_muzzle', 0.025, (BX, BYb - 0.065, DZ + 0.18), bearLight, scale=(1.2, 0.8, 0.9)))
for s in (-1, 1):
    S(sphere('bear_ear', 0.022, (BX + s * 0.045, BYb, DZ + 0.245), bear))
    S(sphere('bear_arm', 0.028, (BX + s * 0.08, BYb - 0.03, DZ + 0.09), bear, scale=(0.8, 0.8, 1.5)))
    S(sphere('bear_leg', 0.032, (BX + s * 0.05, BYb - 0.07, DZ + 0.03), bear, scale=(0.9, 1.4, 0.8)))
    S(sphere('bear_eye', 0.007, (BX + s * 0.022, BYb - 0.06, DZ + 0.205), black))
S(box('bear_ribbon', (0.08, 0.02, 0.018), (BX, BYb - 0.05, DZ + 0.135), red))
# rubik's cube (front left)
RX, RY, rs = -0.36, 0.30, 0.019
for ix in range(3):
    for iy in range(3):
        for iz in range(3):
            S(box('cubie', (rs * 0.95, rs * 0.95, rs * 0.95), (RX + (ix - 1) * rs, RY + (iy - 1) * rs, DZ + rs / 2 + iz * rs),
                  cube_cols[(ix + 2 * iy + 3 * iz) % 6], bevel=0.002))
# floppy disks + mug
for i in range(2):
    S(box('floppy', (0.09, 0.09, 0.003), (-0.60 + i * 0.02, 0.32 + i * 0.015, DZ + 0.0015 + i * 0.003), black, rot=(0, 0, 0.2 * i)))
    S(box('floppy_shutter', (0.04, 0.03, 0.0035), (-0.60 + i * 0.02, 0.35 + i * 0.015, DZ + 0.002 + i * 0.003), metal, rot=(0, 0, 0.2 * i)))
S(cyl('mug', 0.035, 0.09, (0.86, 0.22, DZ + 0.045), mug))

# ---------------------------------------------------------------- posters (your SU work)
def poster(name, img, w, cx, cz, aspect):
    m = mat('poster_' + name, (1, 1, 1), 0.7, image=img)
    h = w * aspect
    p = plane('poster_' + name, w, h, (cx, Y1 - 0.004, cz), (R90, 0, 0), m)
    # plane faces -Y after +90deg X: fix UV orientation (flip U)
    return S(p)
poster('destress', 'poster-destress.png', 0.40, -1.00, 1.62, 1024 / 819)
poster('ball', 'poster-ball.png', 0.36, -0.47, 1.60, 1024 / 724)
poster('reset', 'poster-reset.png', 0.30, 0.42, 1.70, 1024 / 819)

# ---------------------------------------------------------------- personality props
def text_mesh(name, body, size, loc, rot, m):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    t = bpy.context.active_object; t.data.body = body; t.data.size = size; t.data.align_x = 'CENTER'
    bpy.ops.object.convert(target='MESH'); t.name = name
    return assign(t, m)
def bez(name, pts, r, m):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.convert(target='MESH'); o = bpy.context.active_object; o.name = name
    return assign(o, m)
ink = mat('ink', (0.05, 0.05, 0.12), 0.6)
sticky = mat('sticky', (1.0, 0.86, 0.25), 0.8); stickyP = mat('stickyPink', (1.0, 0.55, 0.70), 0.8)
lanyard = mat('lanyard', (0.10, 0.25, 0.75), 0.7); card = mat('card', (0.95, 0.95, 0.95), 0.5)
terracotta = mat('pot', (0.70, 0.33, 0.18), 0.8); leaf = mat('leaf', (0.05, 0.20, 0.04), 0.5); leaf2 = mat('leaf2', (0.09, 0.28, 0.06), 0.5)
radiatorM = mat('radiator', (0.90, 0.89, 0.85), 0.4)
bulbs = mat('fairy', (1, 0.9, 0.6), 0.3, emit=(1.0, 0.72, 0.35), strength=12)
wire = mat('wire', (0.05, 0.08, 0.04), 0.6)
books = [mat('book%d' % i, c, 0.7) for i, c in enumerate([(0.55, 0.10, 0.10), (0.12, 0.28, 0.55), (0.85, 0.65, 0.20), (0.15, 0.45, 0.30), (0.40, 0.20, 0.45), (0.90, 0.88, 0.80), (0.20, 0.20, 0.22)])]
lens = mat('lensGlass', (0.02, 0.03, 0.05), 0.08)
hpM = mat('headphones', (0.12, 0.12, 0.13), 0.35); cushion = mat('cushion', (0.18, 0.18, 0.19), 0.9)
droneM = mat('drone', (0.85, 0.86, 0.88), 0.35)
pens = [mat('pen%d' % i, c, 0.4) for i, c in enumerate([(0.1, 0.2, 0.8), (0.85, 0.1, 0.1), (0.1, 0.1, 0.1), (0.95, 0.75, 0.1)])]

# your camera (photography) on the front-left of the desk
CX, CY = -0.47, 0.14
S(box('cam_body', (0.13, 0.075, 0.085), (CX, CY, DZ + 0.0425), black, bevel=0.01, rot=(0, 0, 0.35)))
S(box('cam_grip', (0.03, 0.08, 0.075), (CX - 0.055, CY - 0.02, DZ + 0.04), black, bevel=0.01, rot=(0, 0, 0.35)))
S(box('cam_prism', (0.05, 0.05, 0.03), (CX + 0.005, CY + 0.005, DZ + 0.098), black, bevel=0.008, rot=(0, 0, 0.35)))
lens_dir = Vector((math.sin(0.35), -math.cos(0.35), 0))
S(rod('cam_lens', Vector((CX, CY, DZ + 0.045)) + lens_dir * 0.03, Vector((CX, CY, DZ + 0.045)) + lens_dir * 0.11, 0.032, black))
S(rod('cam_lens_ring', Vector((CX, CY, DZ + 0.045)) + lens_dir * 0.07, Vector((CX, CY, DZ + 0.045)) + lens_dir * 0.08, 0.034, metal))
S(rod('cam_glass', Vector((CX, CY, DZ + 0.045)) + lens_dir * 0.109, Vector((CX, CY, DZ + 0.045)) + lens_dir * 0.112, 0.026, lens))
S(cyl('cam_dial', 0.012, 0.01, (CX + 0.04, CY + 0.015, DZ + 0.09), metal))
# standing books with spine titles, varied sizes, one leaning; a lying stack on the right
gilt = mat('gilt', (0.75, 0.58, 0.22), 0.35, metal=0.8)
spine_ink = mat('spineInk', (0.92, 0.90, 0.84), 0.6)
titles = ['PR STRATEGY', 'BRANDING', 'STORY', 'SEO', 'PHOTOGRAPHY', 'IRELAND']
bx = -0.67
for i, (w, h, d) in enumerate([(0.030, 0.235, 0.16), (0.038, 0.205, 0.15), (0.026, 0.25, 0.17), (0.044, 0.19, 0.14), (0.032, 0.22, 0.155)]):
    tilt = (0.0, 0.0, 0.03, 0.0, -0.02)[i]
    cx = bx + w / 2
    S(box('book', (w, d, h), (cx, 0.66, DZ + h / 2), books[i], bevel=0.0025, rot=(0, tilt, 0)))
    sy = 0.66 - d / 2 - 0.0012
    S(text_mesh('book_title', titles[i], min(0.011, w * 0.42), (cx, sy, DZ + h * 0.52), (R90, -R90 + tilt, 0), spine_ink if i != 5 else ink))
    for bz in (0.03, h - 0.03):
        S(box('book_band', (w * 0.9, 0.0015, 0.004), (cx, sy, DZ + bz), gilt))
    bx += w + 0.0015
S(box('book_lean', (0.03, 0.15, 0.21), (bx + 0.045, 0.66, DZ + 0.10), books[5], bevel=0.0025, rot=(0, math.radians(-17), 0)))
S(text_mesh('book_title', 'NOTES', 0.010, (bx + 0.045, 0.66 - 0.076, DZ + 0.10), (R90, -R90 + math.radians(-17), 0), ink))
for i in range(3):
    S(box('book_stack', (0.17 - i * 0.012, 0.12, 0.03), (0.86, 0.62, DZ + 0.015 + i * 0.03), books[(i + 2) % 7], bevel=0.003, rot=(0, 0, 0.12 * i - 0.1)))
# pen pot on the book stack
S(cyl('pen_pot', 0.03, 0.09, (0.86, 0.62, DZ + 0.09 + 0.045), mug))
for i, pm in enumerate(pens):
    S(rod('pen', (0.86 + (i - 1.5) * 0.008, 0.62 + ((i % 2) - 0.5) * 0.01, DZ + 0.13), (0.86 + (i - 1.5) * 0.02, 0.62 + ((i % 2) - 0.5) * 0.03, DZ + 0.27), 0.004, pm))
# headphones lying flat on the desk, to the side
HX, HY = 0.70, 0.10
for sx in (-1, 1):
    S(cyl('hp_cup', 0.036, 0.024, (HX + sx * 0.055, HY, DZ + 0.012), hpM))
    S(cyl('hp_pad', 0.031, 0.01, (HX + sx * 0.055, HY, DZ + 0.029), cushion))
S(bez('hp_band', [(HX - 0.055, HY + 0.035, DZ + 0.02), (HX - 0.06, HY + 0.11, DZ + 0.012), (HX + 0.06, HY + 0.11, DZ + 0.012), (HX + 0.055, HY + 0.035, DZ + 0.02)], 0.007, hpM))
# mug handle
S(bez('mug_handle', [(0.895, 0.22, DZ + 0.075), (0.92, 0.22, DZ + 0.05), (0.895, 0.22, DZ + 0.02)], 0.006, mug))
# sticky notes on the monitor bezel (with handwriting)
for i, (txt, m, dx, dz, rz) in enumerate([("hire me :)", sticky, 0.17, 0.33, -0.08), ("call mum", stickyP, -0.19, 0.06, 0.06)]):
    cx, cz = MX + dx, MZ + dz; cy = MY - 0.02 - CD / 2 - 0.006
    S(plane('sticky', 0.07, 0.07, (cx, cy, cz), (R90, rz, 0), m))
    S(text_mesh('sticky_text', txt, 0.012, (cx, cy - 0.001, cz - 0.004), (R90, rz, 0), ink))
# SU lanyard hanging off the monitor's left corner
S(bez('lanyard', [(MX - CW / 2 + 0.01, MY - 0.06, MZ + CH - 0.005), (MX - CW / 2 - 0.02, MY - 0.17, MZ + CH * 0.55), (MX - CW / 2 + 0.03, MY - 0.17, MZ + CH * 0.35), (MX - CW / 2 + 0.04, MY - 0.06, MZ + CH - 0.01)], 0.004, lanyard))
S(box('lanyard_card', (0.055, 0.004, 0.08), (MX - CW / 2 + 0.005, MY - 0.175, MZ + CH * 0.30), card, bevel=0.003, rot=(0, 0.12, 0)))
S(text_mesh('lanyard_text', "DkIT SU", 0.011, (MX - CW / 2 + 0.005, MY - 0.178, MZ + CH * 0.32), (R90, 0.12, 0), lanyard))
# plant on the window sill: real curved leaves on stems, terracotta pot with rim and soil
soil = mat('soil', (0.12, 0.08, 0.05), 0.95)
stem = mat('stem', (0.20, 0.38, 0.12), 0.6)
def leaf_mesh(name, length, width, curl, m):
    bm = bmesh.new(); nu, nv = 10, 4; rows = []
    for i in range(nu + 1):
        u = i / nu; half = width * math.sin(math.pi * u) ** 0.8 * (1 - 0.25 * u)
        row = []
        for j in range(nv + 1):
            v = (j / nv) * 2 - 1
            x = v * half; y = u * length; z = -curl * (u ** 2) * length + abs(v) * half * 0.35   # arch + V-fold along the midrib
            row.append(bm.verts.new((x, y, z)))
        rows.append(row)
    for i in range(nu):
        for j in range(nv): bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.uv_layers.new(name='UVMap')
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for pgn in me.polygons: pgn.use_smooth = True
    sol = o.modifiers.new('s', 'SOLIDIFY'); sol.thickness = 0.0015
    bpy.context.view_layer.objects.active = o; bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='s')
    return assign(o, m)
PX, PY, PZ = (WX0 + WX1) / 2 + 0.18, Y1 - 0.09, WZ0 - 0.05
S(cyl('pot', 0.058, 0.10, (PX, PY, PZ + 0.05), terracotta, r2=0.045))
S(cyl('pot_rim', 0.064, 0.022, (PX, PY, PZ + 0.095), terracotta))
S(cyl('soil', 0.054, 0.006, (PX, PY, PZ + 0.103), soil))
for k in range(14):
    yaw = k * 2.39996; lift = 0.55 + 0.35 * ((k * 5) % 7) / 7
    ln = 0.11 + 0.05 * ((k * 3) % 5) / 5
    base = Vector((PX + math.cos(yaw) * 0.012, PY + math.sin(yaw) * 0.012, PZ + 0.105))
    tip = base + Vector((math.cos(yaw) * 0.05 * (1 - lift), math.sin(yaw) * 0.05 * (1 - lift), 0.05 + 0.06 * lift))
    S(rod('stem', base, tip, 0.0025, stem))
    lf = leaf_mesh('leaf', ln, 0.022 + 0.008 * (k % 3), 0.35, leaf if k % 3 else leaf2)
    lf.location = tip
    lf.rotation_euler = Euler((math.radians(70 * lift), 0, yaw - R90), 'ZXY')
    S(lf)
S(cyl('succ_pot', 0.03, 0.045, (0.62, 0.62, DZ + 0.0225), terracotta))
for k in range(6):
    a = k * 1.05
    S(sphere('succ', 0.018, (0.62 + math.cos(a) * 0.016, 0.62 + math.sin(a) * 0.016, DZ + 0.055), leaf2, scale=(0.7, 0.7, 1.4)))
# keyboard + mouse cables to the back of the tower
S(bez('kb_cable', [(KX, KY + 0.09, DZ + 0.01), (KX + 0.08, KY + 0.20, DZ + 0.004), (TX - 0.12, MY - 0.05, DZ + 0.004), (TX - 0.05, MY + 0.22, DZ + 0.05)], 0.0035, beigeDark))
S(bez('mouse_cable', [(0.48, 0.17, DZ + 0.01), (0.47, 0.30, DZ + 0.004), (TX + 0.05, MY - 0.10, DZ + 0.004), (TX + 0.06, MY + 0.22, DZ + 0.06)], 0.003, beigeDark))
# column radiator under the window: twin tubes per section, top/bottom manifolds, valve and pipe
RX0 = WX0 + 0.05; RYc = Y1 - 0.075; RZ0, RZ1 = 0.16, 0.66
for k in range(13):
    x = RX0 + k * 0.055
    for dy in (-0.016, 0.016):
        S(rod('rad_tube', (x, RYc + dy, RZ0 + 0.03), (x, RYc + dy, RZ1 - 0.03), 0.0115, radiatorM))
    S(box('rad_web', (0.012, 0.024, RZ1 - RZ0 - 0.07), (x, RYc, (RZ0 + RZ1) / 2), radiatorM))
for z in (RZ0 + 0.025, RZ1 - 0.025):
    S(rod('rad_manifold', (RX0 - 0.02, RYc, z), (RX0 + 12 * 0.055 + 0.02, RYc, z), 0.018, radiatorM))
for sx in (-1, 1):
    xe = RX0 - 0.02 if sx < 0 else RX0 + 12 * 0.055 + 0.02
    S(rod('rad_foot', (xe, RYc, RZ0), (xe, RYc, 0.0), 0.012, radiatorM))
S(rod('rad_valve', (RX0 - 0.05, RYc, RZ0 + 0.025), (RX0 - 0.02, RYc, RZ0 + 0.025), 0.012, metal))
S(cyl('rad_valve_head', 0.016, 0.05, (RX0 - 0.06, RYc, RZ0 + 0.05), radiatorM))
S(rod('rad_pipe', (RX0 - 0.06, RYc, RZ0 + 0.02), (RX0 - 0.06, RYc, 0.0), 0.009, metal))
# fairy lights draped across the back wall
fl_pts = []
for k in range(41):
    u = k / 40; x = X0 + 0.15 + (WX0 - 0.15 - X0 - 0.15) * u
    z = 2.0 - 0.13 * math.sin(math.pi * ((u * 3) % 1))
    fl_pts.append((x, Y1 - 0.012, z))
S(bez('fairy_wire', fl_pts[::4], 0.002, wire))
for k, p in enumerate(fl_pts):
    if k % 2 == 0: S(sphere('fairy_bulb', 0.009, (p[0], p[1] - 0.006, p[2] - 0.012), bulbs))
# tape on the poster corners
tape = mat('tape', (0.92, 0.90, 0.80), 0.8)
for (cx, cz, w, asp) in [(-1.00, 1.62, 0.40, 1024 / 819), (-0.47, 1.60, 0.36, 1024 / 724), (0.42, 1.70, 0.30, 1024 / 819)]:
    h = w * asp
    for sx in (-1, 1):
        S(plane('tape', 0.05, 0.018, (cx + sx * w / 2, Y1 - 0.006, cz + h / 2), (R90, sx * 0.6, 0), tape))

# ---------------------------------------------------------------- realism pass: procedural PBR on every material
def _n(nt, t, **kw):
    n = nt.nodes.new(t)
    for k, v in kw.items():
        if k in n.inputs: n.inputs[k].default_value = v
        else: setattr(n, k, v)
    return n
def pbr(m, kind):
    nt = m.node_tree; L = nt.links; b = nt.nodes['Principled BSDF']
    base_in = b.inputs['Base Color']
    has_img = any(x.type == 'TEX_IMAGE' for x in nt.nodes)
    base_rgb = tuple(base_in.default_value)[:3]
    tc = _n(nt, 'ShaderNodeTexCoord')
    obj = tc.outputs['Object']
    def noise(scale, detail=6, rough=0.55, vec=None):
        n = _n(nt, 'ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=rough)
        L.new(vec or obj, n.inputs['Vector']); return n
    def rgb(c):
        r = _n(nt, 'ShaderNodeRGB'); r.outputs[0].default_value = (*c, 1); return r.outputs[0]
    def mix(a, b2, fac, blend='MIX'):
        mx = _n(nt, 'ShaderNodeMix', data_type='RGBA', blend_type=blend)
        L.new(fac, mx.inputs['Factor']); L.new(a, mx.inputs[6]); L.new(b2, mx.inputs[7]); return mx.outputs[2]
    def maprange(src, a, b2, lo, hi):
        mr = _n(nt, 'ShaderNodeMapRange'); L.new(src, mr.inputs['Value'])
        mr.inputs['From Min'].default_value = a; mr.inputs['From Max'].default_value = b2
        mr.inputs['To Min'].default_value = lo; mr.inputs['To Max'].default_value = hi; return mr.outputs['Result']
    def bump(height, strength, dist=0.002):
        bp = _n(nt, 'ShaderNodeBump', Strength=strength, Distance=dist); L.new(height, bp.inputs['Height'])
        L.new(bp.outputs['Normal'], b.inputs['Normal']); return bp
    # current base colour (texture or flat)
    if has_img:
        img = [x for x in nt.nodes if x.type == 'TEX_IMAGE'][0]; col = img.outputs['Color']
    else:
        col = rgb(base_rgb)
    if kind == 'wood':
        mp = _n(nt, 'ShaderNodeMapping'); L.new(obj, mp.inputs['Vector']); mp.inputs['Scale'].default_value = (1.0, 7.0, 1.0)
        w = _n(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y', Scale=2.2, Distortion=7.0, Detail=6.0)
        L.new(mp.outputs['Vector'], w.inputs['Vector'])
        dark = tuple(c * 0.55 for c in base_rgb); light = tuple(min(1, c * 1.25) for c in base_rgb)
        col = mix(rgb(dark), rgb(light), maprange(w.outputs['Fac'], 0.2, 0.9, 0, 1))
        fine = noise(60.0, 8)
        col = mix(col, rgb(dark), maprange(fine.outputs['Fac'], 0.4, 0.8, 0, 0.25))
        L.new(maprange(fine.outputs['Fac'], 0.3, 0.7, 0.32, 0.55), b.inputs['Roughness'])
        bump(w.outputs['Fac'], 0.06)
    elif kind == 'floor':
        br = _n(nt, 'ShaderNodeTexBrick', Scale=1.0, **{'Mortar Size': 0.004, 'Brick Width': 1.4, 'Row Height': 0.14})
        L.new(obj, br.inputs['Vector']); br.offset = 0.4
        w = _n(nt, 'ShaderNodeTexWave', wave_type='BANDS', bands_direction='Y', Scale=3.0, Distortion=9.0, Detail=6.0)
        mp = _n(nt, 'ShaderNodeMapping'); L.new(obj, mp.inputs['Vector']); mp.inputs['Scale'].default_value = (1, 8, 1)
        L.new(mp.outputs['Vector'], w.inputs['Vector'])
        dark = tuple(c * 0.5 for c in base_rgb); light = tuple(min(1, c * 1.3) for c in base_rgb)
        col = mix(rgb(dark), rgb(light), maprange(w.outputs['Fac'], 0.2, 0.9, 0, 1))
        col = mix(col, rgb((0.03, 0.02, 0.01)), br.outputs['Fac'])
        L.new(maprange(w.outputs['Fac'], 0, 1, 0.3, 0.5), b.inputs['Roughness'])
        bump(br.outputs['Fac'], 0.25)
    elif kind == 'plaster':
        big = noise(2.5, 4); fine = noise(120.0, 10, 0.7)
        col = mix(col, rgb(tuple(c * 0.86 for c in base_rgb)), maprange(big.outputs['Fac'], 0.3, 0.7, 0, 0.6))
        bump(fine.outputs['Fac'], 0.08)
    elif kind == 'plastic':
        big = noise(1.8, 3); fine = noise(260.0, 8)
        yellow = (base_rgb[0] * 0.98, base_rgb[1] * 0.92, base_rgb[2] * 0.72)
        col = mix(col, rgb(yellow), maprange(big.outputs['Fac'], 0.35, 0.75, 0, 0.7))
        L.new(maprange(fine.outputs['Fac'], 0.3, 0.7, 0.36, 0.55), b.inputs['Roughness'])
        bump(fine.outputs['Fac'], 0.025)
    elif kind == 'fabric':
        fine = noise(300.0, 6); b.inputs['Sheen Weight'].default_value = 0.8; b.inputs['Sheen Roughness'].default_value = 0.4
        b.inputs['Roughness'].default_value = 0.9
        col = mix(col, rgb(tuple(c * 0.85 for c in base_rgb)), maprange(noise(6.0, 3).outputs['Fac'], 0.3, 0.7, 0, 0.5))
        bump(fine.outputs['Fac'], 0.12)
    elif kind == 'fur':
        fine = noise(700.0, 4, 0.8); b.inputs['Sheen Weight'].default_value = 1.0; b.inputs['Roughness'].default_value = 1.0
        col = mix(rgb(tuple(c * 0.7 for c in base_rgb)), col, maprange(fine.outputs['Fac'], 0.3, 0.7, 0, 1))
        bump(fine.outputs['Fac'], 0.6, 0.004)
    elif kind == 'metal':
        mp = _n(nt, 'ShaderNodeMapping'); L.new(obj, mp.inputs['Vector']); mp.inputs['Scale'].default_value = (200, 4, 4)
        n2 = noise(1.0, 4, vec=mp.outputs['Vector'])
        L.new(maprange(n2.outputs['Fac'], 0.3, 0.7, 0.18, 0.4), b.inputs['Roughness'])
    elif kind == 'paper':
        b.inputs['Roughness'].default_value = 0.8; bump(noise(180.0, 8).outputs['Fac'], 0.04)
    elif kind == 'rug':
        v = _n(nt, 'ShaderNodeTexVoronoi', Scale=6.0); L.new(obj, v.inputs['Vector'])
        wv = _n(nt, 'ShaderNodeTexWave', Scale=4.0, Distortion=2.0); L.new(obj, wv.inputs['Vector'])
        col = mix(rgb((0.42, 0.06, 0.08)), rgb((0.07, 0.10, 0.28)), maprange(v.outputs['Distance'], 0.2, 0.5, 0, 1))
        col = mix(col, rgb((0.85, 0.75, 0.55)), maprange(wv.outputs['Fac'], 0.85, 1.0, 0, 1))
        b.inputs['Sheen Weight'].default_value = 0.6; bump(noise(400.0, 4).outputs['Fac'], 0.3)
    elif kind == 'leaf':
        b.inputs['Subsurface Weight'].default_value = 0.04; b.inputs['Roughness'].default_value = 0.75; b.inputs['Specular IOR Level'].default_value = 0.15
        col = mix(col, rgb(tuple(min(1, c * 1.35) for c in base_rgb)), maprange(noise(25.0, 4).outputs['Fac'], 0.4, 0.7, 0, 1))
    elif kind == 'ceramic':
        b.inputs['Roughness'].default_value = 0.18; b.inputs['Coat Weight'].default_value = 0.4
    elif kind == 'terracotta':
        fine = noise(90.0, 8); col = mix(col, rgb(tuple(c * 0.8 for c in base_rgb)), maprange(fine.outputs['Fac'], 0.3, 0.7, 0, 0.6))
        bump(fine.outputs['Fac'], 0.1); b.inputs['Roughness'].default_value = 0.9
    # grime: darken creases and contact areas (ambient occlusion), baked into the colour
    if kind not in ('metal', 'ceramic'):
        ao = _n(nt, 'ShaderNodeAmbientOcclusion', samples=16, Distance=0.06)
        grime = mix(rgb(tuple(c * 0.45 for c in base_rgb)) if not has_img else col, col, maprange(ao.outputs['AO'], 0.2, 1.0, 0.0, 1.0))
        if not has_img: col = grime
    L.new(col, base_in)
RECIPES = {'wall': 'plaster', 'ceiling': 'plaster', 'wainscot': 'wood', 'floor': 'floor', 'desk': 'wood', 'deskDark': 'wood',
           'beige': 'plastic', 'beigeDark': 'plastic', 'keys': 'plastic', 'frame': 'plaster', 'curtain': 'fabric',
           'lampGreen': 'plastic', 'metal': 'metal', 'bear': 'fur', 'bearLight': 'fur', 'ribbon': 'fabric', 'blackPlastic': 'plastic',
           'rug': 'rug', 'padYellow': 'fabric', 'padBlue': 'fabric', 'padRed': 'fabric', 'mug': 'ceramic', 'radiator': 'plastic',
           'headphones': 'plastic', 'cushion': 'fabric', 'lanyard': 'fabric', 'card': 'paper', 'sticky': 'paper', 'stickyPink': 'paper',
           'pot': 'terracotta', 'leaf': 'leaf', 'leaf2': 'leaf', 'stem': 'leaf', 'soil': 'terracotta', 'tape': 'paper'}
for m in list(bpy.data.materials):
    k = RECIPES.get(m.name) or ('paper' if m.name.startswith('poster_') else 'plastic' if m.name.startswith('book') else None)
    if k: pbr(m, k)

# ---------------------------------------------------------------- lights
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.45, 0.38, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.035
sun_dir = Vector((-0.62, -0.40, -0.68)).normalized()      # sunlight travels in through the window, down and to the left
bpy.ops.object.light_add(type='SUN', location=(1.3, 2.0, 3.0))
sun = bpy.context.active_object; sun.name = 'Sun'
sun.data.energy = 13.0; sun.data.color = (1.0, 0.78, 0.52); sun.data.angle = math.radians(1.5)
sun.rotation_euler = sun_dir.to_track_quat('-Z', 'Y').to_euler()
# soft fill from the window opening (sky bounce)
bpy.ops.object.light_add(type='AREA', location=((WX0 + WX1) / 2, Y1 - 0.02, (WZ0 + WZ1) / 2))
fill = bpy.context.active_object; fill.name = 'WindowFill'
fill.data.shape = 'RECTANGLE'; fill.data.size = WX1 - WX0; fill.data.size_y = WZ1 - WZ0
fill.data.energy = 60; fill.data.color = (0.75, 0.85, 1.0)
fill.rotation_euler = (math.radians(90), 0, 0)   # area light points along -Z; rotate to face -Y into the room

# ---------------------------------------------------------------- camera: seated eye level, near head-on
cam_loc = Vector((0.16, -1.42, 1.34))
target = Vector((MX + 0.20, MY - 0.10, MZ + CH * 0.5 + 0.08))
bpy.ops.object.camera_add(location=cam_loc)
cam = bpy.context.active_object; cam.name = 'Camera'
cam.rotation_euler = (target - cam_loc).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 27; cam.data.sensor_width = 36
scene.camera = cam

scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Punchy' if 'AgX - Punchy' in [i.name for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['look'].enum_items] else 'None'

if MODE == 'preview':
    scene.render.resolution_x, scene.render.resolution_y = 1280, 800
    scene.cycles.samples = 96; scene.cycles.use_denoising = True
    scene.render.filepath = os.path.join(OUT, 'preview.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', scene.render.filepath)
    # numbered progress snapshot (never overwrites): build/NN-<name>.png
    import re, shutil
    label = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'preview'
    nums = [int(m.group(1)) for f in os.listdir(OUT) for m in [re.match(r'(\d\d)-', f)] if m]
    snap = os.path.join(OUT, '%02d-%s.png' % ((max(nums) + 1) if nums else 1, re.sub(r'[^a-z0-9-]+', '-', label.lower())))
    shutil.copyfile(scene.render.filepath, snap); print('SNAP', snap)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'room.blend'))
    sys.exit(0)

# ---------------------------------------------------------------- bake lightmap (diffuse irradiance, no albedo)
bpy.ops.object.select_all(action='DESELECT')
# surfaces the camera never sees still bounce light in the bake, but get no texels and aren't exported
HIDDEN = ('ceiling', 'wallF', 'wallL', 'wallR')
static = [o for o in static if o.name not in HIDDEN]
for o in static: o.select_set(True)
bpy.context.view_layer.objects.active = static[0]
bpy.ops.object.join()
room = bpy.context.active_object; room.name = 'Room'
me = room.data
if 'UVMap' not in me.uv_layers: me.uv_layers.new(name='UVMap')
lm = me.uv_layers.new(name='Lightmap'); me.uv_layers.active = lm
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=1.0, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
RES = int(os.environ.get('LM_RES', '2048'))
img = bpy.data.images.new('lightmap', RES, RES, float_buffer=True)
for m in me.materials:
    nt = m.node_tree
    n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; n.name = 'bake_target'
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'; nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
    for x in nt.nodes: x.select = False
    n.select = True; nt.nodes.active = n
scene.cycles.samples = int(os.environ.get('LM_SAMPLES', '256'))
scene.cycles.bake_type = 'DIFFUSE'
scene.render.bake.use_pass_direct = True; scene.render.bake.use_pass_indirect = True; scene.render.bake.use_pass_color = False
scene.render.bake.margin = 6
bpy.ops.object.bake(type='DIFFUSE')
# store irradiance /2 in an 8-bit PNG (three.js: lightMapIntensity = 2)
px = list(img.pixels)
for i in range(0, len(px), 4):
    px[i] *= 0.5; px[i + 1] *= 0.5; px[i + 2] *= 0.5; px[i + 3] = 1
img.pixels = px
img.filepath_raw = os.path.join(OUT, 'lightmap.png'); img.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
img.save()
# second bake: surface colour (procedural wood grain, ageing, grime) into the same atlas, gamma-encoded
alb = bpy.data.images.new('albedo', RES, RES, float_buffer=True)
for m in me.materials:
    n = m.node_tree.nodes.get('bake_target')
    if n: n.image = alb
scene.cycles.samples = 32
scene.render.bake.use_pass_direct = False; scene.render.bake.use_pass_indirect = False; scene.render.bake.use_pass_color = True
bpy.ops.object.bake(type='DIFFUSE')
px = list(alb.pixels)
for i in range(0, len(px), 4):
    for c in range(3): px[i + c] = max(0.0, min(1.0, px[i + c])) ** (1 / 2.2)
    px[i + 3] = 1
alb.pixels = px
alb.filepath_raw = os.path.join(OUT, 'albedo.png'); alb.file_format = 'PNG'; alb.save()
# remove bake nodes before export, keep UVMap first
for m in me.materials:
    nt = m.node_tree
    for x in [x for x in nt.nodes if x.name == 'bake_target' or (x.type == 'UV_MAP' and x.uv_map == 'Lightmap')]: nt.nodes.remove(x)
me.uv_layers.active = me.uv_layers['UVMap']
bpy.ops.object.select_all(action='DESELECT')
room.select_set(True); scr.select_set(True); cam.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'room.glb'), use_selection=True, export_format='GLB',
                          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=True,
                          export_image_format='JPEG', export_jpeg_quality=88)
print('BAKED', RES, 'EXPORTED', os.path.join(OUT, 'room.glb'))
