# Architecture — Open Anatomy Atlas

Static single-page app (Vite + React 19 + TypeScript strict + three.js/R3F). No backend, no accounts, no
tracking. Data: Z-Anatomy (CC BY-SA 4.0), converted by an offline pipeline into compressed GLB chunks + JSON.

The project name lives in one constant: `src/config.ts → APP_NAME`.

---

## 1. Source data (what the inventory found)

Inventory: `npm run assets:inventory` → [`data/inventory/INVENTORY.md`](data/inventory/INVENTORY.md) and
`inventory.json`. Facts that shape this design:

| Fact | Consequence |
|---|---|
| `Startup.blend` (307 MB, Blender 4.5 opens it; must run with `-Y`: it embeds an add-on script). Reading `TextCurve.body` crashes Blender on some label objects. | Pipeline never reads `body`; label text comes from object names. |
| 7184 objects: 4569 MESH, 951 CURVE, 1660 FONT, 3 lights, 1 camera. | Vessels and nerves are mostly **CURVE** objects (bevelled) → converted to meshes at export. |
| Top-level collections `1:`…`9:` are the systems. `Bonus collection` (excluded from the view layer) links the **same objects** again in a TA-like hierarchy, including `Regions of human body' › Main divisions` (Head, Neck, Trunk › Thorax/Abdomen/Pelvis/Back, Left/Right upper/lower limb, hand, foot). | System = numbered collection. Regions = membership in the Main-divisions collections. |
| Object names are English (canonical; mesh data name = English base). Suffixes: `.l`/`.r` side; `.g` group heading (FONT, 521); `.t` label (FONT); `.s` hidden sub-label (FONT) with `.i` line; `.j` leader line (2-vertex MESH, hooked); `.o/.ol/.or` muscle origin, `.e/.el/.er` muscle insertion patch. Names in `( )` (69) and one in `[ ]` are kept as in the source. | Hierarchy = parent chain through `.g` headings. Labels → `labelAnchor` / landmarks. |
| `Translations` text datablock: **English;Latin;Français;Español;Portugues**, 7284 rows. **No German.** 2143 of 2452 structure names have a row. | Names: `en` always, `la/fr/es/pt` where present, no `de`. |
| 3839 text datablocks = definitions keyed by English name; 2910 end with a source URL (2893 en.wikipedia.org). Plus `1.Licence`. | Definitions: Wikipedia, CC BY-SA 3.0, per-definition URL, `reviewed: false`. |
| No FMA/TA ids in custom properties (only add-on props such as `Cross-section-*`, `M3`). | `taId`/`fmaId` stay empty (see §12). |
| Units metric, scale 1. Skeleton ≈ 1.70 m tall, Z-up, feet at z ≈ 0.01, **patient's left = +X** (99.85 % of `.l` at x > 0), **anterior = −Y** (nasal bone y −0.09 vs occipital +0.05). Liver x < 0, spleen/stomach/left ventricle x > 0 ✓. | Pipeline: Y-up conversion (x, y, z) → (x, z, −y) gives anterior = +Z, left = +X, as required. |
| 5 wrong-side outliers: `Eyelashes.l/.r` and `Lateral temporomandibular ligament.l/.r` are on the opposite side of their suffix; `Vagus nerve (X).r` bbox centre is at x = +0.02. | Upstream naming errors. Handled via a reviewed overrides file (§4.6), never silently. |
| 1325 of 1350 `.l/.r` pairs share one mesh datablock (mirrored clones). | Export bakes each instance; winding must be flipped for mirrored ones (§4.4). |
| Evaluated triangles (modifiers + curve bevels): ≈ 11.5 M in the 9 systems (cardiovascular 3.8 M, muscular 2.3 M, nervous 2.4 M). SUBSURF on 1241 meshes; curves at resolution 12 / bevel 4. | Reduce at export (cap subsurf, lower curve resolution), then simplify; report per system. |
| NC (non-commercial) sources per upstream README: Inner Ear (Univ. of Dundee, CC BY-NC-SA 4.0) and Kidney (Lissie Cowley, CC BY-NC 4.0). In the file: `Cochlea.l/.r`, `Vestibule.l/.r` (semicircular canals etc. are labels on it), `Kidney.l/.r`, `Renal pelvis.l/.r`, `Intrarenal arteries/veins of left/right kidney`. | `nonCommercial: true` on those (list in `pipeline/config/non-commercial.json`, confirmed by a human). |

---

## 2. Coordinates

Normalized body space, produced by the pipeline and used everywhere at runtime:

- **metres, true scale** (≈ 1.70 m; we do not rescale to 1.75 m)
- **+Y = superior**, feet at **y = 0**
- **+Z = anterior** (the body faces +Z)
- **+X = patient's left** → in the anterior view the patient's left is on the viewer's right
- x = 0 is the median plane (source data is already centred on x); z centred on the body bbox

Standard views (camera position → looking at the body centre):

| view | camera at | screen-up |
|---|---|---|
| anterior | +Z | +Y |
| posterior | −Z | +Y |
| left (patient's left lateral) | +X | +Y |
| right (patient's right lateral) | −X | +Y |
| superior | +Y | +Z (anterior at top) |
| inferior | −Y | +Z (anterior at top; patient's left on screen right, like axial CT) |

Orientation gizmo: A/P on ±Z, L/R (patient's) on ±X, S/I on ±Y.

---

## 3. Data flow

```
data/raw/…/Startup.blend
   │  pipeline/blender/inventory.py   (report only)
   │  pipeline/blender/export.py      Blender headless: evaluate, filter, metadata, raw GLB per system
   ▼
data/export/  (gitignored: raw GLBs + raw metadata JSON)
   │  pipeline/process.mjs            gltf-transform: weld, dedup, simplify, quantize, meshopt, split > 20 MB
   │  pipeline/manifest.mjs           manifest.json, structures/, definitions/, search-index.json, ATTRIBUTION.md
   │  pipeline/validate.mjs           hard checks (exit ≠ 0 on error), incl. orientation
   ▼
public/models/  (gitignored, reproducible)
   ├─ manifest.json
   ├─ search-index.json
   ├─ structures/<system>.json
   ├─ definitions/<system>.json
   └─ <system>[-<region>].glb
   │
   │  AtlasDataSource (src/contract/dataSource.ts)
   │    http: src/state/httpDataSource.ts  + decodeGlb (src/viewer)
   │    mock: src/mocks/                    (dev/tests; also used automatically in dev when no manifest exists)
   ▼
zustand store (src/state/store.ts, contract src/contract/store.ts)
   │                         ▲
   ▼                         │ actions only
Viewer (src/viewer, R3F) ◄──►│◄──► UI (src/ui), Quiz (src/quiz, own store), i18n (src/i18n)
   BatchedMesh per chunk     │     panels, search, tree, info, toolbar, URL state
   id maps, picking, clip    │
   └── viewerQueue ◄─────────┘     requestViewer(cmd) → Promise<result>
```

Startup: `main.tsx → bootstrap(decodeGlb)` chooses the data source, exposes `window.__atlas` (dev or
`?testHooks=1`), calls `store.init()` (manifest + search index, default layers, metadata of default-visible
systems). The viewer loads geometry for every system in `systemsNeedingGeometry(state)` and reports progress with
`setGeometryStatus`.

URL switches: `?data=mock`, `&mockLatency=300`, `?testHooks=1`.

---

## 4. Asset pipeline (Agent A, `pipeline/`)

### 4.1 Systems

| id | source collection | layerOrder | default | notes |
|---|---|---|---|---|
| `skeletal` | 1: Skeletal system | 0 | visible | bones, cartilages, teeth |
| `insertions` | 2: Muscular insertions | 1 | hidden | muscle origin/insertion patches on bones (appendicular skeleton) |
| `joints` | 3: Joints | 2 | hidden | ligaments, capsules, discs |
| `visceral` | 8: Visceral systems | 3 | visible* | digestive, respiratory, urinary, genital, endocrine |
| `cardiovascular` | 5: Cardiovascular system | 4 | hidden | heart, arteries, veins (curves) |
| `lymphoid` | 6: Lymphoid organs | 5 | hidden | |
| `nervous` | 7: Nervous system & Sense organs | 6 | hidden | brain, nerves (curves), sense organs |
| `muscular` | 4: Muscular system | 7 | hidden | muscles, fasciae, tendon sheaths, bursae |
| `regions` | 9: Regions of human body | 8 | hidden | skin, split into regional surface patches; hair, nails |

\* proposal, confirm in Phase 0 review. Excluded: `Reference lines, reference planes, movements`,
`Cross section planes`, objects only in `Bonus collection`, camera/lights.
Every exported structure must belong to exactly one numbered collection (validator).

### 4.2 What becomes what

- **Structure** = MESH with faces, or CURVE with geometry after evaluation, that is not a helper.
  Helpers (excluded): `.g` meshes (legend panels), `.j`/`.i` leader lines, names matching
  `-profile`, `-curve`, `-path`, `BezierCircle`, `HOW TO …` (bevel profiles, guide curves, text panels).
- **GroupNode** = `.g` FONT object (e.g. `Bones of lower limb.g`). The parent chain
  (`Femur.l ← Bones of free part of lower limb.g ← Bones of lower limb.g ← Skeletal system.g`) is the tree.
  `parentId` must point to a node of the **same system**; otherwise it is omitted (system root).
- **Landmark** = `.t`/`.s` FONT label whose name does not match a structure, parented to a structure
  (e.g. `Acetabular fossa.s` on `Hip bone.l`). `anchor` = end of its evaluated leader line (`.j`/`.i`, HOOK modifier).
- **labelAnchor** of a structure = end of the leader line of its own `.t` label when present.
- **origin/insertion**: `kind`, `muscleId` (same base name, same side, in `muscular`) and `boneId` (Blender parent).

### 4.3 Ids, names, sides, regions, definitions

- `slug(s)`: NFKD, strip diacritics, lowercase, drop `'`, every run of non `[a-z0-9]` → `-`, trim `-`.
  Ids match `^[a-z0-9]+(-[a-z0-9]+)*$`.
- Structure: `slug(base)` + `-l`/`-r` when the side comes from the suffix (`femur-l`, `liver`, `left-ventricle`).
- Origin/insertion: `slug(muscle) + -origin|-insertion + -l|-r` (`biceps-brachii-origin-l`).
- Group: `g-` + slug; landmark: `lm-` + slug (+ side of its structure).
- Collisions: deterministic (sort by source name), append `-<system>`, then `-2`, `-3`; listed in the report.
- `names.en` = English base as in the source (parentheses kept). `la/fr/es/pt` from `Translations`
  (exact English match). Never generated, never translated. Missing → logged.
- `side`: `.l/.r` suffix (`sideSource: 'suffix'`), else leading "Left …"/"Right …" or "… of left/right …"
  in the English name (`'name'`), else none. `pairId` = same base, other side.
- `regions`: mapped from Main-divisions membership to side-agnostic ids
  (`head, neck, trunk, thorax, abdomen, pelvis, back, upper-limb, hand, lower-limb, foot`; `RegionInfo.parentId`
  gives thorax → trunk etc.). Insertion patches inherit the regions of their bone. No membership → `[]`.
- Definitions: text datablock with the same name as the English base. Strip the leading title line and the
  trailing URL (→ `sourceUrl`). wikipedia.org → `source: 'Wikipedia'`, `license: 'CC-BY-SA-3.0'`; other or no URL →
  `source` = host or `'Z-Anatomy'`, `license: 'CC-BY-SA-4.0'` (listed in the report for review). Always
  `reviewed: false`. `definitionKey` = slug of the English base (shared by `.l`/`.r`).
- Some texts are named after collections rather than objects (≈ 190, e.g. `Abdomen`, `Abdominal wall`): attach them to
  the group/region of the same name where one exists, otherwise report them.
- `color`: sRGB hex of the material base colour. Many materials have a linked Base Color (inventory shows
  `#e7e7e7`); follow the node link (RGB/ColorRamp), else viewport `diffuse_color`, else the system colour. Report the
  method per system.

### 4.4 Geometry

- Evaluate with the depsgraph (applies SOLIDIFY, MIRROR, ARRAY, CURVE, SKIN, BOOLEAN, NODES). Cap SUBSURF levels
  (start at 1), lower curve `resolution_u`/`bevel_resolution` on a temporary copy — never save the .blend.
  Thin vessels/nerves must keep a round cross-section.
- Bake world transforms, convert to normalized body space (§2). **Mirrored clones** (negative determinant):
  bake per instance and **flip triangle winding** so normals face outward (the viewer relies on consistent
  winding for the cut-surface colour). No negative scales in the output.
- GLB per system: one node per structure, node name = structure id, base-colour material only, no textures,
  `POSITION` + `NORMAL`, indexed, identical attribute layout within a chunk (BatchedMesh requirement).
- `process.mjs`: weld, dedup, prune, careful simplify (very low error first; skip tiny/thin structures; report
  triangles before/after per system), `quantize` with **`quantizationVolume: 'scene'`** (all nodes then carry the
  same dequantization transform — `decodeGlb` applies it), `EXT_meshopt_compression`. Split a chunk by region if
  > 20 MB.
- Deliver **skeletal first**.

### 4.5 Outputs

`public/models/` as in §3, all schemas in `src/contract/anatomy.ts`. `search-index.json` contains `la`, `en`
(and `de` if it ever exists) names + synonyms only; other languages live in `structures/`. `ATTRIBUTION.md` (repo
root) is generated from the upstream README attributions + modification note + NC list. Reports go to
`data/inventory/` (`PIPELINE_REPORT.md`, small JSON).

### 4.6 Validation (`validate.mjs`, exit ≠ 0 on any error)

1:1 structures ↔ GLB nodes; unique URL-safe ids across structures/groups/landmarks; every reference resolves
(`parentId` same system, `pairId` reciprocal, `muscleId`, `boneId`, `structureId`, `definitionKey`, search index ids);
`names.en` present; files < 20 MB; attribute layouts identical per chunk; no negative-determinant transforms.
**Orientation (critical):** liver centroid x < 0; spleen, stomach, left ventricle x > 0; head above feet; nasal
bone z > occipital z (faces +Z); every `side: 'left'` structure has centroid x > 0 and `'right'` x < 0
(vertex centroid, small tolerance), left/right pairs mirror each other (|x_l + x_r| small).
Known upstream errors are listed in `pipeline/config/overrides.json` with a reason and reviewer; only listed
entries may be corrected (e.g. swap side), anything else fails the build.

---

## 5. Rendering (Agent B, `src/viewer/`)

- **Loading:** `decodeGlb` (three `GLTFLoader.parse` + `MeshoptDecoder`) returns one `BufferGeometry` per node in
  body space (applies the node's world matrix, i.e. the shared dequantization transform). Systems load lazily
  when needed (`systemsNeedingGeometry`), progress via `setGeometryStatus`. Loaded systems stay cached; toggling
  never re-creates GPU resources (no leaks).
- **BatchedMesh per chunk.** One geometry + one instance per structure; maps `instanceId → structureId` and
  `structureId → { mesh, instanceId }`. Visibility `setVisibleAt`, colour/highlight `setColorAt` (Vector4 allows
  per-instance alpha), explode `setMatrixAt`. Draw calls ≈ number of visible chunks (+ pre-passes).
- **Visibility/opacity** come only from `buildVisibilityContext` / `structureRender` (`src/state/visibility.ts`):
  - layer visible and not hidden (hiddenIds incl. descendants) → drawn at the layer opacity
  - X-ray: every visible layer except the innermost is capped at `XRAY_OPACITY` (0.25)
  - isolate: only the isolated set, opaque, even from hidden layers
  - isolate with context: isolated set opaque; the rest of what was visible drawn as **ghost**
    (`GHOST_OPACITY` 0.08, desaturated, not pickable)
  - rendered opacity < `PICK_MIN_OPACITY` (0.05) → not pickable
- **Transparency order:** opaque chunks first. Transparent chunks: `transparent`, `depthWrite: false`,
  `renderOrder` by `layerOrder` (inner → outer), each preceded by a **depth pre-pass** of the same geometry
  (`colorWrite: false`, `depthWrite: true`) so a layer shows only its front-most surface and does not self-overlap;
  per-instance sorting (`sortObjects`) on. Target look: skin 20 % over muscles 60 % over opaque bones, clean.
- **Clipping:** `renderer.localClippingEnabled`, one shared `clippingPlanes` array on all atlas materials.
  Plane position = `bodyBounds.min + position × size` on the axis (sagittal x, coronal z, transverse y);
  `flipped: false` keeps the side with the larger coordinate. Cut faces: `DoubleSide` + `gl_FrontFacing` in the
  fragment shader → flat cut colour (stencil capping is a stretch goal).
- **Picking:** three-mesh-bvh 0.9.17 supports BatchedMesh (`computeBatchedBoundsTree`, accelerated raycast uses
  per-instance matrices, so exploded positions are hit correctly). Skip non-pickable instances and hits on the
  clipped side of an active plane. Click = pointer up within ~5 px / 500 ms of down; hover only for fine
  pointers, throttled. Pick → `pickStructure(id)` (the store routes it to selection or quiz).
- **Explode:** offset = (centroid − system bbox centre) × explode × k, animated (instant with reduced motion).
- **Camera:** drei `CameraControls`, damping, zoom limits from `bodyBounds`, standard views (§2), focus = fit
  union bbox of `structureIdsOfNode`, reset. Reports `setCamera(pose)` when at rest.
- **Labels:** drei `Html` for selected + pinned nodes (landmarks use `anchor`), leader line to `labelAnchor`
  (or nearest surface point), hidden when the structure is hidden/clipped, simple overlap avoidance.
- **Utilities:** `frameloop="demand"` + invalidate, adaptive DPR, touch gestures, screenshot command, dev stats
  overlay (`renderer.info`) and `setViewerStats`.

---

## 6. State model

One zustand store with `subscribeWithSelector` (`useAtlasStore`), contract in `src/contract/store.ts`,
implementation `src/state/store.ts` (lead). Pure helpers: `src/state/visibility.ts`, `selectors.ts`, `names.ts`.

- **Data:** manifest, search index, per-system metadata (`ensureSystemMeta`, `ensureNodeMeta`), definitions on demand.
- **Layers:** `layers[systemId] = { visible, opacity }`, `hiddenIds`, `xray`.
- **Selection:** `selectedId` (structure, group or landmark), `hoveredId`, `pinnedIds`, `isolate`
  (`mode`, `ids`, `cameraBefore`), `highlights` (quiz colours).
  Isolate never mutates layers/hiddenIds → exit restores the previous state exactly; the camera is restored too.
- **Tools:** `clipping`, `explode`, `labelsVisible`.
- **Viewer bridge:** `requestViewer(cmd) → Promise<ViewerCommandResult>`; the viewer drains `viewerQueue` and calls
  `completeViewerCommand`. Commands: `focus`, `setView`, `setCameraPose`, `resetCamera`, `zoom`, `screenshot`
  (`src/contract/viewerApi.ts`). No React refs across modules.
- **Quiz:** own store in `src/quiz/`. Uses `setMode('quiz')`, layer/isolate actions, `setHighlights`, and reads
  `quizPick` (set by `pickStructure` in quiz mode; `seq` increments per pick). Labels and the info panel are hidden
  while `mode === 'quiz'`.
- **Preferences:** `uiLang` (browser default), `nameLang` (default `la`; fallback Latin → English, never
  translated), `theme`, `reducedMotion`. Persisting them (localStorage, try/catch) is UI work.
- **Names:** always via `displayName(names, nameLang)`.

## 7. URL state

Query string, written with `history.replaceState` (debounced ~300 ms), only non-default values. Codec in
`src/ui/` (Agent C) ↔ `getShareableState()` / `applyShareableState()`. Ids are `[a-z0-9-]`, so `,` `.` `:` are
safe separators.

| key | meaning | example |
|---|---|---|
| `s` | selected id | `s=femur-l` |
| `l` | visible layers with opacity % (authoritative when present) | `l=skeletal.100,muscular.40` |
| `h` | hidden node ids | `h=g-ribs,sternum` |
| `i` | isolate `i` (isolate) / `c` (context) + ids | `i=c:heart` |
| `c` | clip planes `s`/`c`/`t` + position % (1 decimal) + optional `f` (flipped) | `c=s50,t32.5f` |
| `e` | explode % | `e=40` |
| `x` | X-ray on | `x=1` |
| `cam` | camera position + target in mm | `cam=0,1100,3200,0,1000,0` |
| `n` | name language | `n=en` |
| `p` | pinned ids | `p=femur-l,tibia-l` |

Unknown ids are ignored. A future incompatible change adds `u=2`.

## 8. UI (Agent C, `src/ui/`, `src/quiz/`, `src/i18n/`)

Layout per PROMPT.md §6-C. Talks to the viewer only through the store. System and region labels for German come
from i18n keyed by id (UI labels, not anatomical names); anatomical names only from data. Quiz and credits are
code-split (`React.lazy`). Tailwind v4 (`@import 'tailwindcss'`, class-based dark mode via `.dark` on `<html>`),
self-hosted Inter (`@fontsource-variable/inter`), Radix primitives from `radix-ui`.

## 9. Performance budgets

| budget | target |
|---|---|
| startup download (manifest + search index + skeletal) | ≤ 5 MB |
| first interactive view | ≤ 3 s; skeleton visible ≤ 4 s |
| orbit, all systems visible | ≥ 50 fps laptop; ≥ 30 fps mid-range phone (default layers) |
| draw calls, default view | ≤ 30 |
| any single file | < 20 MB |
| main JS bundle | ≤ 400 kB gzip (quiz + credits code-split) |
| memory | no growth in `renderer.info.memory` when toggling systems |

Phase-0 baseline: empty shell 107 kB gzip (three.js included via mocks).

## 10. Licensing

- Code: MIT (`LICENSE`). Processed assets + extracted metadata: CC BY-SA 4.0 (`assets.LICENSE`), derived from
  BodyParts3D (CC BY-SA 2.1 JP) via Z-Anatomy (CC BY-SA 4.0). Definitions: Wikipedia CC BY-SA 3.0, source link per
  definition, "unreviewed" badge until `reviewed: true`.
- `Manifest.attributions` holds the attribution records; `Structure.attribution` references one
  (`z-anatomy` by default; `dundee-inner-ear` and `cowley-kidney` for NC items, `nonCommercial: true`).
  One filter (`!s.nonCommercial`) removes NC content.
- `ATTRIBUTION.md` is generated by the pipeline and shown on the credits page. Generated models are not committed.
- Upstream also credits "Brainder" and "White matter" (University of Washington) without a stated licence, and
  "Cranial Nerves and Foramina" (Dundee, CC BY 4.0); per-structure provenance for these is not in the file.

## 11. Ownership and process

| path | owner |
|---|---|
| `package.json`, root configs, `src/contract/**`, `src/state/**`, `src/mocks/**`, `src/App.tsx`, `src/main.tsx`, `src/config.ts`, `ARCHITECTURE.md` | lead |
| `pipeline/**` (except `pipeline/blender/inventory.py`, `run.mjs`: lead, A may extend) | Agent A |
| `src/viewer/**` | Agent B |
| `src/ui/**`, `src/quiz/**`, `src/i18n/**` | Agent C |
| `tests/e2e/**` | Agent D (Phase 3); others add `tests/e2e/<area>-*.spec.ts` smoke tests |

Agents never edit files outside their area. Contract changes and new dependencies are proposed to the lead.
Unit tests sit next to the code (`*.test.ts`). Conventional commits after each phase / merged agent.

Verification commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`,
`npm run assets:build`, `npm run assets:validate`.

## 12. Deviations from PROMPT.md (follow the data)

1. **No German anatomical names** in Z-Anatomy. Name languages present: en, la, fr, es, pt. The name toggle offers
   Latin/English (German only if data ever provides it); fr/es/pt are kept in metadata.
2. **No TA/FMA ids** in the file. `taId`/`fmaId` stay empty. Possible later: map via `TA2.csv` from the Z-Anatomy
   repo (separate download, needs approval).
3. **True scale** (≈ 1.70 m) instead of normalizing to 1.75 m.
4. **Nine systems** instead of a generic list, incl. `insertions` (muscle attachments) and `regions` (= skin layer).
5. **Landmarks** (≈ 1 100 labels without own geometry, e.g. bone features; plus 521 group headings) and **groups** are first-class,
   searchable, selectable nodes. Landmarks are not clickable in 3D and not used for "Locate" questions.
6. `Side` is only `left | right` (no `midline`/`bilateral`; the data does not say).
7. Definitions are loaded on demand from separate files (keeps startup small), English only.
8. Mirrored clones are baked (larger download, simpler/safer). Mesh instancing with mirrored matrices is a possible
   later optimization if the budget is missed.
9. Upstream wrong-side names are corrected only through `pipeline/config/overrides.json` after human review.
10. Ghosted structures (isolate with context) are not pickable.

## 13. Task list

- [x] Phase 0 — scaffold, dependencies, configs, scripts; Blender inventory; contract (`src/contract/`), store,
  mocks; ARCHITECTURE.md; agent definitions (`.claude/agents/`)
- [ ] Phase 0 review — owner decisions: default systems, NC list, side overrides, TA2.csv (§12)
- [ ] Phase 1 — Agents A (pipeline, skeletal first), B (viewer on mocks → skeletal), C (UI/quiz on mocks) in parallel;
  lead reviews each diff, answers contract proposals
- [ ] Phase 2 — integration on real assets, screenshots (default, X-ray, sagittal head cut, exploded thorax,
  isolate-with-context heart, mobile), budgets
- [ ] Phase 3 — independent QA (Agent D) → QA_REPORT.md, fixes, re-runs
- [ ] Phase 4 — README (DE/EN), CONTRIBUTING (definition review workflow), deploy commands for the owner
