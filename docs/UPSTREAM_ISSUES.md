# Issues to report to Z-Anatomy

Data problems found while building the Open Anatomy Atlas from `Startup.blend` of
[Z-Anatomy/Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy). Each section can be filed
as its own issue there. Object names are the names in the Blender file.

**Measurements.** Positions are vertex centroids of the evaluated geometry, in metres. x > 0 is the patient's left,
y is the height above the soles, and z > 0 is anterior. All 1 350 `.l`/`.r` pairs were checked this way; 99.85 % of
`.l` objects lie at x > 0. The atlas corrects an upstream side only after a human review (`pipeline/config/overrides.json`),
so every item below is either corrected here with a recorded reason, or shown as named with a warning.

---

## 1. Right vagus nerve: thoracic and abdominal part on the patient's left

**Object:** `Vagus nerve (X).r` (left counterpart: `Vagus nerve (X).l`)

| height band | `Vagus nerve (X).r`, mean x | `Vagus nerve (X).l`, mean x |
|---|---|---|
| neck, y 1.40–1.55 m | −0.020 (right) | +0.021 |
| upper thorax, y 1.30–1.40 m | −0.009 (right) | +0.013 |
| lower thorax, y 1.15–1.30 m | **+0.039** (2 504 vertices, left) | — (ends at about 1.30 m) |
| abdomen, y < 1.15 m | **+0.038**, z +0.026 (anterior) | — |

- In the neck the right nerve runs on the right of the trachea, which is correct.
- Below the aortic arch the object follows the course of the left vagus and the anterior vagal trunk: left of the
  oesophagus, then onto the anterior surface of the stomach. The left vagus object ends in the upper thorax.
- Overall, 64 % of the vertices of `Vagus nerve (X).r` lie below 1.30 m on the patient's left.
- This looks like the thoracic part of the left vagus (or the anterior vagal trunk) being joined to the right nerve.
- **In the atlas:** published as named, by owner decision, with a validator warning.

## 2. 52 muscle origin/insertion patches with the wrong side letter

Patches whose `l`/`r` letter is opposite to their position. In each case the parent bone of the patch confirms the
geometry, not the letter. **In the atlas:** corrected after review (`sideSwaps` in `pipeline/config/overrides.json`).

**Both members of a pair swapped (15 pairs, mostly on midline bones).** Centroid x of the `l` object is given; the
`r` object mirrors it.

| objects | x of the `l` object | parent bone (of `l` / `r`) |
|---|---|---|
| `Piriformis muscle.ol` / `.or` | −0.033 | Sacrum |
| `Procerus muscle.ol` / `.or` | −0.012 | Frontal bone |
| `Rectus anterior capitis muscle.el` / `.er` | −0.019 | Atlas (C1) |
| `Rectus anterior capitis muscle.ol` / `.or` | −0.007 | Occipital bone |
| `Rectus lateralis capitis muscle.ol` / `.or` | −0.037 | Occipital bone |
| `Rectus posterior major capitis muscle.el` / `.er` | −0.002 | Axis (C2) |
| `Rectus posterior major capitis muscle.ol` / `.or` | −0.031 | Occipital bone |
| `Rectus posterior minor capitis muscle.ol` / `.or` | −0.016 | Occipital bone |
| `Scalenus anterior muscle.el` / `.er` | −0.023 | Vertebra C4 |
| `Scalenus anterior muscle.e1l` / `.e1r` | −0.024 | Vertebra C5 |
| `Scalenus anterior muscle.e2l` / `.e2r` | −0.025 | Vertebra C6 |
| `Scalenus medius muscle.el` / `.er` | −0.029 | Vertebra C6 |
| `Scalenus medius muscle.e1l` / `.e1r` | −0.034 | Vertebra C7 |
| `Scalenus posterior muscle.el` / `.er` | −0.029 | Vertebra C5 |
| `Serratus anterior muscle.e2l` / `.e2r` | −0.111 | `Third rib.r` / `Third rib.l` |

**Single patches named left that lie on the right (22).** Each sits on a right-side bone and has no counterpart.

| object | x | parent bone |
|---|---|---|
| `Pectineus muscle.el` | −0.096 | Femur.r |
| `Piriformis muscle.el` | −0.125 | Femur.r |
| `Plantar interossei muscles.el` | −0.103 | Proximal phalanx of third finger of foot.r |
| `Plantar interossei muscles.e1l` | −0.115 | Proximal phalanx of fourth finger of foot.r |
| `Plantar interossei muscles.e2l` | −0.129 | Proximal phalanx of fifth finger of foot.r |
| `Plantar interossei muscles.ol` | −0.098 | Third metatarsal bone.r |
| `Plantar interossei muscles.o1l` | −0.106 | Fourth metatarsal bone.r |
| `Plantar interossei muscles.o2l` | −0.112 | Fifth metatarsal bone.r |
| `Pronator quadratus.el` | −0.267 | Radius.r |
| `Pronator quadratus.ol` | −0.238 | Ulna.r |
| `Serratus anterior muscle.e1l` | −0.098 | Second rib.r |
| `Serratus anterior muscle.e8l` | −0.127 | Ninth rib.r |
| `Serratus posterior inferior muscle.el` | −0.104 | Ninth rib.r |
| `Serratus posterior inferior muscle.e1l` | −0.095 | Tenth rib.r |
| `Serratus posterior inferior muscle.e2l` | −0.088 | Eleventh rib.r |
| `Serratus posterior inferior muscle.e3l` | −0.072 | Twelfth rib.r |
| `Serratus posterior superior muscle.el` | −0.072 | Second rib.r |
| `Serratus posterior superior muscle.e1l` | −0.084 | Third rib.r |
| `Serratus posterior superior muscle.e2l` | −0.093 | Fourth rib.r |
| `Serratus posterior superior muscle.e3l` | −0.092 | Fifth rib.r |
| `Short head of biceps brachii.ol` | −0.141 | Scapula.r |
| `Short head of biceps femoris.el` | −0.097 | Femur.r |

## 3. Eyelashes: `.l` and `.r` swapped

`Eyelashes.l` lies at x = −0.032 (patient's right) and `Eyelashes.r` at +0.032. **In the atlas:** corrected after
review.

## 4. Lateral temporomandibular ligament: `.l` and `.r` swapped

`Lateral temporomandibular ligament.l` lies at x = −0.053 (patient's right) and `.r` at +0.053. **In the atlas:**
corrected after review.

## 5. Objects without a usable name

- **`????????`**: a curve object in the cardiovascular collection, child of `Coronary sinus`. **In the atlas:** not
  published, because it has no name.
- **`?x.l` / `?x.r`**: cardiovascular, children of `Artery of pterygoid canal` (x ±0.003). They have no translation
  row. **In the atlas:** published with the placeholder name.

## 6. Near-duplicate object: `Central canal` and `Central canal'`

The nervous system has both `Central canal` and `Central canal'` (trailing apostrophe) at the midline. Only the first
has a translation row (Latin *Canalis centralis*). **In the atlas:** both are published, as `central-canal` and
`central-canal-nervous`.

## 7. Spelling errors in Latin names (`Translations` table)

| English name | Latin upstream | should be | evidence in the same file |
|---|---|---|---|
| First metacarpal bone | Os primum **metarcapi** | Os primum metacarpi | "Os quintum metacarpi" etc. |
| Lamina of thyroid cartilage | Lamina cartilaginis **thryeoideae** | Lamina cartilaginis thyreoideae | "Cornu superius cartilaginis thyreoideae" |
| Articular capsules of metacarpophalangeal joints | Capsulae articulariae articulationes **metacarpophalnageae** | … metacarpophalangeae | "Articulationes metacarpophalangeae" |
| Inferior thyroid artery | Arteria thyreoidea inferior **arteria thyroidea inferior** | one of the two spellings (the second looks like a pasted synonym) | — |

- **In the atlas:** the first three are corrected after review (`nameFixes` in `pipeline/config/overrides.json`). The
  fourth is shown as it is upstream.
- Only letter swaps were searched for systematically, so there may be more errors.

## 8. Missing side suffix on off-midline objects (6) and inconsistent pair names

These objects have no `.l`/`.r` suffix, although they lie off the midline and their mirror counterpart exists with
a suffix:

| object | x |
|---|---|
| `Cochlear nerve` | −0.030 (right) |
| `Ulnopisiform ligament` | −0.242 (right) |
| `Descending branch of lateral circumflex femoral artery` | −0.102 (right) |
| `Common plantar digital branches of medial plantar nerve` | −0.079 (right) |
| `Iliocostalis colli muscle` | +0.050 (left) |
| `Intra-articular ligament of head of rib` | +0.017 (left) |

The two members of one pair are named differently, and only the M2 object has a Latin translation:

- `Insular branches of middle cerebral artery (M2)`
- `Insular branches of middle cerebral artery (M2-segment)`

**In the atlas:** these structures are shown without a side.

## 9. Structures in no body-region collection

About 140 published structures are in none of the region collections (`Head`, `Neck`, `Trunk`, `Thorax`,
`Abdomen`, …), for example `Thyroid gland`. Region filters and region-scoped quizzes therefore miss them. This may
be intended upstream. It is listed here as a question, not a defect.
