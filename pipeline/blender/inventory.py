"""
Headless inventory of the Z-Anatomy Startup.blend.

Usage (normally via `npm run assets:inventory`):
    blender -b -Y <Startup.blend> --python pipeline/blender/inventory.py -- --out data/inventory/

Writes:
    <out>/inventory.json        aggregated report (committed, kept small)
    <out>/INVENTORY.md          human-readable summary (committed)
    <out>/full/objects.json     per-object dump (gitignored, for pipeline development)

The script only reads the file. It never saves the .blend.

Notes on the source file (found while probing, see INVENTORY.md):
- Reading `TextCurve.body` crashes Blender 4.5 on some label objects in this file, so this
  script never touches `body`. Label text is derived from the object/data name instead.
- `-Y` (disable autoexec) must be passed: the file embeds an add-on script.
"""

import argparse
import collections
import json
import math
import os
import re
import sys
import time

import bpy
from mathutils import Vector

# --------------------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------------------

T0 = time.time()


def log(msg):
    sys.stderr.write(f"[inventory {time.time() - T0:6.1f}s] {msg}\n")
    sys.stderr.flush()


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    p.add_argument("--no-eval", action="store_true", help="skip evaluated (modifier/curve) triangle counts")
    return p.parse_args(argv)


# Suffix tokens used by Z-Anatomy (see the add-on's clean_name()). Order matters: longest first.
# .l/.r side · .t label · .s hidden sub-label · .st ? (9 FONT objects) · .j label leader line · .i sub-label line
# .g group heading · .o/.ol/.or muscle origin patch · .e/.el/.er muscle insertion ("end") patch
KNOWN_SUFFIXES = [".r.t", ".l.t", ".st", ".ol", ".or", ".el", ".er", ".il", ".ir", ".t", ".s", ".j", ".g", ".l", ".r", ".o", ".e", ".i"]
DUP_RE = re.compile(r"\.\d{3}$")  # Blender duplicate counter, e.g. "Femur.l.001"
# Helper objects that are not anatomy: curve bevel profiles, guide curves, UI text panels.
HELPER_RE = re.compile(r"-profile\b|-curve\b|-path\b|^BezierCircle|^HOW TO", re.I)


def split_name(name):
    """Return (base, suffix, dup) for a Z-Anatomy object name."""
    dup = ""
    m = DUP_RE.search(name)
    if m:
        dup = m.group(0)
        name = name[: m.start()]
    for s in KNOWN_SUFFIXES:
        if name.endswith(s):
            return name[: -len(s)], s, dup
    return name, "", dup


def last_token(name):
    """Last '.xyz' token (≤3 letters) of a name, for suffix statistics."""
    m = re.search(r"\.([A-Za-z]{1,3})$", DUP_RE.sub("", name))
    return "." + m.group(1) if m else ""


def world_bbox(obj):
    try:
        corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    except Exception:
        return None
    mn = [min(c[i] for c in corners) for i in range(3)]
    mx = [max(c[i] for c in corners) for i in range(3)]
    if any(math.isnan(v) for v in mn + mx):
        return None
    return mn, mx


def center(bb):
    return [(bb[0][i] + bb[1][i]) / 2 for i in range(3)]


def r3(v):
    return [round(x, 4) for x in v]


def mesh_tris(mesh):
    """Triangle count of a mesh datablock without triangulating (n-gon with k verts -> k-2 tris)."""
    n = len(mesh.polygons)
    if n == 0:
        return 0
    try:
        import numpy as np

        totals = np.empty(n, dtype=np.int32)
        mesh.polygons.foreach_get("loop_total", totals)
        return int((totals - 2).sum())
    except Exception:
        return sum(len(p.vertices) - 2 for p in mesh.polygons)


def safe_prop_value(v, depth=0):
    """JSON-friendly preview of an ID property value."""
    if hasattr(v, "keys") and hasattr(v, "items"):
        if depth > 1:
            return "{…}"
        return {k: safe_prop_value(v[k], depth + 1) for k in list(v.keys())[:12]}
    if isinstance(v, (int, float, bool)):
        return v
    if isinstance(v, str):
        return v[:120]
    try:
        return [safe_prop_value(x, depth + 1) for x in list(v)[:8]]
    except Exception:
        return repr(v)[:120]


def material_color(mat):
    """Base color of a material: Principled BSDF input if present, else viewport diffuse_color."""
    out = {"diffuse": r3(list(mat.diffuse_color))}
    try:
        if mat.use_nodes and mat.node_tree:
            for node in mat.node_tree.nodes:
                if node.type == "BSDF_PRINCIPLED":
                    inp = node.inputs.get("Base Color")
                    if inp is not None:
                        out["principled"] = r3(list(inp.default_value))
                        out["principled_linked"] = bool(inp.is_linked)
                    a = node.inputs.get("Alpha")
                    if a is not None:
                        out["alpha"] = round(float(a.default_value), 3)
                    break
            out["node_types"] = sorted({n.type for n in mat.node_tree.nodes})
    except Exception as e:  # noqa: BLE001
        out["error"] = str(e)
    try:
        out["blend_method"] = mat.blend_method
    except Exception:
        pass
    return out


def to_hex(rgb):
    """Linear RGB (Blender) -> sRGB hex."""

    def lin2srgb(c):
        c = max(0.0, min(1.0, c))
        return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055

    return "#" + "".join(f"{round(lin2srgb(c) * 255):02x}" for c in rgb[:3])


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------


def main():
    args = parse_args()
    out_dir = os.path.abspath(args.out)
    os.makedirs(os.path.join(out_dir, "full"), exist_ok=True)

    scene = bpy.context.scene
    view_layer = bpy.context.view_layer
    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "blender": bpy.app.version_string,
        "file": bpy.data.filepath,
        "fileBytes": os.path.getsize(bpy.data.filepath) if bpy.data.filepath else None,
    }

    # ---------------------------------------------------------------- scene / units
    us = scene.unit_settings
    report["scene"] = {
        "scenes": [s.name for s in bpy.data.scenes],
        "unitSystem": us.system,
        "scaleLength": us.scale_length,
        "lengthUnit": us.length_unit,
        "viewLayers": [v.name for v in scene.view_layers],
        "sceneCustomProps": {k: safe_prop_value(scene[k]) for k in scene.keys()},
    }
    log("scene ok")

    # ---------------------------------------------------------------- objects
    objects = list(bpy.data.objects)
    type_counts = collections.Counter(o.type for o in objects)
    report["objectTypes"] = dict(type_counts)
    log(f"{len(objects)} objects")

    # top-level collections = "systems" candidates
    top_cols = list(scene.collection.children)
    top_of = collections.defaultdict(set)  # object name -> set of top-level collection names
    for tc in top_cols:
        for o in tc.all_objects:
            top_of[o.name].add(tc.name)
    for o in scene.collection.objects:
        top_of[o.name].add("<Scene Collection>")

    # layer-collection state (exclude / hidden) by collection name
    lc_state = {}

    def walk_lc(lc):
        lc_state[lc.collection.name] = {
            "exclude": lc.exclude,
            "hideViewport": lc.hide_viewport,
        }
        for ch in lc.children:
            walk_lc(ch)

    walk_lc(view_layer.layer_collection)

    # per-object record
    recs = {}
    suffix_by_type = collections.defaultdict(collections.Counter)
    obj_prop_keys = collections.defaultdict(collections.Counter)
    prop_samples = {}
    modifier_counts = collections.Counter()
    for i, o in enumerate(objects):
        if i % 1000 == 0:
            log(f"objects {i}/{len(objects)}")
        base, suffix, dup = split_name(o.name)
        rec = {
            "name": o.name,
            "type": o.type,
            "base": base,
            "suffix": suffix,
            "dup": dup,
            "dataName": o.data.name if o.data is not None else None,
            "parent": o.parent.name if o.parent else None,
            "parentType": o.parent.type if o.parent else None,
            "children": len(o.children),
            "collections": [c.name for c in o.users_collection],
            "top": sorted(top_of.get(o.name, [])),
            "hideViewport": o.hide_viewport,
            "hideRender": o.hide_render,
            "hideGet": None,
            "props": list(o.keys()),
            "modifiers": [m.type for m in o.modifiers],
        }
        try:
            rec["hideGet"] = o.hide_get()
        except Exception:
            pass
        bb = world_bbox(o)
        if bb:
            rec["bbox"] = [r3(bb[0]), r3(bb[1])]
            rec["center"] = r3(center(bb))
        if o.type == "MESH":
            me = o.data
            rec["verts"] = len(me.vertices)
            rec["edges"] = len(me.edges)
            rec["faces"] = len(me.polygons)
            rec["tris"] = mesh_tris(me)
            rec["materials"] = [m.name if m else None for m in me.materials]
            rec["meshProps"] = list(me.keys())
        elif o.type == "CURVE":
            cu = o.data
            rec["curve"] = {
                "splines": len(cu.splines),
                "bevelDepth": round(cu.bevel_depth, 5),
                "bevelMode": cu.bevel_mode,
                "bevelObject": cu.bevel_object.name if cu.bevel_object else None,
                "extrude": round(cu.extrude, 5),
                "resolution": cu.resolution_u,
                "bevelResolution": cu.bevel_resolution,
                "dimensions": cu.dimensions,
                "taperObject": cu.taper_object.name if cu.taper_object else None,
            }
            rec["materials"] = [m.name if m else None for m in cu.materials]
        elif o.type == "FONT":
            # do NOT read o.data.body (crashes on some objects in this file)
            try:
                rec["fontChars"] = len(o.data.body_format)
            except Exception:
                pass
        for k in o.keys():
            obj_prop_keys[o.type][k] += 1
            if k not in prop_samples:
                try:
                    prop_samples[k] = safe_prop_value(o[k])
                except Exception as e:  # noqa: BLE001
                    prop_samples[k] = f"<error {e}>"
        for m in o.modifiers:
            modifier_counts[(o.type, m.type)] += 1
        suffix_by_type[o.type][last_token(o.name)] += 1
        recs[o.name] = rec
    log("object records ok")

    report["suffixesByType"] = {t: dict(c.most_common(30)) for t, c in suffix_by_type.items()}
    report["objectCustomProps"] = {
        t: {k: {"count": n, "sample": prop_samples.get(k)} for k, n in c.most_common()} for t, c in obj_prop_keys.items()
    }
    report["modifiers"] = {f"{t}:{m}": n for (t, m), n in modifier_counts.most_common()}

    # ---------------------------------------------------------------- collections
    def col_tree(c, depth=0):
        own = collections.Counter(o.type for o in c.objects)
        all_objs = list(c.all_objects)
        all_types = collections.Counter(o.type for o in all_objs)
        tris = sum(recs[o.name].get("tris", 0) for o in all_objs if o.type == "MESH")
        node = {
            "name": c.name,
            "own": dict(own),
            "allCount": len(all_objs),
            "meshTris": tris,
            "children": [col_tree(ch, depth + 1) for ch in c.children],
        }
        # keep the JSON small: only non-default / informative fields
        if "English" in c.keys() and str(c["English"]) != c.name:
            node["english"] = str(c["English"])
        props = {k: safe_prop_value(c[k]) for k in c.keys() if k != "English" and not k.startswith("Cross-section")}
        if props:
            node["props"] = props
        if depth <= 1:
            node["all"] = dict(all_types)
            node["layer"] = lc_state.get(c.name)
        return node

    report["collections"] = col_tree(scene.collection)
    report["collectionCount"] = len(bpy.data.collections)
    log("collections ok")

    # overlap between top-level collections
    overlap = collections.Counter()
    for name, tops in top_of.items():
        key = " + ".join(sorted(tops))
        overlap[key] += 1
    report["topCollectionMembership"] = dict(overlap.most_common(40))

    # ---------------------------------------------------------------- per-system stats
    systems = {}
    for tc in top_cols:
        objs = list(tc.all_objects)
        by_type = collections.Counter(o.type for o in objs)
        meshes = [o for o in objs if o.type == "MESH"]
        geo_meshes = [o for o in meshes if recs[o.name].get("faces", 0) > 0]
        edge_only = [o for o in meshes if recs[o.name].get("faces", 0) == 0]
        suffixes = collections.Counter(recs[o.name]["suffix"] for o in objs)
        materials = collections.Counter()
        for o in objs:
            for m in recs[o.name].get("materials", []) or []:
                materials[m] += 1
        systems[tc.name] = {
            "english": str(tc["English"]) if "English" in tc.keys() else None,
            "objects": len(objs),
            "types": dict(by_type),
            "meshesWithFaces": len(geo_meshes),
            "meshesEdgeOnly": len(edge_only),
            "meshTris": sum(recs[o.name]["tris"] for o in meshes),
            "suffixes": dict(suffixes.most_common()),
            "topMaterials": dict(materials.most_common(12)),
            "layer": lc_state.get(tc.name),
            "hiddenObjects": sum(1 for o in objs if recs[o.name]["hideGet"] or recs[o.name]["hideViewport"]),
        }
    report["systems"] = systems

    # ---------------------------------------------------------------- evaluated triangles (curves + modifiers)
    if not args.no_eval:
        log("evaluating depsgraph (un-excluding all collections temporarily) …")

        def unexclude(lc):
            lc.exclude = False
            for ch in lc.children:
                unexclude(ch)

        unexclude(view_layer.layer_collection)
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        eval_tris = {}
        for i, o in enumerate(objects):
            if o.type not in ("MESH", "CURVE"):
                continue
            if o.type == "MESH" and not o.modifiers:
                eval_tris[o.name] = recs[o.name]["tris"]
                continue
            if i % 500 == 0:
                log(f"eval {i}/{len(objects)}")
            try:
                oe = o.evaluated_get(dg)
                me = oe.to_mesh()
                eval_tris[o.name] = mesh_tris(me) if me else 0
                oe.to_mesh_clear()
            except Exception as e:  # noqa: BLE001
                eval_tris[o.name] = None
                recs[o.name]["evalError"] = str(e)
        for name, t in eval_tris.items():
            recs[name]["evalTris"] = t
        for tc in top_cols:
            objs = [o for o in tc.all_objects if o.type in ("MESH", "CURVE")]
            systems[tc.name]["evalTris"] = sum((eval_tris.get(o.name) or 0) for o in objs)
            systems[tc.name]["curveTris"] = sum((eval_tris.get(o.name) or 0) for o in objs if o.type == "CURVE")
            systems[tc.name]["curvesWithoutGeometry"] = sum(
                1 for o in objs if o.type == "CURVE" and not eval_tris.get(o.name)
            )
        log("eval ok")

    # ---------------------------------------------------------------- materials
    mats = {}
    for m in bpy.data.materials:
        c = material_color(m)
        rgb = c.get("principled") or c["diffuse"]
        mats[m.name] = {"users": m.users, "hex": to_hex(rgb), **c}
    report["materials"] = {"count": len(mats), "items": mats}
    log("materials ok")

    # ---------------------------------------------------------------- texts (definitions etc.)
    structure_names = collections.defaultdict(list)  # clean english base -> object names (geometry only)
    for o in objects:
        if o.type in ("MESH", "CURVE") and recs[o.name]["suffix"] not in (".j", ".t", ".st"):
            dn = recs[o.name]["dataName"] or o.name
            base, _, _ = split_name(dn)
            structure_names[base.strip()].append(o.name)

    label_names = {split_name(o.name)[0].strip() for o in objects if o.type == "FONT"}
    url_re = re.compile(r"(https?://\S+)\s*$")
    texts = []
    special = {}
    domains = collections.Counter()
    langs_in_url = collections.Counter()
    for t in bpy.data.texts:
        s = t.as_string()
        name = t.name
        m = url_re.search(s.strip())
        url = m.group(1) if m else None
        if url:
            dm = re.match(r"https?://([^/]+)/", url)
            if dm:
                domains[dm.group(1)] += 1
                langs_in_url[dm.group(1).split(".")[0]] += 1
        matched = name.strip() in structure_names
        texts.append({"name": name, "chars": len(s), "url": url, "matchesStructure": matched})
        if not matched and name.strip() not in label_names:
            special[name] = s
    # A text "belongs" to a structure (mesh/curve), to a label (landmark or group heading), or to nothing.
    by_target = collections.Counter()
    for t in texts:
        n = t["name"].strip()
        key = "structure" if n in structure_names else "label" if n in label_names else "unmatched"
        by_target[f"{key}:{'url' if t['url'] else 'noUrl'}"] += 1
    report["texts"] = {
        "count": len(texts),
        "withUrl": sum(1 for t in texts if t["url"]),
        "matchingStructureName": sum(1 for t in texts if t["matchesStructure"]),
        "byTarget": dict(by_target),
        "urlDomains": dict(domains.most_common(20)),
        # unmatched texts: full text for the licence, otherwise just the first line (keeps the report small)
        "unmatched": {k: (v if k == "1.Licence" else v.strip().splitlines()[0][:100] if v.strip() else "") for k, v in special.items()},
        "samples": [],
    }
    for t in [x for x in texts if x["matchesStructure"] and x["url"]][:4]:
        report["texts"]["samples"].append({"name": t["name"], "text": bpy.data.texts[t["name"]].as_string()[:700]})
    text_names = {t["name"].strip() for t in texts}

    # definition coverage per system (structure = mesh with faces or curve, not label/line)
    for tc in top_cols:
        bases = set()
        for o in tc.all_objects:
            r = recs[o.name]
            if o.type == "CURVE" or (o.type == "MESH" and r.get("faces", 0) > 0):
                if r["suffix"] in (".j", ".t", ".st"):
                    continue
                bases.add(split_name(r["dataName"] or o.name)[0].strip())
        with_def = sum(1 for b in bases if b in text_names)
        systems[tc.name]["uniqueStructureNames"] = len(bases)
        systems[tc.name]["withDefinition"] = with_def
    log("texts ok")

    # ---------------------------------------------------------------- translations / languages
    tr = bpy.data.texts.get("Translations")
    lang_info = {"translationsText": tr is not None}
    if tr:
        lines = [l for l in tr.as_string().splitlines() if l.strip()]
        header = lines[0].split(";")
        rows = [l.split(";") for l in lines[1:]]
        col_counts = collections.Counter(len(r) for r in rows)
        filled = collections.Counter()
        for r in rows:
            for i, h in enumerate(header):
                if i < len(r) and r[i].strip():
                    filled[h] += 1
        en_set = {r[0].strip() for r in rows if r}
        all_bases = set(structure_names.keys())
        lang_info.update(
            {
                "header": header,
                "rows": len(rows),
                "columnsPerRow": dict(col_counts),
                "filledPerLanguage": dict(filled),
                "structureNamesWithTranslation": len(all_bases & en_set),
                "structureNamesTotal": len(all_bases),
                "sampleRows": [";".join(r) for r in rows[100:106]],
                "sameAsEnglishLatin": sum(1 for r in rows if len(r) > 1 and r[0].strip() == r[1].strip()),
            }
        )
        # German? header or rows
        lang_info["hasGerman"] = any(h.lower().startswith(("deutsch", "german")) for h in header)
    report["languages"] = lang_info
    report["collectionEnglishProp"] = sum(1 for c in bpy.data.collections if "English" in c.keys())

    # object name vs data name (translation state of the file)
    diff = [r for r in recs.values() if r["type"] == "MESH" and r["dataName"] and split_name(r["dataName"])[0] != r["base"]]
    report["objectVsDataName"] = {
        "meshesWhereObjectBaseDiffersFromDataBase": len(diff),
        "samples": [(r["name"], r["dataName"]) for r in diff[:15]],
    }
    log("languages ok")

    # ---------------------------------------------------------------- naming conventions
    paren = [r for r in recs.values() if r["base"].strip().startswith("(")]
    brack = [r for r in recs.values() if r["base"].strip().startswith("[")]
    lead_space = [r for r in recs.values() if r["name"] != r["name"].strip()]
    dups = [r for r in recs.values() if r["dup"]]
    side_words = collections.Counter()
    for r in recs.values():
        b = r["base"].lower()
        if re.search(r"\bleft\b", b):
            side_words["word:left"] += 1
        if re.search(r"\bright\b", b):
            side_words["word:right"] += 1
    report["naming"] = {
        "parenthesized": len(paren),
        "parenthesizedSamples": [r["name"] for r in paren[:10]],
        "bracketed": len(brack),
        "bracketedSamples": [r["name"] for r in brack[:10]],
        "leadingOrTrailingSpace": len(lead_space),
        "leadingOrTrailingSpaceSamples": [r["name"] for r in lead_space[:10]],
        "blenderDuplicateCounters": len(dups),
        "duplicateSamples": [r["name"] for r in dups[:10]],
        "sideWordsInBase": dict(side_words),
        "groupObjects(.g)": collections.Counter(r["type"] for r in recs.values() if r["suffix"] == ".g"),
        "labelObjects(.t)": collections.Counter(r["type"] for r in recs.values() if r["suffix"] in (".t", ".r.t", ".l.t")),
        "leaderLines(.j)": collections.Counter(r["type"] for r in recs.values() if r["suffix"] == ".j"),
        "st(.st)": collections.Counter(r["type"] for r in recs.values() if r["suffix"] == ".st"),
        "originInsertion(.o/.i)": collections.Counter(
            r["type"] for r in recs.values() if r["suffix"] in (".o", ".ol", ".or", ".i", ".il", ".ir")
        ),
    }
    # ensure Counters are JSON-serialisable
    for k, v in list(report["naming"].items()):
        if isinstance(v, collections.Counter):
            report["naming"][k] = dict(v)

    # ---------------------------------------------------------------- labels -> structures
    label_stats = collections.Counter()
    label_samples = []
    for r in recs.values():
        if r["type"] != "FONT":
            continue
        base = r["base"].strip()
        label_stats["labels"] += 1
        if r["parent"]:
            label_stats["withParent"] += 1
            label_stats[f"parentType:{r['parentType']}"] += 1
            pbase = split_name(r["parent"])[0].strip()
            if pbase == base:
                label_stats["parentSameBase"] += 1
        if base in structure_names:
            label_stats["baseMatchesStructure"] += 1
        # leader line child?
        lines = [c for c in bpy.data.objects[r["name"]].children if c.name.endswith(".j") or ".j." in c.name]
        if lines:
            label_stats["withLeaderLineChild"] += 1
        if len(label_samples) < 8:
            label_samples.append(
                {"label": r["name"], "parent": r["parent"], "children": [c.name for c in bpy.data.objects[r["name"]].children][:3]}
            )
    leader = [r for r in recs.values() if r["suffix"] == ".j"]
    leader_info = collections.Counter()
    for r in leader:
        leader_info[f"verts:{min(r.get('verts', 0), 9)}"] += 1
        leader_info[f"parentType:{r['parentType']}"] += 1
    report["labels"] = {"stats": dict(label_stats), "samples": label_samples, "leaderLines": dict(leader_info)}
    log("labels ok")

    # ---------------------------------------------------------------- orientation
    def find(names_exact, contains=None, types=("MESH", "CURVE")):
        out = []
        for r in recs.values():
            if r["type"] not in types or r["suffix"] in (".t", ".j", ".st", ".g"):
                continue
            b = r["base"].strip().lower()
            if b in names_exact or (contains and contains in b):
                if "center" in r:
                    out.append({"name": r["name"], "center": r["center"], "bbox": r.get("bbox"), "top": r["top"]})
        return out

    landmarks = {
        "liver": find({"liver"}, None),
        "heart": find({"heart"}, None),
        "apexOfHeart": find({"apex of heart", "cardiac apex"}, None),
        "leftVentricle": find({"left ventricle"}, None),
        "spleen": find({"spleen"}, None),
        "stomach": find({"stomach"}, None),
        "nasalBone": find({"nasal bone"}, None),
        "occipitalBone": find({"occipital bone"}, None),
        "frontalBone": find({"frontal bone"}, None),
        "sternum": find({"sternum", "body of sternum", "manubrium of sternum"}, None),
        "patella": find({"patella"}, None),
        "calcaneus": find({"calcaneus"}, None),
        "femur": find({"femur"}, None),
        "aorta": find({"aorta", "ascending aorta", "arch of aorta", "descending aorta"}, None),
    }
    # mean x of .l vs .r geometry (meshes with faces + curves)
    sx = collections.defaultdict(list)
    for r in recs.values():
        if "center" not in r:
            continue
        if r["type"] == "CURVE" or (r["type"] == "MESH" and r.get("faces", 0) > 0):
            if r["suffix"] in (".l", ".r"):
                sx[r["suffix"]].append(r["center"][0])
    side_stats = {
        s: {"count": len(v), "meanX": round(sum(v) / len(v), 4) if v else None, "fractionPositiveX": round(sum(1 for x in v if x > 0) / len(v), 4) if v else None}
        for s, v in sx.items()
    }
    # bbox over anatomical geometry in the numbered system collections. Excluded: helper objects
    # (bevel profiles "-profile", guide curves "-curve"), ".g" legend meshes, reference planes.
    def is_anatomical_geometry(r):
        if r["type"] not in ("MESH", "CURVE") or "bbox" not in r:
            return False
        if r["type"] == "MESH" and r.get("faces", 0) == 0:
            return False
        if r["suffix"] in (".g", ".j", ".t", ".st", ".i"):
            return False
        if HELPER_RE.search(r["name"]):
            return False
        return any(re.match(r"^\d+:", t) for t in r["top"])

    def bbox_of(pred):
        mn, mx = [math.inf] * 3, [-math.inf] * 3
        for r in recs.values():
            if pred(r):
                for i in range(3):
                    mn[i] = min(mn[i], r["bbox"][0][i])
                    mx[i] = max(mx[i], r["bbox"][1][i])
        return mn, mx

    gmin, gmax = bbox_of(is_anatomical_geometry)
    smin, smax = bbox_of(lambda r: is_anatomical_geometry(r) and any(t.startswith("1:") for t in r["top"]))
    ext = [gmax[i] - gmin[i] for i in range(3)]
    sext = [smax[i] - smin[i] for i in range(3)]
    up_axis = "XYZ"[sext.index(max(sext))]
    # wrong-side outliers (.l on the side where most .r are, and vice versa).
    # Tolerance: ~2 mm for a 1.75 m body, scaled to the source units.
    tol = 0.002 * max(ext) / 1.75
    outliers = []
    if sx.get(".l") and sx.get(".r"):
        lsign = 1 if side_stats[".l"]["meanX"] > 0 else -1
        for r in recs.values():
            if "center" not in r or r["suffix"] not in (".l", ".r"):
                continue
            if not (r["type"] == "CURVE" or (r["type"] == "MESH" and r.get("faces", 0) > 0)):
                continue
            expected = lsign if r["suffix"] == ".l" else -lsign
            x = r["center"][0]
            if x * expected < -tol:
                outliers.append({"name": r["name"], "x": x})
    # Orientation verdict, derived only from data:
    #  up      = longest skeleton axis (feet = min)
    #  left    = sign of mean x of ".l" structures
    #  anterior= direction from occipital bone to nasal bone on the remaining horizontal axis
    def first_center(key):
        v = landmarks.get(key) or []
        return v[0]["center"] if v else None

    verdict = {"upAxis": f"+{up_axis}", "heightSource": round(max(sext), 4)}
    if side_stats.get(".l", {}).get("meanX") is not None:
        verdict["patientLeft"] = "+X" if side_stats[".l"]["meanX"] > 0 else "-X"
    nasal, occ = first_center("nasalBone"), first_center("occipitalBone")
    horiz = [i for i in range(3) if "XYZ"[i] not in ("X", up_axis)]
    if nasal and occ and horiz:
        h = horiz[0]
        verdict["anterior"] = ("+" if nasal[h] > occ[h] else "-") + "XYZ"[h]
    checks = []
    lsign = 1 if verdict.get("patientLeft") == "+X" else -1
    for key, expect_left in (("liver", False), ("spleen", True), ("stomach", True), ("leftVentricle", True)):
        c = first_center(key)
        if c:
            on_left = c[0] * lsign > 0
            checks.append({"structure": key, "x": c[0], "expected": "left" if expect_left else "right", "ok": on_left == expect_left})
    verdict["checks"] = checks
    report["orientation"] = {
        "verdict": verdict,
        "anatomicalBBox": {"min": r3(gmin), "max": r3(gmax), "extent": r3(ext)},
        "skeletonBBox": {"min": r3(smin), "max": r3(smax), "extent": r3(sext)},
        "longestAxis": up_axis,
        "sideSuffixStats": side_stats,
        "wrongSideOutliers": {"count": len(outliers), "samples": outliers[:30]},
        "landmarks": landmarks,
    }
    log("orientation ok")

    # ---------------------------------------------------------------- non-commercial candidates
    # Keyword candidates only; the authoritative list is decided by a human (ARCHITECTURE.md §Licensing).
    nc_patterns = {
        "innerEar (CC BY-NC-SA 4.0, Univ. of Dundee)": re.compile(
            r"cochlea\b|^cochlea|labyrinth|semicircular|^vestibule\b|utricle|saccule|spiral (organ|lamina)|modiolus|endolymph|perilymph|bony ampulla",
            re.I,
        ),
        "kidney (CC BY-NC 4.0, Lissie Cowley)": re.compile(r"\bkidney|renal pelvis|nephron|renal (papilla|pyramid|column|cortex|medulla)|calyx|calyces", re.I),
    }
    nc_exclude = re.compile(r"nucle|nerve|tract|lacrimal|tooth|ganglion", re.I)
    nc = {}
    for label, pat in nc_patterns.items():
        hits = [
            r
            for r in recs.values()
            if r["type"] in ("MESH", "CURVE")
            and pat.search(r["base"])
            and not nc_exclude.search(r["base"])
            and r["suffix"] not in (".t", ".j", ".st", ".i")
        ]
        nc[label] = {
            "count": len(hits),
            "names": sorted({r["name"] for r in hits})[:200],
            "collections": dict(collections.Counter(c for r in hits for c in r["collections"]).most_common(15)),
        }
    report["nonCommercialCandidates"] = nc
    log("nc ok")

    # ---------------------------------------------------------------- write
    with open(os.path.join(out_dir, "full", "objects.json"), "w", encoding="utf-8") as f:
        json.dump(list(recs.values()), f, ensure_ascii=False, indent=0)
    with open(os.path.join(out_dir, "inventory.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, separators=(",", ":"), default=str)
    write_markdown(report, os.path.join(out_dir, "INVENTORY.md"))
    log("done")


# --------------------------------------------------------------------------------------
# markdown
# --------------------------------------------------------------------------------------


def write_markdown(rep, path):
    L = []
    w = L.append
    w("# Z-Anatomy inventory\n")
    w(f"_Generated {rep['generatedAt']} by `pipeline/blender/inventory.py` with Blender {rep['blender']}._\n")
    w(f"File: `{os.path.basename(rep['file'])}` ({(rep['fileBytes'] or 0) / 1e6:.1f} MB)\n")
    sc = rep["scene"]
    w(f"Units: {sc['unitSystem']}, scale_length={sc['scaleLength']}, length unit {sc['lengthUnit']}\n")

    # ---------------------------------------------------------------- summary
    o = rep["orientation"]
    v = o["verdict"]
    lg = rep["languages"]
    tx = rep["texts"]
    w("## Summary\n")
    w(f"- **Objects:** {sum(rep['objectTypes'].values())} ({', '.join(f'{k} {n}' for k, n in rep['objectTypes'].items())})")
    w(f"- **Orientation (source):** up = {v.get('upAxis')}, patient's left = {v.get('patientLeft')}, anterior = {v.get('anterior')}; skeleton height {v.get('heightSource')} (Blender units, metres)")
    w("- **Orientation checks:** " + ", ".join(f"{c['structure']} {'OK' if c['ok'] else 'FAIL'} (x={c['x']})" for c in v.get("checks", [])))
    w(f"- **Wrong-side `.l`/`.r` outliers:** {o['wrongSideOutliers']['count']} → " + ", ".join(f"{s['name']} (x={s['x']})" for s in o['wrongSideOutliers']['samples'][:10]))
    if lg.get("header"):
        w(f"- **Name languages (Translations text):** {', '.join(lg['header'])}; German present: {lg.get('hasGerman')}; {lg.get('structureNamesWithTranslation')}/{lg.get('structureNamesTotal')} structure names have a row")
    w(f"- **Definitions:** {tx['count']} text datablocks, {tx['withUrl']} end with a source URL; by target: {tx.get('byTarget')}")
    w(f"- **Labels:** {rep['labels']['stats'].get('labels')} FONT objects, {rep['labels']['stats'].get('withLeaderLineChild')} with a leader line, {rep['labels']['stats'].get('baseMatchesStructure')} name a structure with geometry (the rest are landmarks or group headings)")
    w(f"- **IDs in custom properties (FMA/TA):** none found (see §Custom properties)")
    nc = rep["nonCommercialCandidates"]
    w("- **NC candidates (keyword match):** " + "; ".join(f"{k}: {x['count']}" for k, x in nc.items()))
    w("")
    w("| system collection | geometry objects (mesh w/ faces + curves) | labels (FONT) | eval. triangles | unique names | with definition |")
    w("|---|---|---|---|---|---|")
    for name, s in rep["systems"].items():
        w(f"| {name} | {s['meshesWithFaces'] + s['types'].get('CURVE', 0)} | {s['types'].get('FONT', 0)} | {s.get('evalTris', 0):,} | {s.get('uniqueStructureNames', 0)} | {s.get('withDefinition', 0)} |")
    w("")
    w("## Object types\n")
    w("| type | count |\n|---|---|")
    for t, n in sorted(rep["objectTypes"].items(), key=lambda x: -x[1]):
        w(f"| {t} | {n} |")
    w("")

    w("## Top-level collections (systems)\n")
    w("| collection | English prop | objects | MESH (faces) | MESH (edge-only) | CURVE | FONT | mesh tris | eval tris | curve tris | unique names | with definition |")
    w("|---|---|---|---|---|---|---|---|---|---|---|---|")
    for name, s in rep["systems"].items():
        t = s["types"]
        w(
            f"| {name} | {s['english'] or ''} | {s['objects']} | {s['meshesWithFaces']} | {s['meshesEdgeOnly']} | "
            f"{t.get('CURVE', 0)} | {t.get('FONT', 0)} | {s['meshTris']:,} | {s.get('evalTris', 0):,} | {s.get('curveTris', 0):,} | "
            f"{s.get('uniqueStructureNames', 0)} | {s.get('withDefinition', 0)} |"
        )
    w("")
    w("Layer state / suffixes per system:\n")
    for name, s in rep["systems"].items():
        w(f"- **{name}** layer={s['layer']} hidden objects={s['hiddenObjects']} suffixes={s['suffixes']} curves without geometry={s.get('curvesWithoutGeometry')}")
    w("")

    w("## Collection hierarchy (depth ≤ 4)\n")
    w("```")

    def tree(n, d=0):
        if d > 4:
            return
        own = ", ".join(f"{k}:{v}" for k, v in n["own"].items())
        w("  " * d + f"{n['name']}  (all={n['allCount']}{'; own ' + own if own else ''}; tris={n['meshTris']:,})")
        for ch in n["children"]:
            tree(ch, d + 1)

    tree(rep["collections"])
    w("```\n")
    w(f"Total collections: {rep['collectionCount']}; with `English` custom prop: {rep['collectionEnglishProp']}\n")
    w("Top-level membership combinations (objects linked into several top-level collections):\n")
    for k, v in rep["topCollectionMembership"].items():
        w(f"- {k}: {v}")
    w("")

    w("## Naming conventions\n")
    w("Suffix statistics (last `.xyz` token) by object type:\n")
    for t, c in rep["suffixesByType"].items():
        w(f"- {t}: {c}")
    w("")
    for k, v in rep["naming"].items():
        w(f"- **{k}**: {v}")
    w("")
    ov = rep["objectVsDataName"]
    w(f"Mesh object base name differs from mesh-data base name: {ov['meshesWhereObjectBaseDiffersFromDataBase']} (samples: {ov['samples'][:8]})\n")

    w("## Languages\n")
    for k, v in rep["languages"].items():
        w(f"- **{k}**: {v}")
    w("")

    w("## Definitions (text datablocks)\n")
    tx = rep["texts"]
    w(f"- text datablocks: {tx['count']}, ending with a URL: {tx['withUrl']}, name matches a structure: {tx['matchingStructureName']}")
    w(f"- by target: {tx['byTarget']}")
    w(f"- URL domains: {tx['urlDomains']}")
    w(f"- Texts matching neither a structure nor a label ({len(tx['unmatched'])}):")
    for k, first in tx["unmatched"].items():
        if k != "1.Licence":
            w(f"  - `{k}`: {first}")
    w("")
    for s in tx["samples"][:2]:
        w(f"Sample `{s['name']}`:\n\n```\n{s['text'][:500]}\n```\n")
    if "1.Licence" in tx["unmatched"]:
        w("### Embedded licence text (`1.Licence`)\n\n```\n" + tx["unmatched"]["1.Licence"] + "\n```\n")

    w("## Labels and leader lines\n")
    w(f"- {rep['labels']['stats']}")
    w(f"- leader lines: {rep['labels']['leaderLines']}")
    for s in rep["labels"]["samples"][:5]:
        w(f"  - {s}")
    w("")

    w("## Custom properties\n")
    for t, props in rep["objectCustomProps"].items():
        w(f"- **{t}**:")
        for k, v in props.items():
            w(f"  - `{k}` ×{v['count']} sample={json.dumps(v['sample'], ensure_ascii=False, default=str)[:160]}")
    w(f"\nModifiers: {rep['modifiers']}\n")

    w("## Materials\n")
    w(f"{rep['materials']['count']} materials. Top 40 by users:\n")
    w("| material | users | hex | blend |\n|---|---|---|---|")
    for name, m in sorted(rep["materials"]["items"].items(), key=lambda x: -x[1]["users"])[:40]:
        w(f"| {name} | {m['users']} | {m['hex']} | {m.get('blend_method', '')} |")
    w("")

    w("## Orientation and scale\n")
    w(f"- verdict: {o['verdict']}")
    w(f"- anatomical geometry bbox (source units): {o['anatomicalBBox']}")
    w(f"- skeleton bbox (source units): {o['skeletonBBox']}")
    w(f"- longest skeleton axis: {o['longestAxis']}")
    w(f"- `.l` / `.r` x statistics: {o['sideSuffixStats']}")
    w(f"- wrong-side outliers: {o['wrongSideOutliers']['count']} {o['wrongSideOutliers']['samples'][:10]}")
    for k, v in o["landmarks"].items():
        w(f"- {k}: " + "; ".join(f"{x['name']} @ {x['center']}" for x in v[:4]))
    w("")

    w("## Non-commercial candidates (keyword match, needs confirmation)\n")
    for k, v in rep["nonCommercialCandidates"].items():
        w(f"- **{k}**: {v['count']} objects; collections {v['collections']}")
        w(f"  - {v['names'][:40]}")
    w("")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
