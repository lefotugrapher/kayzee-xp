# ---------------------------------------------------------------- v3: mood lighting, fur, haze, cameras, render, export
import json, time
print('T_BUILD_DONE', round(time.time() - T0, 1))
# curtains glow when the sun hits them
for cm in [m for m in bpy.data.materials if m.name == 'curtain']:
    nt = cm.node_tree; out = [n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'][0]; b = nt.nodes['Principled BSDF']
    tr = nt.nodes.new('ShaderNodeBsdfTranslucent'); tr.inputs['Color'].default_value = (1.0, 0.72, 0.45, 1)
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs['Fac'].default_value = 0.5
    nt.links.new(b.outputs['BSDF'], mx.inputs[1]); nt.links.new(tr.outputs['BSDF'], mx.inputs[2]); nt.links.new(mx.outputs['Shader'], out.inputs['Surface'])
# screen shows the real desktop (so the glow on the keys has the right colours)
sm = bpy.data.materials['screen']; nt = sm.node_tree; b = nt.nodes['Principled BSDF']
dimg = os.path.join(HERE, '..', 'site', 'room', 'desktop.jpg')
if os.path.exists(dimg):
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(dimg)
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = 2.2
# real fur on the bear
furM = bpy.data.materials['bear']
for o in [o for o in bpy.data.objects if o.name.startswith('bear_') and o.data.materials and o.data.materials[0].name in ('bear', 'bearLight')]:
    md = o.modifiers.new('fur', 'PARTICLE_SYSTEM'); ps = o.particle_systems[-1].settings
    ps.type = 'HAIR'; ps.count = 2200; ps.hair_length = 0.011; ps.child_type = 'INTERPOLATED'
    try:
        ps.rendered_child_count = 10; ps.child_length = 1.0; ps.roughness_2 = 0.02; ps.root_radius = 0.6; ps.tip_radius = 0.1; ps.radius_scale = 0.0012
    except Exception as e: print('fur settings', e)
# soft haze so the sun draws shafts in the air
bpy.ops.mesh.primitive_cube_add(size=1, location=((X0 + X1) / 2, (Y0 + Y1) / 2, H / 2))
fog = bpy.context.active_object; fog.name = 'Haze'; fog.scale = (X1 - X0 - 0.02, Y1 - Y0 - 0.02, H - 0.02)
fm = bpy.data.materials.new('haze'); fm.use_nodes = True; fnt = fm.node_tree
for n in list(fnt.nodes):
    if n.type != 'OUTPUT_MATERIAL': fnt.nodes.remove(n)
vs = fnt.nodes.new('ShaderNodeVolumeScatter'); vs.inputs['Density'].default_value = max(0.001, float(os.environ.get('HAZE', '0'))); vs.inputs['Anisotropy'].default_value = 0.55
vs.inputs['Color'].default_value = (1.0, 0.9, 0.78, 1)
fnt.links.new(vs.outputs['Volume'], [n for n in fnt.nodes if n.type == 'OUTPUT_MATERIAL'][0].inputs['Volume'])
fog.data.materials.append(fm)
if float(os.environ.get('HAZE', '0')) <= 0: bpy.data.objects.remove(fog)

# lights: low golden sun, dim cool sky fill, warm lamp
world = bpy.data.worlds.new('w'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = tuple(float(v) for v in os.environ.get('AMB_COL', '0.95,0.62,0.40').split(',')) + (1,)
if os.environ.get('SKY'):
    for _n in bpy.data.materials['outside'].node_tree.nodes:
        if _n.type == 'BSDF_PRINCIPLED': _n.inputs['Emission Strength'].default_value = float(os.environ['SKY'])
        elif _n.type == 'EMISSION': _n.inputs['Strength'].default_value = float(os.environ['SKY'])
try: bpy.data.materials['fairy'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = float(os.environ.get('FAIRY', '30'))
except Exception as e: print('fairy', e)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = float(os.environ.get('AMB', '0.04'))
sun_dir = Vector((-0.62, -0.50, -0.60)).normalized()
bpy.ops.object.light_add(type='SUN', location=(2.5, 2.5, 3.0))
sun = bpy.context.active_object; sun.name = 'Sun'
sun.data.energy = float(os.environ.get('SUN', '16')); sun.data.color = (1.0, 0.62, 0.30); sun.data.angle = math.radians(2.0)
sun.rotation_euler = sun_dir.to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.light_add(type='AREA', location=((WX0 + WX1) / 2, Y1 - 0.02, (WZ0 + WZ1) / 2))
fill = bpy.context.active_object; fill.name = 'WindowFill'
fill.data.shape = 'RECTANGLE'; fill.data.size = WX1 - WX0; fill.data.size_y = WZ1 - WZ0
fill.data.energy = float(os.environ.get('FILL', '10')); fill.data.color = (1.0, 0.82, 0.62)
fill.rotation_euler = (math.radians(-90), 0, 0)   # faces -Y, into the room
lamp_light.data.energy = float(os.environ.get('LAMP', '240'))
for _o in bpy.data.objects:
    if _o.name.startswith('lamp_bulb'): _o.visible_shadow = False   # the bulb must not swallow the spot light that sits inside it

# cameras: A = the seat view (square, wide, covers every screen shape); B = close-up in front of the glass
SC = Vector((MX, MY - 0.02 - CD / 2 - 0.009, MZ + CH / 2 + 0.015))
def add_cam(name, loc, target, fov_deg):
    bpy.ops.object.camera_add(location=loc)
    c = bpy.context.active_object; c.name = name
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    c.data.sensor_fit = 'HORIZONTAL'; c.data.sensor_width = 36; c.data.lens = 18 / math.tan(math.radians(fov_deg) / 2)
    c.data.clip_start = 0.02
    return c
A_POS, A_TGT = Vector((0.20, -1.70, 1.40)), Vector((0.12, 0.40, 1.03))
camA = add_cam('CamA', A_POS, A_TGT, 72.0)
FOVB = float(os.environ.get('FOVB', '96'))   # wide, so the parked view (any window shape) is always inside this one render
camB = add_cam('CamB', SC + Vector((0, -0.40, 0)), SC, FOVB)
camP = add_cam('CamPreview', A_POS, A_TGT, 67.0)
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = os.environ.get('LOOK', 'AgX - Medium High Contrast')
except Exception as e: print('look', e)
scene.view_settings.exposure = float(os.environ.get('EXPO', '0.5'))
scene.cycles.use_denoising = True
scene.cycles.use_auto_tile = True; scene.cycles.tile_size = int(os.environ.get('TILE', '1024'))   # smaller tiles = less GPU memory
if os.environ.get('CPU'): scene.cycles.device = 'CPU'
scene.cycles.volume_step_rate = 1.0
scene.render.image_settings.file_format = 'PNG'

def render(cam, w, h, samples, path):
    scene.camera = cam; scene.render.resolution_x, scene.render.resolution_y = w, h; scene.render.resolution_percentage = 100
    scene.cycles.samples = samples; scene.render.filepath = path
    t1 = time.time(); bpy.ops.render.render(write_still=True); print('RENDERED', path, round(time.time() - t1, 1))

if MODE == 'preview':
    render(camP, 1280, 800, int(os.environ.get('SPP', '96')), os.path.join(OUT, 'preview.png'))
    import re, shutil
    label = sys.argv[sys.argv.index('--') + 2] if len(sys.argv) > sys.argv.index('--') + 2 else 'preview'
    nums = [int(m.group(1)) for f in os.listdir(OUT) for m in [re.match(r'(\d\d)-', f)] if m]
    snap = os.path.join(OUT, '%02d-%s.png' % ((max(nums) + 1) if nums else 1, re.sub(r'[^a-z0-9-]+', '-', label.lower())))
    shutil.copyfile(os.path.join(OUT, 'preview.png'), snap); print('SNAP', snap)
    if os.environ.get('CLOSE'): render(camB, 900, 900, 64, os.path.join(OUT, 'preview-close.png'))
    sys.exit(0)

# ---------------------------------------------------------------- path: the push-in from the chair to the monitor, rendered frame by frame
# (the page plays these as a short film, so the move has true parallax and no re-projection seams)
if MODE == 'path':
    from mathutils import Matrix
    N = int(os.environ.get('FRAMES', '48')); R = int(os.environ.get('RES', '1152')); PSPP = int(os.environ.get('SPP', '48'))
    PDIR = os.path.join(OUT, 'path'); os.makedirs(PDIR, exist_ok=True)
    scene.render.use_persistent_data = True
    ease = lambda x: 4 * x * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2
    upA = camA.matrix_world.to_3x3() @ Vector((0, 1, 0)); fwdA = (A_TGT - A_POS).normalized()
    lookA = A_POS + fwdA * (SC - A_POS).length; B_POS = SC + Vector((0, -0.40, 0))
    T0p, T1p = math.tan(math.radians(36)), math.tan(math.radians(FOVB / 2))
    camM = add_cam('CamPath', A_POS, A_TGT, 72.0)
    for i in range(N):
        fp = os.path.join(PDIR, 'f%03d.png' % i)
        if os.path.exists(fp): continue
        e = ease(i / (N - 1))
        pos = A_POS.lerp(B_POS, e); look = lookA.lerp(SC, e); up = upA.lerp(Vector((0, 0, 1)), e).normalized()
        z = (pos - look).normalized(); x = up.cross(z).normalized(); y = z.cross(x)
        camM.matrix_world = Matrix(((x.x, y.x, z.x, pos.x), (x.y, y.y, z.y, pos.y), (x.z, y.z, z.z, pos.z), (0, 0, 0, 1)))
        camM.data.lens = 18 / (T0p + (T1p - T0p) * e)
        bpy.context.view_layer.update()
        render(camM, R, R, PSPP, fp)
    json.dump({'frames': N, 'fps': int(os.environ.get('FPS', '24')), 'res': R, 'fov0': 72.0, 'fov1': FOVB}, open(os.path.join(PDIR, 'path.json'), 'w'))
    sys.exit(0)

# ---------------------------------------------------------------- final: two projection renders + geometry + camera data
RA, RB, SPP = int(os.environ.get('RES_A', '2800')), int(os.environ.get('RES_B', '2048')), int(os.environ.get('SPP', '320'))
ONLY_B = bool(os.environ.get('ONLY_B'))
if not ONLY_B: render(camA, RA, RA, SPP, os.path.join(OUT, 'projA.png'))
render(camB, RB, RB, SPP, os.path.join(OUT, 'projB.png'))
if os.environ.get('LAMPOFF', '1') != '0' and not ONLY_B:      # same seat view with the desk lamp switched off (the lamp is clickable on the page)
    _e0 = lamp_light.data.energy; lamp_light.data.energy = 0
    _bn = bpy.data.materials['lampBulb'].node_tree.nodes['Principled BSDF']; _s0 = _bn.inputs['Emission Strength'].default_value
    _bn.inputs['Emission Strength'].default_value = 0.12
    render(camA, RA // 2, RA // 2, SPP, os.path.join(OUT, 'projA_off.png'))
    lamp_light.data.energy = _e0; _bn.inputs['Emission Strength'].default_value = _s0
def cam_json(c, fov):
    mw = c.matrix_world; R3 = mw.to_3x3()
    return {'pos': list(mw.translation), 'fwd': list(R3 @ Vector((0, 0, -1))), 'up': list(R3 @ Vector((0, 1, 0))), 'fov': fov}
bulbs_pos = [list(o.matrix_world @ Vector(o.bound_box[0]).lerp(Vector(o.bound_box[6]), 0.5)) for o in bpy.data.objects if o.name.startswith('fairy_bulb')]
meta = {'camA': cam_json(camA, 72.0), 'camB': cam_json(camB, FOVB), 'screen': {'center': list(SC), 'w': SW, 'h': SH},
        'sunDir': list(sun_dir), 'window': {'x0': WX0, 'x1': WX1, 'z0': WZ0, 'z1': WZ1, 'y': Y1}, 'bulbs': bulbs_pos,
        'lamp': list(J2 + LAMP_DIR * 0.13)}
def _bbox(prefixes, skip=()):
    pts = [o.matrix_world @ Vector(c) for o in bpy.data.objects if o.type == 'MESH' and any((o.name == p[1:]) if p.startswith('=') else o.name.startswith(p) for p in prefixes)
           and not any(o.name.startswith(p) for p in skip) for c in o.bound_box]
    return [[min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]] if pts else None
HOT = {'note0': (['sticky0'], ()), 'note1': (['sticky1'], ()), 'lanyard': (['lanyard'], ()), 'boombox': (['boombox'], ()), 'camera': (['cam_'], ()),
       'lamp': (['lamp_'], ()), 'cube': (['cubie2'], ()), 'bear': (['bear_'], ()), 'trophy': (['trophy'], ()), 'mags': (['mag'], ()),
       'poster_destress': (['poster_destress'], ()), 'poster_ball': (['poster_ball'], ()), 'poster_reset': (['poster_reset'], ()),
       'computer': (['crt_', 'Screen', 'tower', 'keyboard', 'key', 'bay', 'floppy_slot', 'power_btn', 'cd_'], ())}
for _k in range(5): HOT['drawing%d' % _k] = (['drawing%d' % _k], ())
HOT.update({'globe': (['globe'], ()), 'robot': (['robot'], ()), 'alarm': (['alarm_clock'], ()), 'mug': (['mug'], ()), 'headphones': (['hp_'], ()),
            'plant': (['pot', 'soil', 'stem'], ()), 'succulent': (['succ'], ()), 'switch': (['switch_'], ()), 'toybox': (['toybox'], ()), 'backpack': (['backpack'], ())})
for _base, _key, _skip in (('toycar', 'car', ()), ('floppy', 'floppy', ('floppy_slot',))):      # several of each: one box per object
    for _i, _o in enumerate(sorted([o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(_base) and not o.name.startswith(_skip or ('~',))], key=lambda o: o.name)):
        HOT['%s%d' % (_key, _i)] = (['=' + _o.name], ())
meta['hot'] = {k: b for k, b in ((k, _bbox(*v)) for k, v in HOT.items()) if b}
meta['notes'] = []
for _o, _txt in NOTE_OBJS:
    _vs = [_o.matrix_world @ v.co for v in _o.data.vertices]   # the note's real (tilted) corners; its bounding box would lose the tilt
    meta['notes'].append({'text': _txt, 'corners': [list(max(_vs, key=f)) for f in (lambda p: p.z - p.x, lambda p: p.z + p.x, lambda p: p.x - p.z, lambda p: -p.x - p.z)]})   # TL, TR, BR, BL
json.dump(meta, open(os.path.join(OUT, 'room.json'), 'w'))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'room3.blend'))
# geometry only (the look comes from the projected renders)
static = [o for o in static if o.name in bpy.data.objects and o.type == 'MESH']
for o in static:
    for md in list(o.modifiers): o.modifiers.remove(md)
bpy.ops.object.select_all(action='DESELECT')
for o in static: o.select_set(True)
bpy.context.view_layer.objects.active = static[0]
bpy.ops.object.join()
room = bpy.context.active_object; room.name = 'Room'
room.data.materials.clear()
bpy.ops.object.select_all(action='DESELECT'); room.select_set(True); scr.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'room3.glb'), use_selection=True, export_format='GLB', export_texcoords=True,
                          export_normals=False, export_materials='NONE', export_cameras=False, export_apply=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
print('EXPORTED tris', sum(len(p.vertices) - 2 for p in room.data.polygons))
