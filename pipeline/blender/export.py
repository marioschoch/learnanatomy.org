"""
Headless export of the Z-Anatomy Startup.blend -> raw GLB per system + raw metadata.

Usage (normally via npm):
    node pipeline/blender/run.mjs export                         # all systems
    node pipeline/blender/run.mjs export -- --systems skeletal   # subset (comma separated ids)

Writes (data/export/, gitignored):
    scene.json          every object of the 9 numbered system collections (all systems, every run, so that ids
                        and the normalization are identical for subset and full runs): names, types, parents,
                        collections, Main-division regions, colours, label anchors, normalization, settings
    texts.json          `Translations` rows + every other text datablock (definitions)
    raw/<system>.glb    one node per structure, node name = Blender object name (renamed to ids later),
                        POSITION + NORMAL float32, uint32 indices, normalized body space (ARCHITECTURE.md §2)
    raw/<system>.json   per-structure geometry stats of that system

Geometry (ARCHITECTURE.md §4.4): the evaluated depsgraph (all modifiers, curve bevels) is read per object
instance. World transforms are baked, mirrored clones (negative determinant) get flipped winding, normals are
transformed with the inverse transpose. Z-up -> Y-up: (x, y, z) -> (x, z, -y), then feet to y = 0 and z centred.
The GLB is written by a small numpy writer below instead of bpy.ops.export_scene.gltf: node names must be ids of
any length (Blender object names are capped at 63 bytes), and baking/winding/normals must be exact per instance.
The result corresponds to export_format='GLB', export_apply=True, export_yup=True.

Safety: the .blend is never saved. All changes (un-hiding, SUBSURF level cap, curve resolution cap) only affect
the in-memory copy. TextCurve.body is never read (crashes Blender 4.5 on some labels).
"""

import argparse
import colorsys
import json
import os
import re
import struct
import sys
import time

import bpy
import numpy as np

T0 = time.time()
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONFIG = os.path.join(ROOT, "pipeline", "config", "systems.json")

HELPER_RE = re.compile(r"-profile\b|-curve\b|-path\b|^BezierCircle|^HOW TO", re.I)
# Suffixes of non-geometry helpers that are MESH objects: leader lines (.j/.i) and legend panels (.g).
HELPER_SUFFIX_RE = re.compile(r"\.(j|i|g)$")
LABEL_SUFFIX_RE = re.compile(r"\.(t|s)$")
GROUP_SUFFIX_RE = re.compile(r"\.g$")


def log(msg):
    sys.stderr.write(f"[export {time.time() - T0:7.1f}s] {msg}\n")
    sys.stderr.flush()


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    argv = [a for a in argv if a != "--"]
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--systems", default="all", help="comma separated system ids (default: all)")
    p.add_argument("--subsurf-cap", type=int, default=None)
    p.add_argument("--curve-resolution-cap", type=int, default=None)
    p.add_argument("--bevel-resolution-cap", type=int, default=None)
    return p.parse_args(argv)


def r6(v):
    return [round(float(x), 6) for x in v]


# --------------------------------------------------------------------------------------
# material colour: tiny evaluator for the shader node graphs used in this file
# --------------------------------------------------------------------------------------


def lin_to_srgb(c):
    c = max(0.0, min(1.0, float(c)))
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def to_hex(rgb):
    return "#" + "".join(f"{round(lin_to_srgb(c) * 255):02x}" for c in rgb[:3])


def as_color(v):
    if isinstance(v, (int, float)):
        return (float(v), float(v), float(v), 1.0)
    v = list(v)
    if len(v) == 3:
        v.append(1.0)
    return tuple(float(x) for x in v[:4])


def as_float(v):
    if isinstance(v, (int, float)):
        return float(v)
    v = list(v)
    return float(sum(v[:3]) / 3.0) if v else 0.0


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))


def default_of(sock):
    try:
        v = sock.default_value
    except Exception:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return tuple(float(x) for x in v)
    except Exception:
        return None


def blend(mode, a, b, f):
    if mode == "MULTIPLY":
        m = tuple(a[i] * b[i] for i in range(4))
    elif mode == "ADD":
        m = tuple(a[i] + b[i] for i in range(4))
    elif mode == "SUBTRACT":
        m = tuple(a[i] - b[i] for i in range(4))
    elif mode == "SCREEN":
        m = tuple(1 - (1 - a[i]) * (1 - b[i]) for i in range(4))
    elif mode == "DARKEN":
        m = tuple(min(a[i], b[i]) for i in range(4))
    elif mode == "LIGHTEN":
        m = tuple(max(a[i], b[i]) for i in range(4))
    else:  # MIX and everything else: plain interpolation
        m = b
    out = lerp(a, m, f)
    return (out[0], out[1], out[2], a[3])


def math_op(op, a, b):
    ops = {
        "ADD": lambda: a + b,
        "SUBTRACT": lambda: a - b,
        "MULTIPLY": lambda: a * b,
        "DIVIDE": lambda: a / b if b else 0.0,
        "MAXIMUM": lambda: max(a, b),
        "MINIMUM": lambda: min(a, b),
        "POWER": lambda: a**b if a >= 0 else 0.0,
        "GREATER_THAN": lambda: 1.0 if a > b else 0.0,
        "LESS_THAN": lambda: 1.0 if a < b else 0.0,
        "ABSOLUTE": lambda: abs(a),
    }
    f = ops.get(op)
    return f() if f else None


def group_output(tree):
    outs = [n for n in tree.nodes if n.type == "GROUP_OUTPUT"]
    for n in outs:
        if getattr(n, "is_active_output", False):
            return n
    return outs[0] if outs else None


class ColorEval:
    """Evaluates the value flowing into a socket. Unsupported nodes fall back to the socket's stored value."""

    def __init__(self, obj):
        self.obj = obj

    def sock(self, s, stack, depth=0):
        if depth > 60:
            return default_of(s)
        if s.is_linked:
            link = s.links[0]
            if link.is_valid and not link.is_muted:
                try:
                    v = self.out(link.from_node, link.from_socket, stack, depth + 1)
                except Exception:
                    v = None
                if v is not None:
                    return v
        return default_of(s)

    def inp(self, node, key, stack, depth, default=0.0):
        for i in node.inputs:
            if i.identifier == key or i.name == key:
                v = self.sock(i, stack, depth)
                return default if v is None else v
        return default

    def attribute(self, node):
        if node.attribute_type != "OBJECT":
            return None
        name = node.attribute_name
        for owner in (self.obj, getattr(self.obj, "data", None)):
            if owner is None:
                continue
            try:
                if name in owner.keys():
                    return owner[name]
            except Exception:
                pass
        try:
            return self.obj.path_resolve(name)
        except Exception:
            return 0.0

    def out(self, node, out_sock, stack, depth):
        t = node.type
        if t == "RGB":
            return as_color(node.outputs[0].default_value)
        if t == "VALUE":
            return float(node.outputs[0].default_value)
        if t == "REROUTE":
            return self.sock(node.inputs[0], stack, depth)
        if t == "GAMMA":
            c = as_color(self.inp(node, "Color", stack, depth, (0.8, 0.8, 0.8, 1)))
            g = as_float(self.inp(node, "Gamma", stack, depth, 1.0))
            return tuple((c[i] ** g if c[i] > 0 else c[i]) if i < 3 else c[i] for i in range(4))
        if t == "INVERT":
            f = as_float(self.inp(node, "Fac", stack, depth, 1.0))
            c = as_color(self.inp(node, "Color", stack, depth, (0, 0, 0, 1)))
            return lerp(c, tuple((1 - c[i]) if i < 3 else c[i] for i in range(4)), f)
        if t == "BRIGHTCONTRAST":
            c = as_color(self.inp(node, "Color", stack, depth, (0.8, 0.8, 0.8, 1)))
            br = as_float(self.inp(node, "Bright", stack, depth, 0.0))
            co = as_float(self.inp(node, "Contrast", stack, depth, 0.0))
            a, b = 1 + co, br - co * 0.5
            return tuple(max(a * c[i] + b, 0.0) if i < 3 else c[i] for i in range(4))
        if t == "HUE_SAT":
            c = as_color(self.inp(node, "Color", stack, depth, (0.8, 0.8, 0.8, 1)))
            h = as_float(self.inp(node, "Hue", stack, depth, 0.5))
            s = as_float(self.inp(node, "Saturation", stack, depth, 1.0))
            v = as_float(self.inp(node, "Value", stack, depth, 1.0))
            f = as_float(self.inp(node, "Fac", stack, depth, 1.0))
            hh, ss, vv = colorsys.rgb_to_hsv(*[max(0.0, x) for x in c[:3]])
            r, g, b = colorsys.hsv_to_rgb((hh + h - 0.5) % 1.0, min(1.0, max(0.0, ss * s)), vv * v)
            return lerp(c, (r, g, b, c[3]), f)
        if t == "MIX":
            if node.data_type == "RGBA":
                f = as_float(self.inp(node, "Factor_Float", stack, depth, 0.5))
                a = as_color(self.inp(node, "A_Color", stack, depth, (0.5, 0.5, 0.5, 1)))
                b = as_color(self.inp(node, "B_Color", stack, depth, (0.5, 0.5, 0.5, 1)))
                if getattr(node, "clamp_factor", True):
                    f = min(1.0, max(0.0, f))
                return blend(node.blend_type, a, b, f)
            if node.data_type == "FLOAT":
                f = as_float(self.inp(node, "Factor_Float", stack, depth, 0.5))
                a = as_float(self.inp(node, "A_Float", stack, depth, 0.0))
                b = as_float(self.inp(node, "B_Float", stack, depth, 0.0))
                return a + (b - a) * f
            return None
        if t == "MIX_RGB":
            f = as_float(self.inp(node, "Fac", stack, depth, 0.5))
            a = as_color(self.inp(node, "Color1", stack, depth, (0.5, 0.5, 0.5, 1)))
            b = as_color(self.inp(node, "Color2", stack, depth, (0.5, 0.5, 0.5, 1)))
            return blend(node.blend_type, a, b, min(1.0, max(0.0, f)))
        if t == "VALTORGB":
            f = as_float(self.inp(node, "Fac", stack, depth, 0.5))
            c = tuple(node.color_ramp.evaluate(min(1.0, max(0.0, f))))
            return c[3] if out_sock.name == "Alpha" else as_color(c)
        if t == "MATH":
            a = self.sock(node.inputs[0], stack, depth)
            b = self.sock(node.inputs[1], stack, depth)
            v = math_op(node.operation, as_float(a or 0.0), as_float(b or 0.0))
            if v is None:
                return None
            return min(1.0, max(0.0, v)) if node.use_clamp else v
        if t == "ATTRIBUTE":
            v = self.attribute(node)
            if v is None:
                return None
            if out_sock.name == "Fac":
                return float(v) if isinstance(v, (int, float)) else as_float(v)
            if out_sock.name == "Color":
                return as_color(v)
            return None
        if t == "GROUP":
            tree = node.node_tree
            if tree is None:
                return None
            idx = list(node.outputs).index(out_sock)
            gout = group_output(tree)
            if gout is None or idx >= len(gout.inputs):
                return None
            return self.sock(gout.inputs[idx], stack + [node], depth)
        if t == "GROUP_INPUT":
            if not stack:
                return None
            idx = list(node.outputs).index(out_sock)
            outer = stack[-1]
            if idx >= len(outer.inputs):
                return None
            return self.sock(outer.inputs[idx], stack[:-1], depth)
        return None


COLOR_BSDF = {"BSDF_PRINCIPLED": "Base Color", "BSDF_DIFFUSE": "Color"}


def find_bsdf(ev, s, stack, depth=0):
    """Follow a shader socket to the BSDF that defines the surface colour: (node, group stack) or None."""
    if depth > 40 or not s.is_linked:
        return None
    link = s.links[0]
    if not link.is_valid or link.is_muted:
        return None
    node, out = link.from_node, link.from_socket
    t = node.type
    if t in COLOR_BSDF:
        return node, stack
    if t == "MIX_SHADER":
        try:
            f = as_float(ev.sock(node.inputs[0], stack) or 0.5)
        except Exception:
            f = 0.5
        for i in (1, 2) if f < 0.5 else (2, 1):
            r = find_bsdf(ev, node.inputs[i], stack, depth + 1)
            if r:
                return r
        return None
    if t == "ADD_SHADER":
        for i in (0, 1):
            r = find_bsdf(ev, node.inputs[i], stack, depth + 1)
            if r:
                return r
        return None
    if t == "REROUTE":
        return find_bsdf(ev, node.inputs[0], stack, depth + 1)
    if t == "GROUP" and node.node_tree:
        idx = list(node.outputs).index(out)
        gout = group_output(node.node_tree)
        if gout is None or idx >= len(gout.inputs):
            return None
        return find_bsdf(ev, gout.inputs[idx], stack + [node], depth + 1)
    if t == "GROUP_INPUT" and stack:
        idx = list(node.outputs).index(out)
        outer = stack[-1]
        if idx >= len(outer.inputs):
            return None
        return find_bsdf(ev, outer.inputs[idx], stack[:-1], depth + 1)
    return None


def any_bsdf(tree, stack, depth=0):
    if depth > 6:
        return None
    for n in tree.nodes:
        if n.type in COLOR_BSDF:
            return n, stack
    for n in tree.nodes:
        if n.type == "GROUP" and n.node_tree:
            r = any_bsdf(n.node_tree, stack + [n], depth + 1)
            if r:
                return r
    return None


DEFAULT_DIFFUSE = (0.8, 0.8, 0.8)


def material_color(mat, obj):
    """(linear rgb, method) of a material for one object (object attributes can switch colours)."""
    if mat is None:
        return None, "none"
    try:
        if mat.use_nodes and mat.node_tree:
            tree = mat.node_tree
            ev = ColorEval(obj)
            outs = [n for n in tree.nodes if n.type == "OUTPUT_MATERIAL"]
            outs.sort(key=lambda n: (not getattr(n, "is_active_output", False), n.target != "ALL"))
            found = None
            for o in outs:
                found = find_bsdf(ev, o.inputs["Surface"], [])
                if found:
                    break
            method = "node"
            if not found:
                found = any_bsdf(tree, [])
                method = "node-any-bsdf"
            if found:
                node, stack = found
                c = ev.sock(node.inputs[COLOR_BSDF[node.type]], stack)
                if c is not None:
                    c = as_color(c)
                    return [max(0.0, min(1.0, x)) for x in c[:3]], method
    except Exception as e:  # noqa: BLE001
        log(f"colour evaluation failed for material {mat.name!r}: {e}")
    d = tuple(mat.diffuse_color[:3])
    if any(abs(d[i] - DEFAULT_DIFFUSE[i]) > 1e-3 for i in range(3)):
        return list(d), "diffuse"
    return None, "none"


# --------------------------------------------------------------------------------------
# geometry
# --------------------------------------------------------------------------------------

# Z-up (Blender) -> Y-up (glTF): (x, y, z) -> (x, z, -y)
AXIS = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0]])


def mat_np(m):
    return np.array([[m[i][j] for j in range(4)] for i in range(4)], dtype=np.float64)


def world_vertices(me, mw):
    n = len(me.vertices)
    co = np.empty(n * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    return co @ mw[:3, :3].T + mw[:3, 3]


def polygon_stats(me):
    """(source triangle count, most used material index) without Python loops over polygons."""
    n = len(me.polygons)
    tot = np.empty(n, np.int32)
    me.polygons.foreach_get("loop_total", tot)
    mi = np.empty(n, np.int32)
    me.polygons.foreach_get("material_index", mi)
    counts = np.bincount(mi.clip(0), minlength=1)
    return int((tot - 2).sum()), int(counts.argmax())


def extract(me, mw, offset):
    """Triangles of an evaluated mesh in normalized body space (positions f32, normals f32, indices u32)."""
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    nl = len(me.loops)
    nv = len(me.vertices)
    if nt == 0:
        return None
    co = np.empty(nv * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3).astype(np.float64)
    tl = np.empty(nt * 3, np.int32)
    me.loop_triangles.foreach_get("loops", tl)
    lv = np.empty(nl, np.int32)
    me.loops.foreach_get("vertex_index", lv)
    cn = np.empty(nl * 3, np.float32)
    me.corner_normals.foreach_get("vector", cn)
    cn = cn.reshape(-1, 3)

    # one output vertex per unique (vertex, corner normal)
    norms = cn[tl]
    key = np.empty(len(tl), dtype=[("v", "<i4"), ("x", "<f4"), ("y", "<f4"), ("z", "<f4")])
    key["v"] = lv[tl]
    key["x"], key["y"], key["z"] = norms[:, 0], norms[:, 1], norms[:, 2]
    uniq, inverse = np.unique(key, return_inverse=True)
    inverse = inverse.reshape(-1)

    m3 = mw[:3, :3]
    det = float(np.linalg.det(m3))
    pos = co[uniq["v"]] @ m3.T + mw[:3, 3]
    nrm = np.stack([uniq["x"], uniq["y"], uniq["z"]], axis=1).astype(np.float64)
    try:
        nrm = nrm @ np.linalg.inv(m3)  # row vectors: n' = n · M^-1  (== (M^-1)^T n)
    except np.linalg.LinAlgError:
        pass
    pos = pos @ AXIS.T - offset
    nrm = nrm @ AXIS.T
    ln = np.linalg.norm(nrm, axis=1)
    bad = ln < 1e-12
    ln[bad] = 1.0
    nrm = nrm / ln[:, None]
    nrm[bad] = (0.0, 1.0, 0.0)

    idx = inverse.astype(np.uint32).reshape(-1, 3)
    if det < 0:  # mirrored instance: keep the winding counter-clockwise seen from outside
        idx = idx[:, [0, 2, 1]]
    ok = (idx[:, 0] != idx[:, 1]) & (idx[:, 1] != idx[:, 2]) & (idx[:, 0] != idx[:, 2])
    if not ok.all():
        idx = idx[ok]
    if len(idx) == 0:
        return None
    return {
        "pos": pos.astype(np.float32),
        "nrm": nrm.astype(np.float32),
        "idx": np.ascontiguousarray(idx, dtype=np.uint32),
        "det": det,
    }


# --------------------------------------------------------------------------------------
# GLB writer (minimal, glTF 2.0)
# --------------------------------------------------------------------------------------


class GlbWriter:
    def __init__(self):
        self.bin = bytearray()
        self.views = []
        self.accessors = []
        self.meshes = []
        self.nodes = []
        self.materials = []
        self.material_index = {}

    def _view(self, data, target):
        while len(self.bin) % 4:
            self.bin.append(0)
        off = len(self.bin)
        self.bin.extend(data)
        self.views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
        return len(self.views) - 1

    def _accessor(self, arr, comp, typ, target, minmax=False):
        view = self._view(arr.tobytes(), target)
        acc = {"bufferView": view, "componentType": comp, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            acc["min"] = [float(x) for x in arr.min(axis=0)]
            acc["max"] = [float(x) for x in arr.max(axis=0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1

    def material(self, rgb_linear):
        key = tuple(round(float(c), 6) for c in rgb_linear)
        if key not in self.material_index:
            self.materials.append(
                {
                    "name": to_hex(key),
                    "pbrMetallicRoughness": {
                        "baseColorFactor": [key[0], key[1], key[2], 1.0],
                        "metallicFactor": 0.0,
                        "roughnessFactor": 0.7,
                    },
                }
            )
            self.material_index[key] = len(self.materials) - 1
        return self.material_index[key]

    def add(self, name, geo, rgb_linear):
        pos = np.ascontiguousarray(geo["pos"], dtype=np.float32)
        nrm = np.ascontiguousarray(geo["nrm"], dtype=np.float32)
        idx = np.ascontiguousarray(geo["idx"].reshape(-1), dtype=np.uint32)
        a_pos = self._accessor(pos, 5126, "VEC3", 34962, minmax=True)
        a_nrm = self._accessor(nrm, 5126, "VEC3", 34962)
        a_idx = self._accessor(idx, 5125, "SCALAR", 34963)
        prim = {
            "attributes": {"POSITION": a_pos, "NORMAL": a_nrm},
            "indices": a_idx,
            "mode": 4,
            "material": self.material(rgb_linear),
        }
        self.meshes.append({"name": name, "primitives": [prim]})
        self.nodes.append({"name": name, "mesh": len(self.meshes) - 1})

    def write(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        gltf = {
            "asset": {"version": "2.0", "generator": "learnanatomy.org pipeline/blender/export.py"},
            "scene": 0,
            "scenes": [{"nodes": list(range(len(self.nodes)))}],
            "nodes": self.nodes,
            "meshes": self.meshes,
            "materials": self.materials,
            "accessors": self.accessors,
            "bufferViews": self.views,
            "buffers": [{"byteLength": len(self.bin)}],
        }
        js = json.dumps(gltf, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        while len(js) % 4:
            js += b" "
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        tmp = path + ".tmp"
        with open(tmp, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack("<II", len(self.bin), 0x004E4942))
            f.write(self.bin)
        os.replace(tmp, path)
        return total


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------


def walk_layer_collections(lc, fn):
    fn(lc)
    for ch in lc.children:
        walk_layer_collections(ch, fn)


def write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, path)


def main():
    args = parse_args()
    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)
    settings = {k: v for k, v in cfg["export"].items() if not k.startswith("$")}
    if args.subsurf_cap is not None:
        settings["subsurfCap"] = args.subsurf_cap
    if args.curve_resolution_cap is not None:
        settings["curveResolutionCap"] = args.curve_resolution_cap
    if args.bevel_resolution_cap is not None:
        settings["bevelResolutionCap"] = args.bevel_resolution_cap

    systems = cfg["systems"]
    all_ids = [s["id"] for s in systems]
    if args.systems.strip() in ("", "all"):
        selected = list(all_ids)
    else:
        selected = [s.strip() for s in re.split(r"[,\s]+", args.systems) if s.strip()]
        unknown = [s for s in selected if s not in all_ids]
        if unknown:
            raise SystemExit(f"Unknown system id(s): {unknown}. Known: {all_ids}")
    out_dir = os.path.abspath(args.out)
    raw_dir = os.path.join(out_dir, "raw")
    os.makedirs(raw_dir, exist_ok=True)
    log(f"Blender {bpy.app.version_string}; systems: {selected}; settings: {settings}")

    # ------------------------------------------------------------ objects per numbered collection
    sys_of = {}
    duplicates = []
    for s in systems:
        col = bpy.data.collections.get(s["collection"])
        if col is None:
            raise SystemExit(f"Collection {s['collection']!r} not found in the .blend")
        for o in col.all_objects:
            if o.name in sys_of and sys_of[o.name] != s["id"]:
                duplicates.append([o.name, sys_of[o.name], s["id"]])
            sys_of.setdefault(o.name, s["id"])
    if duplicates:
        log(f"WARNING objects in several numbered collections: {duplicates[:10]}")
    objs = [bpy.data.objects[n] for n in sorted(sys_of)]
    log(f"{len(objs)} objects in {len(systems)} system collections")

    # ------------------------------------------------------------ reductions on the in-memory copy (never saved)
    sub_capped = 0
    for o in objs:
        for m in o.modifiers:
            if m.type == "SUBSURF" and m.levels > settings["subsurfCap"]:
                m.levels = settings["subsurfCap"]
                sub_capped += 1
    curves_capped = 0
    seen_curves = set()
    for o in objs:
        if o.type != "CURVE" or o.data.name in seen_curves:
            continue
        seen_curves.add(o.data.name)
        cu = o.data
        changed = False
        if cu.resolution_u > settings["curveResolutionCap"]:
            cu.resolution_u = settings["curveResolutionCap"]
            changed = True
        if cu.bevel_mode == "ROUND" and cu.bevel_resolution > settings["bevelResolutionCap"]:
            cu.bevel_resolution = settings["bevelResolutionCap"]
            changed = True
        curves_capped += changed
    log(f"capped SUBSURF levels on {sub_capped} modifiers, curve resolution on {curves_capped} curves")

    # ------------------------------------------------------------ make everything evaluable (runtime only)
    # Hidden objects are not evaluated by the depsgraph (their stored matrices are stale: e.g. all `.s`
    # sub-labels sit at the origin until evaluated), so un-hide everything first.
    def unhide(lc):
        lc.exclude = False
        lc.hide_viewport = False

    walk_layer_collections(bpy.context.view_layer.layer_collection, unhide)
    for o in bpy.data.objects:
        if o.hide_viewport:
            o.hide_viewport = False
        try:
            if o.hide_get():
                o.hide_set(False)
        except Exception:
            pass
    log("un-hidden; evaluating depsgraph …")
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    log("depsgraph ready")

    # ------------------------------------------------------------ Main-division regions
    region_cols = sorted({c for r in cfg["regions"] for c in r["collections"]})
    regions_of = {}
    for cname in region_cols:
        c = bpy.data.collections.get(cname)
        if c is None:
            log(f"WARNING region collection {cname!r} not found")
            continue
        for o in c.all_objects:
            regions_of.setdefault(o.name, set()).add(cname)

    # ------------------------------------------------------------ classify + evaluate
    records = []
    body_min = np.full(3, np.inf)
    body_max = np.full(3, -np.inf)
    n_eval = 0
    for i, o in enumerate(objs):
        if i % 1000 == 0:
            log(f"classify {i}/{len(objs)}")
        rec = {
            "name": o.name,
            "type": o.type,
            "system": sys_of[o.name],
            "dataName": o.data.name if o.data is not None else None,
            "parent": o.parent.name if o.parent else None,
            "collections": sorted(c.name for c in o.users_collection),
            "regionCollections": sorted(regions_of.get(o.name, [])),
        }
        if o.type in ("MESH", "CURVE"):
            if HELPER_SUFFIX_RE.search(o.name) or HELPER_RE.search(o.name):
                rec["kind"] = "helper"
            else:
                oe = o.evaluated_get(dg)
                try:
                    me = oe.to_mesh()
                except Exception as e:  # noqa: BLE001
                    me = None
                    rec["evalError"] = str(e)
                n_eval += 1
                if me is None or len(me.polygons) == 0:
                    rec["kind"] = "empty"
                else:
                    rec["kind"] = "structure"
                    mw = mat_np(oe.matrix_world)
                    wv = world_vertices(me, mw)
                    body_min = np.minimum(body_min, wv.min(axis=0))
                    body_max = np.maximum(body_max, wv.max(axis=0))
                    rec["det"] = round(float(np.linalg.det(mw[:3, :3])), 6)
                    rec["isCurve"] = o.type == "CURVE"
                    src_tris, best = polygon_stats(me)
                    rec["evalTriangles"] = src_tris
                    slots = [s.material for s in o.material_slots]
                    mat = slots[best] if best < len(slots) else None
                    rgb, method = material_color(mat, o)
                    rec["material"] = mat.name if mat else None
                    if rgb is not None:
                        rec["colorLinear"] = r6(rgb)
                        rec["color"] = to_hex(rgb)
                    rec["colorMethod"] = method
                if me is not None:
                    oe.to_mesh_clear()
        elif o.type == "FONT":
            if GROUP_SUFFIX_RE.search(o.name):
                rec["kind"] = "group"
            elif LABEL_SUFFIX_RE.search(o.name):
                rec["kind"] = "label"
            else:
                rec["kind"] = "otherText"
        else:
            rec["kind"] = "other"
        records.append(rec)
    log(f"classified; evaluated {n_eval} geometry candidates")

    # ------------------------------------------------------------ normalization (from all 9 systems)
    # Y-up body space: y' = z_src (feet -> 0), z' = -y_src (centred), x unchanged (source is centred on x).
    src_min, src_max = body_min.tolist(), body_max.tolist()
    offset = np.array([0.0, src_min[2], -(src_min[1] + src_max[1]) / 2.0])
    height = src_max[2] - src_min[2]
    log(f"source bbox min {r6(src_min)} max {r6(src_max)}; height {height:.4f} m; offset (Y-up) {r6(offset)}")

    def to_body(p):
        return r6(np.array(p, dtype=np.float64) @ AXIS.T - offset)

    # ------------------------------------------------------------ labels: anchors from evaluated leader lines
    for r in records:
        if r["kind"] != "label":
            continue
        o = bpy.data.objects[r["name"]]
        oe = o.evaluated_get(dg)
        lp = np.array(oe.matrix_world.translation)
        r["position"] = to_body(lp)
        lines = sorted(
            (c for c in o.children if c.type == "MESH" and re.search(r"\.(j|i)$", c.name)), key=lambda c: c.name
        )
        if not lines:
            continue
        line = lines[0]
        le = line.evaluated_get(dg)
        try:
            me = le.to_mesh()
        except Exception:
            me = None
        if me is None or len(me.vertices) == 0:
            continue
        wv = world_vertices(me, mat_np(le.matrix_world))
        le.to_mesh_clear()
        hooked = [i for m in line.modifiers if m.type == "HOOK" for i in m.vertex_indices]
        if hooked and hooked[0] < len(wv):
            k, how = hooked[0], "hook"
        else:
            k, how = int(np.linalg.norm(wv - lp, axis=1).argmax()), "farthest"
        r["anchor"] = to_body(wv[k])
        r["anchorMethod"] = how
        r["line"] = line.name
    log("label anchors done")

    # ------------------------------------------------------------ texts
    texts = {}
    translations = None
    for t in bpy.data.texts:
        if t.name == "Translations":
            translations = t.as_string()
        elif not t.name.endswith(".py"):
            texts[t.name] = t.as_string()
    tr_header, tr_rows = [], []
    if translations:
        lines = [ln for ln in translations.splitlines() if ln.strip()]
        tr_header = [h.strip() for h in lines[0].split(";")]
        tr_rows = [ln.split(";") for ln in lines[1:]]
    write_json(
        os.path.join(out_dir, "texts.json"), {"translations": {"header": tr_header, "rows": tr_rows}, "texts": texts}
    )
    log(f"texts: {len(texts)} datablocks, {len(tr_rows)} translation rows")

    # ------------------------------------------------------------ geometry for the selected systems
    stats = {}
    for s in systems:
        sid = s["id"]
        if sid not in selected:
            continue
        w = GlbWriter()
        per = []
        tris_total = 0
        for r in records:
            if r["system"] != sid or r["kind"] != "structure":
                continue
            o = bpy.data.objects[r["name"]]
            oe = o.evaluated_get(dg)
            me = oe.to_mesh()
            geo = extract(me, mat_np(oe.matrix_world), offset)
            oe.to_mesh_clear()
            if geo is None:
                r["kind"] = "empty"
                log(f"WARNING {r['name']}: no triangles after extraction")
                continue
            w.add(r["name"], geo, r.get("colorLinear") or [0.8, 0.8, 0.8])
            nt = int(len(geo["idx"]))
            tris_total += nt
            pos = geo["pos"]
            per.append(
                {
                    "name": r["name"],
                    "triangles": nt,
                    "vertices": int(len(pos)),
                    "mirrored": geo["det"] < 0,
                    "bboxMin": r6(pos.min(axis=0)),
                    "bboxMax": r6(pos.max(axis=0)),
                }
            )
        nbytes = w.write(os.path.join(raw_dir, f"{sid}.glb"))
        write_json(
            os.path.join(raw_dir, f"{sid}.json"),
            {"system": sid, "settings": settings, "triangles": tris_total, "structures": per},
        )
        stats[sid] = {"structures": len(per), "triangles": tris_total, "bytes": nbytes}
        log(f"{sid}: {len(per)} structures, {tris_total:,} triangles, {nbytes / 1e6:.1f} MB raw GLB")

    # ------------------------------------------------------------ scene.json (always all systems)
    scene = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "blender": bpy.app.version_string,
        "file": os.path.basename(bpy.data.filepath),
        "settings": settings,
        "systems": [
            {
                "id": s["id"],
                "collection": s["collection"],
                "english": str(bpy.data.collections[s["collection"]].get("English", "")) or None,
            }
            for s in systems
        ],
        "normalization": {
            "axis": "(x, y, z)_blender -> (x, z, -y) - offset",
            "offset": r6(offset),
            "sourceMin": r6(src_min),
            "sourceMax": r6(src_max),
            "height": round(height, 6),
        },
        "duplicatesAcrossSystems": duplicates,
        "objects": records,
        "lastExport": stats,
    }
    write_json(os.path.join(out_dir, "scene.json"), scene)
    log(f"done: {stats}")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
