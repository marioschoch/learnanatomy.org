"""Baked shading for the tissue look (ARCHITECTURE.md §4.4, src/viewer/core/tissue.ts). numpy only: export.py runs it
inside Blender, and it runs with any Python + numpy for development.

  occlusion()  ambient occlusion of every vertex from the surfaces of its own system: darker creases where
               structures meet and darker hollows. export.py stores it in _TISSUE B.
  fibre_ends() the two points a muscle's fibres run between (tendon end to tendon end where the source marks
               tendons). export.py writes them as node extras; the viewer turns them into a fibre direction field.

Both only read positions/indices and write values per position, so vertices at the same position always get the
same value and the export's weld/simplify topology stays exactly as it was.
"""

import numpy as np


def position_groups(pos):
    """(group per vertex, index of one vertex per group): vertices at bitwise identical float32 positions share a
    group (hard edges split a position into several vertices with different normals)."""
    keys = np.ascontiguousarray(pos, np.float32).view(np.dtype((np.void, 12))).reshape(-1)
    _, first, group = np.unique(keys, return_index=True, return_inverse=True)
    return group.reshape(-1), first


def _group_normals(gp, tris):
    """Area-weighted normals per position group (outward for outward winding)."""
    fn = np.cross(gp[tris[:, 1]] - gp[tris[:, 0]], gp[tris[:, 2]] - gp[tris[:, 0]])
    n = np.zeros_like(gp)
    flat = tris.reshape(-1)
    for c in range(3):
        n[:, c] = np.bincount(flat, weights=np.repeat(fn[:, c], 3), minlength=len(gp))
    ln = np.linalg.norm(n, axis=1)
    bad = ln < 1e-20
    n[bad] = (0.0, 1.0, 0.0)
    ln[bad] = 1.0
    return n / ln[:, None]


def _smooth(values, tris, iterations):
    """Average each value with its mesh neighbours (removes the ray pattern without blurring across structures)."""
    i = np.concatenate([tris[:, 0], tris[:, 1], tris[:, 2], tris[:, 1], tris[:, 2], tris[:, 0]])
    j = np.concatenate([tris[:, 1], tris[:, 2], tris[:, 0], tris[:, 0], tris[:, 1], tris[:, 2]])
    cnt = np.bincount(i, minlength=len(values)).astype(np.float64)
    has = cnt > 0
    for _ in range(iterations):
        s = np.bincount(i, weights=values[j], minlength=len(values))
        values = np.where(has, 0.5 * values + 0.5 * s / np.maximum(cnt, 1.0), values)
    return values


def hemisphere(k):
    """k cosine-weighted unit directions around +z (Fibonacci spiral); the flattest is ≈ 10° above the tangent
    plane, so rays never graze the start surface."""
    i = np.arange(k) + 0.5
    u = i / k
    r = np.sqrt(u)
    phi = i * np.pi * (3.0 - np.sqrt(5.0))
    return np.stack([r * np.cos(phi), r * np.sin(phi), np.sqrt(1.0 - u)], axis=1)


def _rasterize(grid, dims, origin, voxel, gp, tris, labels):
    """Mark every voxel a triangle passes through with its label (sample spacing ≤ half a voxel)."""
    a = gp[tris[:, 0]]
    ab = gp[tris[:, 1]] - a
    ac = gp[tris[:, 2]] - a
    edge2 = np.max(np.stack([(ab**2).sum(1), (ac**2).sum(1), ((ac - ab) ** 2).sum(1)]), axis=0)
    n = np.clip(np.ceil(np.sqrt(edge2) / (0.5 * voxel)), 1, 128).astype(np.int64)
    for k in np.unique(n):
        ii, jj = np.meshgrid(np.arange(k + 1), np.arange(k + 1), indexing="ij")
        keep = ii + jj <= k
        u = ii[keep] / k
        v = jj[keep] / k
        sel = np.nonzero(n == k)[0]
        step = max(1, 3_000_000 // len(u))
        for s in range(0, len(sel), step):
            t = sel[s : s + step]
            pts = a[t, None, :] + ab[t, None, :] * u[None, :, None] + ac[t, None, :] * v[None, :, None]
            cell = np.floor((pts - origin) / voxel).astype(np.int64)
            lin = (cell[..., 0] * dims[1] + cell[..., 1]) * dims[2] + cell[..., 2]
            grid[lin.reshape(-1)] = np.repeat(labels[t], len(u))


# _TISSUE B holds occlusion in steps of 1 / OCCLUSION_STEPS (0..31, not 0..255): neighbouring vertices then differ
# by 0–2, which EXT_meshopt_compression stores in 2–4 bits instead of 8. The viewer scales it back (tissue.ts).
OCCLUSION_STEPS = 31


def occlusion(geos, casts, voxel, distance, rays=16, span=(0.0, 1.0), smooth=2, log=print):
    """Ambient occlusion per vertex: one uint8 array per geo, 0 (open) .. OCCLUSION_STEPS (fully occluded).

    geos: [{"pos": (n, 3), "idx": (m, 3)}] in body space with outward winding. casts[i]: whether geo i occludes
    (every geo receives). From each vertex position `rays` cosine-weighted rays are marched through a voxel grid
    (edge `voxel`) of the casting triangles; a hit at distance t occludes by 1 - t / distance. Hits on the
    vertex's own structure closer than 3 voxels are its own surface around the start point and do not count.
    The result is mapped linearly from `span` to 0..1, so open surfaces are exactly 0 and hidden ones 1 (long runs
    of equal values, which also compress well)."""
    groups, gps, gns, tris_g, offsets = [], [], [], [], [0]
    for g in geos:
        group, first = position_groups(g["pos"])
        gp = g["pos"][first].astype(np.float64)
        tri = group[g["idx"].reshape(-1, 3)]
        groups.append(group)
        gps.append(gp)
        gns.append(_group_normals(gp, tri))
        tris_g.append(tri + offsets[-1])
        offsets.append(offsets[-1] + len(gp))
    P = np.concatenate(gps)
    N = np.concatenate(gns)
    T = np.concatenate(tris_g)
    label = np.repeat(np.arange(1, len(geos) + 1, dtype=np.uint16), np.diff(offsets))
    if len(geos) >= 65535:
        raise ValueError("occlusion: too many structures for 16-bit labels")

    margin = distance + 2 * voxel
    origin = P.min(axis=0) - margin
    dims = np.ceil((P.max(axis=0) + margin - origin) / voxel).astype(np.int64) + 1
    grid = np.zeros(int(np.prod(dims)), np.uint16)
    tri_label = label[T[:, 0]]
    cast_tri = np.asarray(casts, bool)[tri_label.astype(np.int64) - 1]
    _rasterize(grid, dims, origin, voxel, P, T[cast_tri], tri_label[cast_tri])
    log(f"  occlusion grid {dims.tolist()} ({grid.nbytes / 1e6:.0f} MB), {int(cast_tri.sum()):,} casting triangles")

    local = hemisphere(rays)
    steps = np.arange(0.5 * voxel, distance, 0.75 * voxel)
    own_skip = 3 * voxel
    occ = np.zeros(len(P))
    chunk = 32768
    for s in range(0, len(P), chunk):
        p = P[s : s + chunk]
        n = N[s : s + chunk]
        lab = label[s : s + chunk]
        helper = np.where(np.abs(n[:, :1]) < 0.9, [[1.0, 0.0, 0.0]], [[0.0, 1.0, 0.0]])
        t1 = np.cross(helper, n)
        t1 /= np.linalg.norm(t1, axis=1, keepdims=True)
        t2 = np.cross(n, t1)
        d = local[None, :, 0, None] * t1[:, None] + local[None, :, 1, None] * t2[:, None] + local[None, :, 2, None] * n[:, None]
        start = p + n * (0.5 * voxel)
        hit = np.full(d.shape[:2], np.inf)
        for t in steps:
            cell = np.floor((start[:, None, :] + d * t - origin) / voxel).astype(np.int64)
            lin = (cell[..., 0] * dims[1] + cell[..., 1]) * dims[2] + cell[..., 2]
            at = grid[lin]
            new = (at != 0) & np.isinf(hit)
            if t < own_skip:
                new &= at != lab[:, None]
            hit[new] = t
        w = np.where(np.isinf(hit), 0.0, 1.0 - np.minimum(hit, distance) / distance)
        occ[s : s + chunk] = w.mean(axis=1)
    occ = _smooth(occ, T, smooth)
    occ = np.clip((occ - span[0]) / (span[1] - span[0]), 0.0, 1.0)
    occ = np.round(occ * OCCLUSION_STEPS).astype(np.uint8)
    return [occ[offsets[i] + groups[i]] for i in range(len(geos))]


def fibre_ends(pos, tendon, fan_spread=3.0):
    """The two points a muscle's fibres run between, or None for a degenerate mesh.

    pos: vertex positions; tendon: tendon weight per vertex (0..1, _TISSUE R / 255). Returns
    (a, b, kind, ends): kind "spindle" (fibres bulge between a and b and converge at both) or "fan" (b is the apex,
    a is pushed `fan_spread` times further out so fibres fan out from b); ends tells where a and b come from:
      "tendons"  centroids of the two tendon clusters (2-means), when they are far enough apart
      "tendon"   one tendon cluster + the vertices farthest from it
      "shape"    the extremes of the main axis (no tendon faces in the source)"""
    group, first = position_groups(pos)
    P = pos[first].astype(np.float64)
    if len(P) < 8:
        return None
    w = np.zeros(len(P))
    np.maximum.at(w, group, np.asarray(tendon, np.float64))
    c = P.mean(axis=0)
    X = P - c
    _, V = np.linalg.eigh(X.T @ X / len(P))
    t = X @ V[:, 2]
    lo, hi = float(t.min()), float(t.max())
    length = hi - lo
    if length <= 0:
        return None

    Tn = P[w >= 0.5]
    ends = "shape"
    if len(Tn) >= 6:
        ct = Tn.mean(axis=0)
        _, Vt = np.linalg.eigh((Tn - ct).T @ (Tn - ct) / len(Tn))
        st = (Tn - ct) @ Vt[:, 2]
        ca, cb = Tn[st.argmin()].copy(), Tn[st.argmax()].copy()
        near_a = None
        for _ in range(12):
            near_a = ((Tn - ca) ** 2).sum(1) <= ((Tn - cb) ** 2).sum(1)
            if near_a.all() or not near_a.any():
                break
            ca, cb = Tn[near_a].mean(axis=0), Tn[~near_a].mean(axis=0)
        if near_a is not None and near_a.any() and not near_a.all() and np.linalg.norm(cb - ca) >= 0.4 * length:
            a, b, ends = ca, cb, "tendons"
        else:
            tc = Tn.mean(axis=0)
            dist = np.linalg.norm(P - tc, axis=1)
            a, b, ends = P[dist >= np.quantile(dist, 0.95)].mean(axis=0), tc, "tendon"
    if ends == "shape":
        a = P[t <= lo + 0.05 * length].mean(axis=0)
        b = P[t >= hi - 0.05 * length].mean(axis=0)

    axis = b - a
    L = float(np.linalg.norm(axis))
    if L < 1e-6:
        return None
    d = axis / L
    x = (P - a) @ d / L
    r = np.linalg.norm((P - a) - np.outer(x * L, d), axis=1)

    def width(m):
        return float(np.percentile(r[m], 90)) if m.sum() >= 4 else 0.0

    wa, wb = width(x < 0.25), width(x > 0.75)
    kind = "spindle"
    if max(wa, wb) > 2.0 * max(min(wa, wb), 1e-6) and max(wa, wb) > 0.3 * L:
        if wa < wb:  # b = the narrow end (apex)
            a, b = b, a
        a = b + (a - b) * fan_spread
        kind = "fan"
    return a, b, kind, ends
