skeletal delivered: 2026-10-29T01:20:35Z (public/models: manifest + skeletal.glb, assets:validate passed)
full delivered: 2026-10-29T05:53:10Z (8 systems published, insertions held pending side review; assets:build + assets:validate passed)

# Pipeline report

_Generated 2026-10-29T05:52:01.071Z by `pipeline/manifest.mjs`. Systems in this build: skeletal, joints, visceral, cardiovascular, lymphoid, nervous, muscular, regions._

Source: `Startup.blend`, Blender 4.5.0, export 2026-10-29T05:45:38Z. Export settings: {"subsurfCap":1,"curveResolutionCap":6,"bevelResolutionCap":2}. Body height (all systems) 1.7437 m; normalization offset (Y-up) [0,-0.000382,-0.001348].

## Stats

| system | structures | groups | landmarks | triangles (inventory, original settings) | triangles exported | triangles published | reduction | bytes per file | languages | with definition | NC |
|---|---|---|---|---|---|---|---|---|---|---|---|
| skeletal | 277 | 63 | 882 | 702,465 | 702,015 | 448,730 | 36.1 % | skeletal.glb: 2.05 MiB | la, en, fr, es, pt | 90.6 % | 0 |
| joints | 413 | 113 | 0 | 358,326 | 340,431 | 259,199 | 23.9 % | joints.glb: 1.67 MiB | la, en, fr, es, pt | 75.8 % | 0 |
| visceral | 119 | 37 | 133 | 715,043 | 439,119 | 326,419 | 25.7 % | visceral.glb: 1.40 MiB | la, en, fr, es, pt | 95.0 % | 4 |
| cardiovascular | 675 | 30 | 0 | 3,843,768 | 1,343,832 | 811,402 | 39.6 % | cardiovascular.glb: 3.81 MiB | la, en, fr, es, pt | 69.5 % | 4 |
| lymphoid | 163 | 45 | 11 | 128,353 | 127,682 | 106,120 | 16.9 % | lymphoid.glb: 586.5 KiB | la, en, fr, es, pt | 65.6 % | 0 |
| nervous | 582 | 92 | 36 | 2,408,368 | 1,528,394 | 853,509 | 44.2 % | nervous.glb: 3.99 MiB | la, en, fr, es, pt | 82.8 % | 4 |
| muscular | 683 | 105 | 0 | 2,324,365 | 2,275,395 | 2,059,543 | 9.5 % | muscular.glb: 9.56 MiB | la, en, fr, es, pt | 80.7 % | 0 |
| regions | 256 | 34 | 9 | 136,121 | 132,660 | 124,302 | 6.3 % | regions.glb: 895.6 KiB | la, en, fr, es, pt | 57.0 % | 0 |
| **total** | 3168 | 519 | 1071 | 10,616,809 | 6,889,528 | 4,989,224 | 27.6 % | 23.94 MiB | la, en, fr, es, pt | 76.8 % | 12 |

Startup download (manifest + search index + skeletal GLB, uncompressed by HTTP): **2.80 MiB** (budget 5 MB, met). Largest file: muscular.glb (9.56 MiB).

Timings (s): manifest 42.7, process skeletal 13.3, process joints 7.2, process visceral 8.1, process cardiovascular 25.4, process lymphoid 3.3, process nervous 37.7, process muscular 51.3, process regions 3.7.

## Simplification

meshoptimizer `simplify` with `ErrorAbsolute` + `LockBorder` (no pruning), error 0.05 mm (curves × 0.5), structures under 64 triangles untouched; a result is rejected when its bounding box moves by more than 2 × error. Quantization (scene volume per file): skeletal 16-bit, joints 16-bit, visceral 16-bit, cardiovascular 16-bit, lymphoid 16-bit, nervous 16-bit, muscular 16-bit, regions 16-bit positions; normals octahedral 8-bit (meshopt level `high`).

| system | simplified primitives | skipped (reason) |
|---|---|---|
| skeletal | 275 | none: 2 |
| joints | 247 | none: 48, small: 116, bbox: 2 |
| visceral | 114 | none: 5 |
| cardiovascular | 657 | none: 18 |
| lymphoid | 161 | none: 2 |
| nervous | 515 | none: 64, bbox: 1, small: 2 |
| muscular | 645 | none: 31, bbox: 4, small: 3 |
| regions | 172 | small: 34, none: 50 |

## TA2 mapping

| system | type | unique match | ambiguous | no match | Latin filled from TA2 |
|---|---|---|---|---|---|
| skeletal | structure | 277 | 0 | 0 | 0 |
| skeletal | group | 63 | 0 | 0 | 0 |
| skeletal | landmark | 882 | 0 | 0 | 4 |
| joints | structure | 411 | 0 | 2 | 0 |
| joints | group | 113 | 0 | 0 | 0 |
| visceral | structure | 119 | 0 | 0 | 0 |
| visceral | group | 37 | 0 | 0 | 0 |
| visceral | landmark | 133 | 0 | 0 | 0 |
| cardiovascular | structure | 644 | 0 | 31 | 0 |
| cardiovascular | group | 30 | 0 | 0 | 0 |
| lymphoid | structure | 161 | 0 | 2 | 0 |
| lymphoid | group | 44 | 0 | 1 | 0 |
| lymphoid | landmark | 11 | 0 | 0 | 0 |
| nervous | structure | 529 | 0 | 53 | 2 |
| nervous | group | 91 | 0 | 1 | 0 |
| nervous | landmark | 36 | 0 | 0 | 0 |
| muscular | structure | 667 | 0 | 16 | 6 |
| muscular | group | 105 | 0 | 0 | 0 |
| regions | structure | 256 | 0 | 0 | 0 |
| regions | group | 34 | 0 | 0 | 0 |
| regions | landmark | 9 | 0 | 0 | 0 |

## Sides

Applied side swaps (approved in `pipeline/config/overrides.json`):

- `Eyelashes.l` → right (`eyelashes-r`)
- `Eyelashes.r` → left (`eyelashes-l`)
- `Lateral temporomandibular ligament.l` → right (`lateral-temporomandibular-ligament-r`)
- `Lateral temporomandibular ligament.r` → left (`lateral-temporomandibular-ligament-l`)

Suffix sides that disagree with the geometry (vertex centroid beyond ±0.002 m), all processed systems: **53** — 15 pairs where both members are swapped, 23 single objects. Nothing is changed; proposed `sideSwaps` entries for the owner are in `data/inventory/side-review.json`.

| object | system | named | centroid x | parent | parent side |
|---|---|---|---|---|---|
| `Piriformis muscle.ol` | insertions | left | -0.0334 | Sacrum | – |
| `Piriformis muscle.or` | insertions | right | 0.0335 | Sacrum | – |
| `Procerus muscle.ol` | insertions | left | -0.0124 | Frontal bone | – |
| `Procerus muscle.or` | insertions | right | 0.0124 | Frontal bone | – |
| `Rectus anterior capitis muscle.el` | insertions | left | -0.0188 | Atlas (C1) | – |
| `Rectus anterior capitis muscle.er` | insertions | right | 0.0188 | Atlas (C1) | – |
| `Rectus anterior capitis muscle.ol` | insertions | left | -0.0065 | Occipital bone | – |
| `Rectus anterior capitis muscle.or` | insertions | right | 0.0065 | Occipital bone | – |
| `Rectus lateralis capitis muscle.ol` | insertions | left | -0.0368 | Occipital bone | – |
| `Rectus lateralis capitis muscle.or` | insertions | right | 0.0368 | Occipital bone | – |
| `Rectus posterior major capitis muscle.el` | insertions | left | -0.0023 | Axis (C2) | – |
| `Rectus posterior major capitis muscle.er` | insertions | right | 0.0024 | Axis (C2) | – |
| `Rectus posterior major capitis muscle.ol` | insertions | left | -0.0314 | Occipital bone | – |
| `Rectus posterior major capitis muscle.or` | insertions | right | 0.0314 | Occipital bone | – |
| `Rectus posterior minor capitis muscle.ol` | insertions | left | -0.0158 | Occipital bone | – |
| `Rectus posterior minor capitis muscle.or` | insertions | right | 0.0158 | Occipital bone | – |
| `Scalenus anterior muscle.e1l` | insertions | left | -0.0237 | Vertebra C5 | – |
| `Scalenus anterior muscle.e1r` | insertions | right | 0.0237 | Vertebra C5 | – |
| `Scalenus anterior muscle.e2l` | insertions | left | -0.0253 | Vertebra C6 | – |
| `Scalenus anterior muscle.e2r` | insertions | right | 0.0253 | Vertebra C6 | – |
| `Scalenus anterior muscle.el` | insertions | left | -0.0227 | Vertebra C4 | – |
| `Scalenus anterior muscle.er` | insertions | right | 0.0227 | Vertebra C4 | – |
| `Scalenus medius muscle.e1l` | insertions | left | -0.034 | Vertebra C7 | – |
| `Scalenus medius muscle.e1r` | insertions | right | 0.034 | Vertebra C7 | – |
| `Scalenus medius muscle.el` | insertions | left | -0.029 | Vertebra C6 | – |
| `Scalenus medius muscle.er` | insertions | right | 0.029 | Vertebra C6 | – |
| `Scalenus posterior muscle.el` | insertions | left | -0.0291 | Vertebra C5 | – |
| `Scalenus posterior muscle.er` | insertions | right | 0.0291 | Vertebra C5 | – |
| `Serratus anterior muscle.e2l` | insertions | left | -0.1107 | Third rib.r | right |
| `Serratus anterior muscle.e2r` | insertions | right | 0.1108 | Third rib.l | left |
| `Pectineus muscle.el` | insertions | left | -0.0958 | Femur.r | right |
| `Piriformis muscle.el` | insertions | left | -0.1252 | Femur.r | right |
| `Plantar interossei muscles.e1l` | insertions | left | -0.1153 | Proximal phalanx of fourth finger of foot.r | right |
| `Plantar interossei muscles.e2l` | insertions | left | -0.1285 | Proximal phalanx of fifth finger of foot.r | right |
| `Plantar interossei muscles.el` | insertions | left | -0.1028 | Proximal phalanx of third finger of foot.r | right |
| `Plantar interossei muscles.o1l` | insertions | left | -0.1055 | Fourth metatarsal bone.r | right |
| `Plantar interossei muscles.o2l` | insertions | left | -0.1123 | Fifth metatarsal bone.r | right |
| `Plantar interossei muscles.ol` | insertions | left | -0.0977 | Third metatarsal bone.r | right |
| `Pronator quadratus.el` | insertions | left | -0.2667 | Radius.r | right |
| `Pronator quadratus.ol` | insertions | left | -0.2384 | Ulna.r | right |
| `Serratus anterior muscle.e1l` | insertions | left | -0.0981 | Second rib.r | right |
| `Serratus anterior muscle.e8l` | insertions | left | -0.127 | Ninth rib.r | right |
| `Serratus posterior inferior muscle.e1l` | insertions | left | -0.0954 | Tenth rib.r | right |
| `Serratus posterior inferior muscle.e2l` | insertions | left | -0.0877 | Eleventh rib.r | right |
| `Serratus posterior inferior muscle.e3l` | insertions | left | -0.0717 | Twelfth rib.r | right |
| `Serratus posterior inferior muscle.el` | insertions | left | -0.1038 | Ninth rib.r | right |
| `Serratus posterior superior muscle.e1l` | insertions | left | -0.0839 | Third rib.r | right |
| `Serratus posterior superior muscle.e2l` | insertions | left | -0.093 | Fourth rib.r | right |
| `Serratus posterior superior muscle.e3l` | insertions | left | -0.0919 | Fifth rib.r | right |
| `Serratus posterior superior muscle.el` | insertions | left | -0.0717 | Second rib.r | right |
| `Short head of biceps brachii.ol` | insertions | left | -0.1408 | Scapula.r | right |
| `Short head of biceps femoris.el` | insertions | left | -0.0966 | Femur.r | right |
| `Vagus nerve (X).r` | nervous | right | 0.0194 | Cranial nerves.g | – |

### Open review item `Vagus nerve (X).r` (`vagus-nerve-x-r`)

- `vagus-nerve-x-l`: 1832 vertices, vertex centroid x = 0.0159 m, y 1.347–1.576 m; mean x per 5 cm height band (top → bottom): 1.55–1.6: 0.0119, 1.5–1.55: 0.0199, 1.45–1.5: 0.023, 1.4–1.45: 0.0168, 1.35–1.4: 0.0137, 1.3–1.35: 0.0058
- `vagus-nerve-x-r`: 5875 vertices, vertex centroid x = 0.0198 m, y 1.105–1.576 m; mean x per 5 cm height band (top → bottom): 1.55–1.6: -0.0119, 1.5–1.55: -0.0195, 1.45–1.5: -0.0232, 1.4–1.45: -0.0168, 1.35–1.4: -0.0136, 1.3–1.35: 0.0014, 1.25–1.3: 0.0182, 1.2–1.25: 0.0436, 1.15–1.2: 0.038, 1.1–1.15: 0.0381

## Systems held back (not published)

- **insertions**: 52 origin/insertion patches carry the wrong l/r letter upstream (15 pairs both swapped; 22 single patches whose geometry and parent bone are on the other side). Held until the owner decides on the proposed side swaps in data/inventory/side-review.json. Export and processing still run; publish with --systems insertions after approval.

## Data issues (for review)

### Id collisions (resolved deterministically) (1)

`central-canal` → Central canal [nervous] = `central-canal` / Central canal' [nervous] = `central-canal-nervous`

### Names without a Translations row (English only unless TA2 filled Latin) (62)

skeletal: Supra-acetabular groove, skeletal: Symphysial surface of pubis, joints: Frenula capsulae, cardiovascular: ?x, cardiovascular: Anterior temporal branch, cardiovascular: Artery of central sulcus, cardiovascular: Artery of precentral sulcus, cardiovascular: Branch to angular gyrus, cardiovascular: Distal lateral striate branches, cardiovascular: Inferior vein of left ventricle (//Posterior ''), cardiovascular: Insular branches of middle cerebral artery (M2-segment), cardiovascular: Lateral frontobasal artery, cardiovascular: Middle cerebral artery (M3 segment), cardiovascular: Middle genicular artery, cardiovascular: Posterior lateral nasal branches of sphenopalatine artery., cardiovascular: Posterior parietal artery, cardiovascular: Posterior temporal branch, cardiovascular: Prefrontal artery, cardiovascular: Proximal lateral striate branches, cardiovascular: Temporo-occipital branch, lymphoid: Node of arch of azygos vein, lymphoid: Node of ligamentum arteriosum, lymphoid: Superior deep lateral nodes, nervous: Posterior transverse collateral sulcus, nervous: Anterior occipital sulcus*, nervous: Central canal', nervous: Cingulate gyrus (Posteroventral part*), nervous: Cingulate gyrus and sulcus (Middle anterior part), nervous: Cingulate gyrus and sulcus (Middle posterior part), nervous: Cingulate gyrus and sulcus (Posterior dorsal part), nervous: Cingulate sulcus (Marginal part*), nervous: Inferior occipital gyrus and sulcus*, nervous: Insula (Subcentral gyrus and ant. and post. sulci*), nervous: Lat_Fis-ant-Horizont, nervous: Lat_Fis-ant-Vertical, nervous: Lat_Fis-post, nervous: Lateral occipital gyrus (Middle occipital gyrus*), nervous: Lunate sulcus, nervous: Medial occipitotemporal gyrus (Parahippocampal*), nervous: Occipitotemporal sulcus (Lateral part*), nervous: Orbital gyri (Frontomarginal gyrus and sulcus*), nervous: Orbital part of  inferior frontal gyrus, nervous: Orbital sulci (H-shaped orbital sulci*), nervous: Orbital sulci (Lateral Orbital sulcus*), nervous: Paracentral gyrus and sulcus*, nervous: Precentral sulcus (Superior part)*, nervous: Precentral sulcus (inferior part)*, nervous: Straight gyrus (Gyrus rectus), nervous: Sulcus interm_prim-Jensen, nervous: Superior temporal gyrus (Lateral part), nervous: Transverse frontopolar gyrus and sulcus*, muscular: Coracobrachial bursa, muscular: Cruciform part of fibrous sheath of digit of hand, muscular: Subcutaneous acromial bursa, muscular: Subfacial prepatellar bursa, muscular: Tendon sheath - abd. pollicis longus - ext. pollicis brevis, muscular: Tendon sheath of extensor digiti minimi manus, muscular: Tendon sheath of extensor digitorum and extensor indicis, muscular: Tendon sheath of extensor pollicis longus, muscular: Tendon sheath of extensors carpi radialis, muscular: Tendon sheath of tibialis anterior, muscular: Trochanteric bursa of gluteus medius muscle

### Structures dropped (no geometry after export) (0)

_none_

### References to unpublished nodes (0)

_none_

### Labels without a leader-line anchor (6)

`Ala of nose.t`, `Caudate lobe.t`, `Corneal vertex.t`, `Fornix of stomach.t`, `Pyloric canal.t`, `Sternum.t`

### Labels not attached to a structure (parent is a group/none) (14)

Anterior interventricular sulcus.t (parent Heart.g), Anterior surface of heart.t (parent Heart.g), Apex of heart.t (parent Heart.g), Base of heart.t (parent Heart.g), Coronary sulcus.t (parent Heart.g), Inferior border of heart.t (parent Heart.g), Inferior interventricular sulcus.t (parent Heart.g), Inferior surface of heart.t (parent Heart.g), Interatrial septum.t (parent Heart.g), Left surface of heart.t (parent Heart.g), Notch of cardiac apex.t (parent Heart.g), Optic axis.t (parent External axis of eyeball), Right border of heart.t (parent Heart.g), Right surface of heart.t (parent Heart.g)

### Redundant labels (structure already has a label) (0)

_none_

### Insertion patches without a matching muscle (78)

`Adductor pollicis.e1l`, `Adductor pollicis.e1r`, `Adductor pollicis.el`, `Adductor pollicis.er`, `Articularis genus muscle.ol`, `Articularis genus muscle.or`, `Biceps brachii muscle.el`, `Biceps brachii muscle.er`, `Biceps femoris muscle.el`, `Biceps femoris muscle.er`, `Common extensor tendon.ol`, `Common extensor tendon.or`, `Common flexor tendon.ol`, `Common flexor tendon.or`, `Deltoid muscle.el`, `Deltoid muscle.er`, `Erector spinae.ol`, `Erector spinae.or`, `Extensor carpi ulnaris.el`, `Extensor carpi ulnaris.er`, `Extensor carpi ulnaris.ol`, `Extensor carpi ulnaris.or`, `Flexor carpi ulnaris.el`, `Flexor carpi ulnaris.er`, `Flexor digitorum superficialis.e1l`, `Flexor digitorum superficialis.e1r`, `Flexor digitorum superficialis.e2l`, `Flexor digitorum superficialis.e2r`, `Flexor digitorum superficialis.e3l`, `Flexor digitorum superficialis.e3r`, `Flexor digitorum superficialis.el`, `Flexor digitorum superficialis.er`, `Flexor digitorum superficialis.ol`, `Flexor digitorum superficialis.or`, `Iliopsoas muscle.el`, `Iliopsoas muscle.er`, `Lateral pterygoid muscle.o1l`, `Lateral pterygoid muscle.o1r`, `Lateral pterygoid muscle.ol`, `Lateral pterygoid muscle.or`, `Levator ani.ol`, `Levator ani.or`, `Long plantar ligament.o1l`, `Long plantar ligament.o1r`, `Long plantar ligament.o2l`, `Long plantar ligament.o2r`, `Long plantar ligament.o3l`, `Long plantar ligament.o3r`, `Long plantar ligament.o4l`, `Long plantar ligament.o4r`, `Long plantar ligament.ol`, `Long plantar ligament.or`, `Masseter.el`, `Masseter.er`, `Masseter.o1l`, `Masseter.o1r`, `Masseter.ol`, `Masseter.or`, `Patellar ligament.el`, `Patellar ligament.er`, … (+18, full list in pipeline-report.json)

### Insertion patches without a bone parent (0)

_none_

### Definitions with a non-Wikipedia or missing source (licence CC-BY-SA-4.0 assumed) (733)

(Anteromedial basal segmental bronchus of left lung) (Z-Anatomy), (Retropyloric nodes) (Z-Anatomy), (Subpyloric nodes) (Z-Anatomy), (Suprapyloric node) (Z-Anatomy), Anal region (Z-Anatomy), Angle of mouth (Z-Anatomy), Anterior basal segmental bronchus of left lung (BVIII) (Z-Anatomy), Anterior basal segmental bronchus of right lung (BVIII) (Z-Anatomy), Anterior circumflex humeral vein (Z-Anatomy), Anterior division of inferior trunk of brachial plexus (Z-Anatomy), Anterior division of mandibular nerve (Z-Anatomy), Anterior division of middle trunk of brachial plexus (Z-Anatomy), Anterior division of retromandibular vein (Z-Anatomy), Anterior division of superior trunk of brachial plexus (Z-Anatomy), Anterior intercavernous sinus (Z-Anatomy), Anterior lateral segment of liver (VI) (Z-Anatomy), Anterior ligament of fibular head (Z-Anatomy), Anterior medial segment of liver (V) (Z-Anatomy), Anterior notch of auricle (Z-Anatomy), Anterior root of spinal nerve (Z-Anatomy), Anterior sacro-iliac ligament (Z-Anatomy), Anterior segmental bronchus of left lung (BIII) (Z-Anatomy), Anterior segmental bronchus of right lung (BIII) (Z-Anatomy), Antihelix (Z-Anatomy), Antitragus (Z-Anatomy), Apical axillary nodes (ta2viewer.openanatomy.org, https://ta2viewer.openanatomy.org/?id=5202), Apical segmental bronchus of right lung (BI) (Z-Anatomy), Apicoposterior segmental bronchus of left lung (BI+BII) (Z-Anatomy), Appendicular nodes (Z-Anatomy), Articular disc of acromioclavicular joint (Z-Anatomy), Ary-epiglottic part of oblique arytenoid muscle (Z-Anatomy), Auricular region (Z-Anatomy), Bifurcation of pulmonary trunk (Z-Anatomy), Body of sternum (Z-Anatomy), Brachiocephalic nodes (Z-Anatomy), Buccal region (Z-Anatomy), Calcaneonavicular ligament (Z-Anatomy), Cavity of concha (Z-Anatomy), Central superior mesenteric nodes (Z-Anatomy), Circumflex scapular vein (Z-Anatomy), … (+693, full list in pipeline-report.json)

### Definition texts not attached to any node (1372)

(Accessory pancreas), (Anterior atlanto-occipital ligament), (Ceratocricoid muscle), (Cyamella), (Hyaloid artery), (Incisive duct), (Interparietal bone), (Os centrale), (Premaxilla), (Suprasternal bones), [Caroticoclinoid process], [Craniopharyngeal canal], [Foramen petrosum], [Paramastoid process], [Supracondylar process], [Third trochanter], Abdomen [region], Abdominal aortic plexus, Abdominal fascia, Abdominal wall, Abduction, Abductor digiti minimi muscle of hand, Accessory bone, Accessory bone (Supernumerary bone), Accessory bones of thorax, Accessory breast, Accessory carpal bones, Adduction, Aditus to mastoid antrum, Agger nasi, Ala of nose, Allocortex, Alveolar canals, Alveolar process, Ampulla of vas deferens, Anal canal, Anal columns, Anal sinuses, Anal triangle, Anal valves, Angle of mandible, Angle of the mandible, Angles of parietal bone, Ankle, Anocutaneous line, Anorectal varices, Ansa cervicalis, Ansa lenticularis, Anterior axillary line, Anterior cecal artery, Anterior choroidal artery, Anterior ciliary arteries, Anterior cranial fossa, Anterior ethmoidal nerve, Anterior fontanelle, Anterior gastric branches of anterior vagal trunk, Anterior humeral circumflex artery, Anterior hypothalamic nucleus, Anterior intercostal veins, Anterior interventricular sulcus, … (+1312, full list in pipeline-report.json)

### Definition key conflicts (0)

_none_

### Colour fallbacks (system colour used) (7)

skeletal: Anterior cells of ethmoid bone.l, skeletal: Anterior cells of ethmoid bone.r, skeletal: Middle cells of ethmoid bone.l, skeletal: Middle cells of ethmoid bone.r, skeletal: Posterior cells of ethmoid bone.l, skeletal: Posterior cells of ethmoid bone.r, visceral: Mucosa of stomach

Colour method per system: skeletal {"none":6,"node":67,"node-any-bsdf":204}; joints {"node":413}; visceral {"node":72,"node-any-bsdf":46,"none":1}; cardiovascular {"node":667,"node-any-bsdf":8}; lymphoid {"node-any-bsdf":161,"node":2}; nervous {"node":282,"node-any-bsdf":300}; muscular {"node-any-bsdf":426,"node":257}; regions {"node":256}

### Objects without a usable name (not published) (1)

`????????` [cardiovascular] (parent Coronary sinus)

### Text objects with an unknown suffix (skipped) (1)

`Grey matter of medulla oblongata.`

### Translation rows with conflicting duplicates (first row used) (0)

_none_

<!-- validation -->

## Validation

_`node pipeline/validate.mjs` at 2026-10-29T05:52:38.605Z — systems: skeletal, joints, visceral, cardiovascular, lymphoid, nervous, muscular, regions — **passed** (0 errors, 22 warnings)._

| orientation / side check | result | detail |
|---|---|---|
| Liver centroid on the patient's right (x < 0) [liver] | ok | x = -0.0227 |
| Stomach centroid on the patient's left (x > 0) [stomach] | ok | x = 0.0435 |
| Spleen centroid on the patient's left (x > 0) [spleen] | ok | x = 0.0863 |
| Left ventricle centroid on the patient's left (x > 0) [left-ventricle] | ok | x = 0.0471 |
| head above feet (frontal bone y > calcaneus y + 1 m) | ok | frontal y = 1.634, calcaneus y = 0.044 |
| face towards +Z (nasal bone z > occipital bone z) | ok | nasal z = 0.089, occipital z = -0.053 |
| feet near y = 0 (calcaneus bbox min y < 0.05) | ok | min y = 0.0118 |
| side of 2846 sided structures (vertex centroid, tolerance 0.002 m; strict for .l/.r suffixes) | ok | 0 failures; 12 reported as warnings (left-medial-segment-of-liver-iv, anterior-papillary-muscle-of-right-ventricle, inferior-papillary-muscle-of-right-ventricle, right-coronary-artery, right-coronary-leaflet, right-inferolateral-branch-of-right-coronary-artery, right-semilunar-leaflet-of-pulmonary-valve, right-ventricle, septal-leaflet-of-right-atrioventricular-valve, septal-papillary-muscle-of-right-ventricle, right-lobe-of-thymus, vagus-nerve-x-r) |
| left/right pairs mirror (|x_l + x_r| ≤ 0.01 m; review items excluded) | ok | worst posterior-intercostal-arteries-l/posterior-intercostal-arteries-r: 0.0099 m |
| triangle winding agrees with normals (≥ 50 % of surface per structure) | ok | min 95.0 %, mean 100.0 %, 0 below 80 % |

| system | structures | triangles | bytes |
|---|---|---|---|
| skeletal | 277 | 448,730 | 2.05 MiB |
| joints | 413 | 259,199 | 1.67 MiB |
| visceral | 119 | 326,419 | 1.40 MiB |
| cardiovascular | 675 | 811,402 | 3.81 MiB |
| lymphoid | 163 | 106,120 | 586.5 KiB |
| nervous | 582 | 853,509 | 3.99 MiB |
| muscular | 683 | 2,059,543 | 9.56 MiB |
| regions | 256 | 124,302 | 895.6 KiB |

Startup download (manifest + search index + skeletal): 2.80 MiB (budget 5 MB: met); public/models total 34.93 MiB in 26 files.

- skeletal.glb: 277 nodes, 448,730 triangles, 2.05 MiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- joints.glb: 413 nodes, 259,199 triangles, 1.67 MiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- visceral.glb: 119 nodes, 326,419 triangles, 1.40 MiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- cardiovascular.glb: 675 nodes, 811,402 triangles, 3.81 MiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- lymphoid.glb: 163 nodes, 106,120 triangles, 586.5 KiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- nervous.glb: 582 nodes, 853,509 triangles, 3.99 MiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- muscular.glb: 683 nodes, 2,059,543 triangles, 9.56 MiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- regions.glb: 256 nodes, 124,302 triangles, 895.6 KiB, layout NORMAL:VEC3:5120:n,POSITION:VEC3:5122:n|mode=4|indexed=1
- open review item vagus-nerve-x-l: vertex centroid x = 0.0161 (patient's left)
- open review item vagus-nerve-x-r: vertex centroid x = 0.0194 (patient's left)

### Warnings

- pair kidney-l / kidney-r: |x_l + x_r| = 0.0047 m
- pair renal-pelvis-l / renal-pelvis-r: |x_l + x_r| = 0.0058 m
- pair suprarenal-gland-l / suprarenal-gland-r: |x_l + x_r| = 0.0059 m
- pair common-iliac-artery-l / common-iliac-artery-r: |x_l + x_r| = 0.0045 m
- pair common-iliac-vein-l / common-iliac-vein-r: |x_l + x_r| = 0.0094 m
- pair first-posterior-intercostal-artery-l / first-posterior-intercostal-artery-r: |x_l + x_r| = 0.0034 m
- pair lumbar-arteries-l / lumbar-arteries-r: |x_l + x_r| = 0.0050 m
- pair posterior-branch-of-renal-artery-l / posterior-branch-of-renal-artery-r: |x_l + x_r| = 0.0074 m
- pair posterior-intercostal-arteries-l / posterior-intercostal-arteries-r: |x_l + x_r| = 0.0099 m
- REVIEW pair vagus-nerve-x-l / vagus-nerve-x-r: |x_l + x_r| = 0.0355 m (open review item)
- side: left-medial-segment-of-liver-iv is 'left' but its vertex centroid is at x = -0.0192 — side from the name (organ-internal designation)
- side: anterior-papillary-muscle-of-right-ventricle is 'right' but its vertex centroid is at x = 0.0301 — side from the name (organ-internal designation)
- side: inferior-papillary-muscle-of-right-ventricle is 'right' but its vertex centroid is at x = 0.0218 — side from the name (organ-internal designation)
- side: right-coronary-artery is 'right' but its vertex centroid is at x = 0.0139 — side from the name (organ-internal designation)
- side: right-coronary-leaflet is 'right' but its vertex centroid is at x = 0.0135 — side from the name (organ-internal designation)
- side: right-inferolateral-branch-of-right-coronary-artery is 'right' but its vertex centroid is at x = 0.0554 — side from the name (organ-internal designation)
- side: right-semilunar-leaflet-of-pulmonary-valve is 'right' but its vertex centroid is at x = 0.0184 — side from the name (organ-internal designation)
- side: right-ventricle is 'right' but its vertex centroid is at x = 0.0205 — side from the name (organ-internal designation)
- side: septal-leaflet-of-right-atrioventricular-valve is 'right' but its vertex centroid is at x = 0.0068 — side from the name (organ-internal designation)
- side: septal-papillary-muscle-of-right-ventricle is 'right' but its vertex centroid is at x = 0.0222 — side from the name (organ-internal designation)
- side: right-lobe-of-thymus is 'right' but its vertex centroid is at x = 0.0042 — side from the name (organ-internal designation)
- side: vagus-nerve-x-r is 'right' but its vertex centroid is at x = 0.0194 — open review item (overrides.json)


