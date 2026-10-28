# Z-Anatomy inventory

_Generated 2026-10-28T22:58:04Z by `pipeline/blender/inventory.py` with Blender 4.5.0._

File: `Startup.blend` (306.8 MB)

Units: METRIC, scale_length=1.0, length unit CENTIMETERS

## Summary

- **Objects:** 7184 (MESH 4569, CURVE 951, FONT 1660, LIGHT 3, CAMERA 1)
- **Orientation (source):** up = +Z, patient's left = +X, anterior = -Y; skeleton height 1.6963 (Blender units, metres)
- **Orientation checks:** liver OK (x=-0.0109), spleen OK (x=0.0848), stomach OK (x=0.0383), leftVentricle OK (x=0.0424)
- **Wrong-side `.l`/`.r` outliers:** 5 → Eyelashes.l (x=-0.0322), Eyelashes.r (x=0.0322), Lateral temporomandibular ligament.l (x=-0.0532), Lateral temporomandibular ligament.r (x=0.0532), Vagus nerve (X).r (x=0.0204)
- **Name languages (Translations text):** English, Latin, Français, Español, Portugues; German present: False; 2152/2365 structure names have a row
- **Definitions:** 3839 text datablocks, 2910 end with a source URL; by target: {'structure:url': 1309, 'unmatched:url': 1134, 'structure:noUrl': 449, 'label:noUrl': 334, 'unmatched:noUrl': 146, 'label:url': 467}
- **Labels:** 1660 FONT objects, 1228 with a leader line, 717 name a structure with geometry (the rest are landmarks or group headings)
- **IDs in custom properties (FMA/TA):** none found (see §Custom properties)
- **NC candidates (keyword match):** innerEar (CC BY-NC-SA 4.0, Univ. of Dundee): 4; kidney (CC BY-NC 4.0, Lissie Cowley): 8

| system collection | geometry objects (mesh w/ faces + curves) | labels (FONT) | eval. triangles | unique names | with definition |
|---|---|---|---|---|---|
| 1: Skeletal system | 278 | 974 | 702,465 | 160 | 147 |
| 2: Muscular insertions | 705 | 0 | 931,484 | 298 | 154 |
| 3: Joints | 410 | 113 | 358,326 | 235 | 174 |
| 4: Muscular system | 670 | 105 | 2,324,365 | 338 | 279 |
| 5: Cardiovascular system | 676 | 43 | 3,843,768 | 418 | 272 |
| 6: Lymphoid organs | 159 | 56 | 128,353 | 107 | 77 |
| 7: Nervous system & Sense organs | 583 | 133 | 2,408,368 | 318 | 265 |
| 8: Visceral systems | 120 | 181 | 715,043 | 102 | 96 |
| 9: Regions of human body | 257 | 44 | 136,121 | 130 | 74 |
| Reference lines, reference planes, movements | 51 | 2 | 9,752 | 43 | 42 |
| Cross section planes | 0 | 0 | 0 | 0 | 0 |
| Bonus collection | 3110 | 1232 | 10,326,470 | 1778 | 1367 |

## Object types

| type | count |
|---|---|
| MESH | 4569 |
| FONT | 1660 |
| CURVE | 951 |
| LIGHT | 3 |
| CAMERA | 1 |

## Top-level collections (systems)

| collection | English prop | objects | MESH (faces) | MESH (edge-only) | CURVE | FONT | mesh tris | eval tris | curve tris | unique names | with definition |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1: Skeletal system | 1:Skeletal system | 2218 | 278 | 966 | 0 | 974 | 598,979 | 702,465 | 0 | 160 | 147 |
| 2: Muscular insertions | 2:Muscular insertions | 705 | 705 | 0 | 0 | 0 | 63,843 | 931,484 | 0 | 298 | 154 |
| 3: Joints | 3:Joints | 593 | 410 | 70 | 0 | 113 | 160,201 | 358,326 | 0 | 235 | 174 |
| 4: Muscular system | 4:Muscular system | 894 | 670 | 119 | 0 | 105 | 2,138,247 | 2,324,365 | 0 | 338 | 279 |
| 5: Cardiovascular system | 5:Cardiovascular system | 757 | 22 | 38 | 654 | 43 | 67,840 | 3,843,768 | 3,654,432 | 418 | 272 |
| 6: Lymphoid organs |  | 276 | 159 | 61 | 0 | 56 | 127,009 | 128,353 | 0 | 107 | 77 |
| 7: Nervous system & Sense organs | 6:Nervous system & Sense organs | 842 | 334 | 126 | 249 | 133 | 788,098 | 2,408,368 | 1,148,092 | 318 | 265 |
| 8: Visceral systems | 7:Visceral systems | 479 | 76 | 178 | 44 | 181 | 83,918 | 715,043 | 221,184 | 102 | 96 |
| 9: Regions of human body | 8:Regions of human body | 343 | 257 | 42 | 0 | 44 | 66,881 | 136,121 | 0 | 130 | 74 |
| Reference lines, reference planes, movements | 9:Reference lines, planes & movements | 54 | 51 | 1 | 0 | 2 | 3,936 | 9,752 | 0 | 43 | 42 |
| Cross section planes |  | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Bonus collection | Bonus collection | 5559 | 2159 | 1214 | 951 | 1232 | 3,991,563 | 10,326,470 | 5,023,708 | 1778 | 1367 |

Layer state / suffixes per system:

- **1: Skeletal system** layer={'exclude': False, 'hideViewport': False} hidden objects=1941 suffixes={'.j': 622, '.t': 568, '.i': 344, '.s': 343, '.r': 118, '.l': 118, '.g': 64, '': 41} curves without geometry=0
- **2: Muscular insertions** layer={'exclude': False, 'hideViewport': True} hidden objects=0 suffixes={'': 250, '.ol': 136, '.or': 133, '.el': 97, '.er': 89} curves without geometry=0
- **3: Joints** layer={'exclude': False, 'hideViewport': True} hidden objects=180 suffixes={'.r': 176, '.l': 176, '.g': 114, '.j': 66, '': 61} curves without geometry=0
- **4: Muscular system** layer={'exclude': False, 'hideViewport': True} hidden objects=211 suffixes={'.r': 339, '.l': 338, '.g': 106, '.j': 105, '': 6} curves without geometry=0
- **5: Cardiovascular system** layer={'exclude': False, 'hideViewport': True} hidden objects=81 suffixes={'.l': 258, '.r': 258, '': 160, '.j': 38, '.g': 30, '.t': 13} curves without geometry=0
- **6: Lymphoid organs** layer={'exclude': False, 'hideViewport': True} hidden objects=113 suffixes={'.j': 56, '': 55, '.r': 54, '.l': 54, '.g': 46, '.t': 11} curves without geometry=0
- **7: Nervous system & Sense organs** layer={'exclude': False, 'hideViewport': True} hidden objects=253 suffixes={'.r': 267, '.l': 266, '.j': 120, '.g': 93, '': 56, '.t': 40} curves without geometry=2
- **8: Visceral systems** layer={'exclude': False, 'hideViewport': True} hidden objects=75 suffixes={'.j': 178, '.t': 144, '': 83, '.g': 38, '.r': 19, '.l': 17} curves without geometry=0
- **9: Regions of human body** layer={'exclude': False, 'hideViewport': True} hidden objects=87 suffixes={'.r': 127, '.l': 127, '.j': 42, '.g': 35, '.t': 10, '': 2} curves without geometry=0
- **Reference lines, reference planes, movements** layer={'exclude': False, 'hideViewport': True} hidden objects=7 suffixes={'': 31, '.r': 8, '.l': 8, '.g': 6, '.j': 1} curves without geometry=0
- **Cross section planes** layer={'exclude': False, 'hideViewport': True} hidden objects=0 suffixes={'': 3} curves without geometry=0
- **Bonus collection** layer={'exclude': True, 'hideViewport': True} hidden objects=2422 suffixes={'.r': 1345, '.l': 1340, '.j': 845, '.t': 564, '': 453, '.i': 344, '.s': 343, '.g': 316, '.st': 9} curves without geometry=6

## Collection hierarchy (depth ≤ 4)

```
Scene Collection  (all=7183; own MESH:2, FONT:9, CAMERA:1, LIGHT:3; tris=4,099,309)
  1: Skeletal system  (all=2218; own MESH:1244, FONT:974; tris=598,979)
  2: Muscular insertions  (all=705; own MESH:705; tris=63,843)
  3: Joints  (all=593; own MESH:480, FONT:113; tris=160,201)
  4: Muscular system  (all=894; own MESH:789, FONT:105; tris=2,138,247)
  5: Cardiovascular system  (all=757; own FONT:43, MESH:60, CURVE:654; tris=67,840)
  6: Lymphoid organs  (all=276; own MESH:220, FONT:56; tris=127,009)
  7: Nervous system & Sense organs  (all=842; own MESH:460, FONT:133, CURVE:249; tris=788,098)
  8: Visceral systems  (all=479; own MESH:254, CURVE:44, FONT:181; tris=83,918)
  9: Regions of human body  (all=343; own MESH:299, FONT:44; tris=66,881)
  Reference lines, reference planes, movements  (all=54; own MESH:52, FONT:2; tris=3,936)
  Cross section planes  (all=3; own MESH:3; tris=0)
  Bonus collection  (all=5559; own MESH:918, FONT:686; tris=3,991,563)
    Skeletal system  (all=1293; tris=670,408)
      Axial skeleton  (all=294; own FONT:78, MESH:216; tris=455,293)
      Appendicular skeleton  (all=134; own MESH:129, FONT:5; tris=142,212)
        Skeleton of upper limbs  (all=0; tris=0)
        Skeleton of lower limbs  (all=0; tris=0)
      Cranium  (all=268; own MESH:48; tris=136,032)
        Fontanelles  (all=0; tris=0)
        Calvaria  (all=0; tris=0)
        Cranial base  (all=0; tris=0)
        Orbit  (all=0; tris=0)
        Nasal cavity of cranium  (all=0; tris=0)
        Bones of cranium  (all=236; tris=32,696)
      Extracranial bones of head  (all=53; own MESH:2, FONT:1; tris=43,934)
        Mandible  (all=45; own FONT:15, MESH:30; tris=42,610)
        Hyoid bone  (all=6; own FONT:3, MESH:3; tris=0)
      Auditory ossicles  (all=71; own MESH:6, FONT:1; tris=21,712)
        Malleus  (all=24; own FONT:12, MESH:12; tris=0)
        Incus  (all=20; own FONT:10, MESH:10; tris=0)
        Stapes  (all=20; own FONT:10, MESH:10; tris=0)
      Teeth  (all=70; own MESH:28, FONT:3; tris=46,872)
        Anterior teeth  (all=12; own MESH:12; tris=15,184)
        Posterior teeth  (all=55; own FONT:19, MESH:36; tris=31,688)
        Tooth  (all=0; tris=0)
        Superior teeth  (all=14; own MESH:14; tris=23,100)
        Inferior teeth  (all=14; own MESH:14; tris=23,772)
      Nasal cartilages  (all=0; tris=0)
        Major alar cartilage  (all=0; tris=0)
        Nasal septal cartilage  (all=0; tris=0)
      Cartilages of ear  (all=0; tris=0)
        Auricular cartilage  (all=0; tris=0)
        Cartilage of external acoustic meatus  (all=0; tris=0)
        Cartilage of auditory tube  (all=0; tris=0)
      Laryngeal cartilages  (all=72; tris=0)
        Epiglottic cartilage  (all=0; tris=0)
        Thyroid cartilage  (all=18; own FONT:3, MESH:3; tris=0)
        Cricoid cartilage  (all=8; own FONT:1, MESH:1; tris=0)
        Arytenoid cartilage  (all=46; own FONT:6, MESH:6; tris=0)
        Minor laryngeal cartilage  (all=0; tris=0)
      Vertebral column  (all=180; own FONT:9, MESH:89; tris=145,830)
        Primary curvatures  (all=0; tris=0)
        Secondary curvatures  (all=0; tris=0)
        Bones of vertebral column  (all=119; tris=60,085)
      Thoracic skeleton  (all=146; own MESH:73, FONT:18; tris=222,005)
        Bones of thorax  (all=87; tris=177,230)
        Costal cartilages  (all=21; own MESH:20, FONT:1; tris=17,248)
      Bones of upper limb  (all=66; own FONT:7, MESH:17; tris=68,350)
        Bones of pectoral girdle  (all=47; own MESH:5, FONT:2; tris=56,414)
        Bones of free part of upper limb  (all=0; tris=0)
      Bony pelvis  (all=15; own FONT:11, MESH:4; tris=20,418)
        Conjugate diameters  (all=0; tris=0)
      Bones of lower limb  (all=253; own FONT:16, MESH:73; tris=54,756)
        Bones of pelvic girdle  (all=0; tris=0)
        Bones of free lower limb  (all=236; own MESH:67, FONT:5; tris=47,180)
      Cartilages  (all=31; own MESH:31; tris=26,912)
    Muscular insertions  (all=0; tris=0)
      Axial insertions  (all=0; tris=0)
        Insertions of scalene anterior  (all=0; tris=0)
        Insertions of Scalenus medius and posterior  (all=0; tris=0)
        Insertions of diaphragm  (all=0; tris=0)
        Insertions of internal abdominal oblique  (all=0; tris=0)
        Insertions of levatores longi costarum  (all=0; tris=0)
        Insertions of longissimus thoracis  (all=0; tris=0)
        Insertions of pectoralis major  (all=0; tris=0)
        Insertions of sternocleidomastoid  (all=0; tris=0)
        Insertions of temporalis muscle  (all=0; tris=0)
        Insertions of masseter  (all=0; tris=0)
        Insertions of buccinator muscle  (all=0; tris=0)
        Insertions of procerus muscle  (all=0; tris=0)
        Insertions of pectoralis minor muscle  (all=0; tris=0)
        Insertions of rectus abdominis muscle  (all=0; tris=0)
        Insertions of external abdominal oblique muscle  (all=0; tris=0)
        Insertions of serratus posterior inferior muscle  (all=0; tris=0)
        Insertions of serratus posterior superior muscle  (all=0; tris=0)
        Insertions of Sternohyoid muscle  (all=0; tris=0)
        Insertions of internal abdominal oblique muscle  (all=0; tris=0)
        Insertions of transverse abdominal muscle  (all=0; tris=0)
        Insertions of pterygoid muscles  (all=0; tris=0)
        Insertions of thyrohyoid muscle  (all=0; tris=0)
        Insertions of geniohyoid muscle  (all=0; tris=0)
        Insertions of rectus anterior capitis  (all=0; tris=0)
        Insertions of rectus posterior minor muscle  (all=0; tris=0)
        Insertions of rectus posterior major muscle  (all=0; tris=0)
        Insertions of facial muscles  (all=0; tris=0)
        Insertions of obliquus inferior capitis  (all=0; tris=0)
        Insertions of serratus posterior  (all=0; tris=0)
      Appendicular insertions  (all=0; tris=0)
        Insertions of upper limbs  (all=0; tris=0)
        Insertions of lower limbs  (all=0; tris=0)
    Arthrology  (all=436; tris=154,398)
      Joints  (all=25; tris=0)
        Fibrous joints  (all=25; own FONT:12, MESH:1; tris=0)
        Cartilaginous joints  (all=0; tris=0)
        Synovial joint  (all=0; tris=0)
        Diarthrosis  (all=0; tris=0)
      Joints of skull  (all=14; tris=1,412)
        Cranial fibrous joints  (all=8; tris=388)
        Cranial cartilaginous joints  (all=0; tris=0)
        Cranial synovial joints  (all=6; tris=1,024)
      Joints of auditory ossicles  (all=0; tris=0)
        Fibrous joints of auditory ossicles  (all=0; tris=0)
        Articulations of auditory ossicles  (all=0; tris=0)
      Laryngeal joints  (all=8; tris=21,975)
        Fibrous joints of larynx  (all=6; own MESH:1; tris=15,737)
        Synovial joints of larynx  (all=2; tris=6,238)
      Joints of vertebral column  (all=57; tris=72,383)
        Fibrous joints of vertebral column  (all=10; own MESH:10; tris=2,167)
        Cartilaginous joints of vertebral column  (all=47; tris=70,216)
        Synovial joints of vertebral column  (all=0; tris=0)
      Thoracic joints  (all=10; tris=3,314)
        Fibrous joints of thorax  (all=4; own MESH:4; tris=2,526)
        Cartilaginous joints of thorax  (all=0; tris=0)
        Synovial joints of thorax  (all=6; tris=788)
      Joints of upper limb  (all=144; tris=7,406)
        Joints of pectoral girdle  (all=28; tris=236)
        Joints of free upper limb  (all=116; tris=7,170)
      Joints of lower limb  (all=178; tris=47,908)
        Joints of pelvic girdle  (all=20; tris=1,190)
        Joints of free lower limb  (all=158; tris=46,718)
    Muscular system  (all=806; tris=2,136,917)
      Superficial muscles  (all=120; own MESH:120; tris=706,814)
      Muscles  (all=509; own MESH:509; tris=1,959,648)
        Muscle  (all=0; tris=0)
        Tendon  (all=0; tris=0)
      Fascia  (all=57; own MESH:56, FONT:1; tris=149,869)
        Fascia of muscles  (all=0; tris=0)
        Fascia of body cavities  (all=0; tris=0)
      Synovial bursae  (all=0; tris=0)
        Synovial bursa  (all=0; tris=0)
      Tendon sheaths  (all=41; own MESH:38, LIGHT:3; tris=8,320)
      Cranial part of muscular system  (all=102; tris=166,896)
        Muscles of head  (all=102; own MESH:91, FONT:11; tris=166,896)
        Fascia of head  (all=0; tris=0)
        Bursae of head  (all=0; tris=0)
      Cervical part of muscular system  (all=69; tris=172,286)
        Muscles of neck  (all=69; own MESH:63, FONT:6; tris=172,286)
        Cervical fascia  (all=0; tris=0)
        Cervical bursae  (all=0; tris=0)
      Dorsal part of muscular system  (all=73; tris=251,392)
        Thoracolumbar fascia  (all=0; tris=0)
        Epaxial muscles  (all=47; tris=128,400)
        Hypaxial muscles of back  (all=26; own MESH:23, FONT:3; tris=122,992)
      Thoracic part of muscular system  (all=6; tris=11,160)
        Pectoralis major muscle  (all=6; own MESH:6; tris=11,160)
      Abdominal part of muscular system  (all=25; own MESH:21, FONT:4; tris=271,515)
        Muscles of abdomen  (all=16; own MESH:15, FONT:1; tris=237,184)
        Fascia of abdomen  (all=0; tris=0)
      Pelvic part of muscular system  (all=0; tris=0)
        Muscles of pelvis  (all=0; tris=0)
        Pelvic fasciae  (all=0; tris=0)
      Muscular system of upper limb  (all=137; tris=245,188)
        Muscles of upper limb  (all=131; own FONT:15, MESH:116; tris=244,338)
        Fascia of upper limb  (all=6; own MESH:6; tris=850)
        Bursae of upper limb  (all=0; tris=0)
      Muscular system of lower limb  (all=182; tris=506,808)
        Muscles of lower limb  (all=182; own FONT:23, MESH:159; tris=506,808)
        Fascia of lower limb  (all=0; tris=0)
        Bursae of lower limb  (all=0; tris=0)
        Tendon sheaths of lower limb  (all=0; tris=0)
      Bursae  (all=78; own MESH:78; tris=19,080)
    Cardiovascular system  (all=697; tris=67,840)
      Vessels  (all=0; tris=0)
        Blood vessels'  (all=0; tris=0)
        Lymphatic vessels'  (all=0; tris=0)
        Vessel'  (all=0; tris=0)
      Vascular plexuses  (all=0; tris=0)
      Pulmonary vessels  (all=51; tris=230)
        Pulmonary arteries  (all=30; own CURVE:26, MESH:1, FONT:3; tris=230)
        Pulmonary veins  (all=21; own CURVE:20, FONT:1; tris=0)
      Cardiac vessels  (all=14; tris=0)
        Arteries of heart  (all=7; own FONT:1, CURVE:6; tris=0)
        Cardiac veins  (all=7; own FONT:1, CURVE:6; tris=0)
      Systemic arteries  (all=405; own CURVE:399, MESH:1, FONT:5; tris=80)
        Aorta  (all=208; own CURVE:206, FONT:2; tris=0)
        Common carotid artery  (all=126; own CURVE:126; tris=0)
        Cerebral arterial circle  (all=0; tris=0)
        Arteries of spinal cord  (all=0; tris=0)
        Subclavian artery  (all=21; tris=0)
        Femoral artery  (all=0; tris=0)
      Systemic veins  (all=221; own CURVE:209, MESH:3, FONT:9; tris=4,728)
        Superior vena cava'  (all=0; tris=0)
        Internal jugular vein'  (all=0; tris=0)
        Cranial veins'  (all=0; tris=0)
        Veins of cerebral column'  (all=0; tris=0)
        Subclavian vein'  (all=0; tris=0)
        Inferior vena cava'  (all=0; tris=0)
        Femoral vein'  (all=0; tris=0)
        Hepatic portal vein'  (all=0; tris=0)
      Great lymphatic vessels  (all=0; tris=0)
        Right lymphatic duct'  (all=0; tris=0)
        Thoracic duct'  (all=0; tris=0)
      Heart  (all=18; own MESH:17, FONT:1; tris=62,802)
        Apex of heart  (all=0; tris=0)
        Epicardium  (all=0; tris=0)
        Myocardium  (all=0; tris=0)
        Cardiac septa  (all=0; tris=0)
        Valvular complex of heart  (all=0; tris=0)
        Right atrium  (all=0; tris=0)
        Right ventricle  (all=0; tris=0)
        Left atrium  (all=0; tris=0)
        Left ventricle  (all=0; tris=0)
    Nervous system  (all=970; own CURVE:1; tris=1,574,858)
      Central nervous system  (all=337; own FONT:53, MESH:152, CURVE:8; tris=706,948)
        Meninges  (all=21; own FONT:7, MESH:7, CURVE:7; tris=46,187)
        Brain  (all=294; own FONT:32, MESH:140; tris=660,537)
        Spinal cord  (all=3; tris=224)
        Neo-cortex  (all=126; own MESH:126; tris=111,026)
      Peripheral nervous system  (all=589; own FONT:28, MESH:10, CURVE:235; tris=839,792)
        Nerves  (all=249; own CURVE:246, MESH:3; tris=4,638)
        Root of nerves  (all=0; tris=0)
        Ganglia  (all=0; tris=0)
        Nervus plexuses  (all=0; tris=0)
        Cranial nerves  (all=155; own CURVE:49, FONT:2, MESH:5; tris=208,930)
        Spinal nerves  (all=409; own FONT:1, MESH:1; tris=627,982)
        Automatic division of peripheral nervous system  (all=6; tris=2,880)
      Sense organs  (all=50; own FONT:8, MESH:18, CURVE:1; tris=28,118)
        Olfactory organ  (all=0; tris=0)
        Eye*  (all=17; own FONT:3, MESH:12, CURVE:1; tris=17,590)
        Ear  (all=28; tris=10,528)
        Gustatory organ  (all=0; tris=0)
    Visceral systems  (all=222; tris=178,705)
      Digestive system  (all=88; own MESH:78, CURVE:9; tris=86,675)
        Mouth  (all=14; own MESH:10, CURVE:4; tris=6,652)
        Fauces  (all=0; tris=0)
        Pharynx  (all=0; tris=0)
        Digestive canal  (all=12; own CURVE:2, MESH:9; tris=7,307)
        Liver  (all=8; own MESH:8; tris=6,697)
        Gallbladder  (all=0; tris=0)
        Extrahepatic bile ducts  (all=0; tris=0)
        Pancreas  (all=0; tris=0)
      Respiratory system  (all=41; own MESH:13, CURVE:28; tris=21,974)
        Nose  (all=0; tris=0)
        Paranasal sinuses  (all=0; tris=0)
        Larynx  (all=0; tris=0)
        Tracheobronchial tree  (all=29; tris=4,756)
        Lungs  (all=5; own MESH:5; tris=10,342)
      Thoracic cavity  (all=0; tris=0)
        Pleural cavity  (all=0; tris=0)
        Pleura  (all=0; tris=0)
        Mediastinum  (all=0; tris=0)
      Urinary system  (all=9; own MESH:6, CURVE:3; tris=8,522)
        Kidney  (all=0; tris=0)
        Ureter  (all=0; tris=0)
        Urinary bladder  (all=0; tris=0)
        Urethra  (all=0; tris=0)
      Genital systems'  (all=19; own MESH:15, CURVE:4; tris=5,023)
        Female genital system'  (all=0; tris=0)
        Male genital system'  (all=0; tris=0)
      Abdominopelvic cavity  (all=3; tris=2,996)
        Peritoneal cavity  (all=0; tris=0)
        Peritoneum  (all=0; tris=0)
        Peritoneal structures  (all=3; own MESH:3; tris=2,996)
        Visceral fascia of abdominopelvic cavity  (all=0; tris=0)
        Extraperitoneal space  (all=0; tris=0)
      Lymphoid system  (all=54; own MESH:54; tris=45,194)
        Primary lymphoid organs  (all=0; tris=0)
        Secondary lymphoid organs  (all=0; tris=0)
      Endocrine glands  (all=8; own MESH:8; tris=8,321)
        Hypophysis  (all=0; tris=0)
        Thyroid gland  (all=0; tris=0)
        Parathyroid glands  (all=0; tris=0)
        Suprarenal gland  (all=0; tris=0)
        Paraganglia  (all=0; tris=0)
    Regions of human body  (all=4299; tris=3,903,462)
      Regions of head  (all=107; own FONT:1, MESH:1; tris=8,512)
        Regions of epicranium  (all=12; own MESH:8; tris=1,600)
        Auricular region  (all=44; own MESH:43, FONT:1; tris=4,166)
        Regions of face  (all=49; own MESH:17, FONT:3; tris=2,746)
      Regions of neck  (all=28; own MESH:3, FONT:1; tris=1,934)
        Anterior region of neck  (all=14; own FONT:1, MESH:1; tris=438)
        Sternocleidomastoid region  (all=6; own MESH:5, FONT:1; tris=446)
        Lateral region of neck  (all=4; own MESH:4; tris=480)
      Regions of thorax  (all=18; own MESH:4, FONT:2; tris=1,766)
        Anterior region of thorax  (all=12; own MESH:6; tris=1,118)
      Regions of abdomen  (all=16; own MESH:9, FONT:1; tris=1,162)
        Epigastric region  (all=2; own MESH:2; tris=136)
        Umbilical region  (all=4; own MESH:4; tris=196)
      Regions of perineum  (all=6; own MESH:3, FONT:1; tris=1,160)
        Anal region  (all=2; own MESH:2; tris=28)
      Regions of upper limb  (all=46; own MESH:3, FONT:1; tris=14,092)
        Axillary region  (all=0; tris=0)
        Brachial region  (all=8; own MESH:2; tris=1,698)
        Cubital region  (all=8; own MESH:3, FONT:1; tris=840)
        Antebrachial region  (all=10; own MESH:9, FONT:1; tris=2,380)
        Carpal region  (all=8; own MESH:7, FONT:1; tris=344)
        Region of hand  (all=8; own MESH:2; tris=8,294)
      Regions of lower limb  (all=62; own MESH:3, FONT:1; tris=14,390)
        Gluteal region  (all=4; own MESH:4; tris=736)
        Femoral region  (all=6; own MESH:2; tris=2,728)
        Knee region  (all=6; own MESH:2; tris=1,248)
        Leg region  (all=6; own MESH:3, FONT:1; tris=2,208)
        Talocrural region  (all=10; own MESH:2; tris=984)
        Regions of foot  (all=26; own MESH:8; tris=6,366)
      Integument  (all=15; tris=20,912)
        Skin  (all=0; tris=0)
        Skin appendages  (all=15; tris=20,912)
        Subcutaneous tissue  (all=0; tris=0)
      Main divisions  (all=4252; tris=3,900,178)
        Head  (all=1434; own MESH:877, CURVE:249, FONT:308; tris=1,133,129)
        Neck  (all=257; own MESH:189, CURVE:46, FONT:22; tris=268,628)
        Trunk  (all=1183; own MESH:692, CURVE:352, FONT:112, LIGHT:3; tris=1,737,397)
        Left lower limb  (all=448; own MESH:311, CURVE:96, FONT:41; tris=355,961)
        Right lower limb  (all=509; own MESH:341, CURVE:96, FONT:72; tris=355,745)
        Left upper limb  (all=322; own MESH:219, CURVE:93, FONT:10; tris=201,627)
        Right upper limb  (all=381; own MESH:249, CURVE:92, FONT:40; tris=202,498)
        Left hand  (all=42; own MESH:42; tris=2,070)
        Right hand  (all=96; own MESH:96; tris=23,838)
        Left foot  (all=96; own FONT:9, MESH:56, CURVE:31; tris=5,725)
        Right foot  (all=304; own FONT:86, MESH:187, CURVE:31; tris=38,897)
    Reference lines, planes & movements'  (all=37; tris=1,676)
      General terms  (all=14; own MESH:14; tris=354)
      Reference planes  (all=4; tris=18)
        Longitudinal planes  (all=3; tris=8)
        Transverse planes  (all=1; own MESH:1; tris=10)
      Reference lines  (all=8; own MESH:8; tris=992)
      Movements  (all=11; own MESH:11; tris=312)
      Orientations  (all=14; own MESH:14; tris=354)
```

Total collections: 1944; with `English` custom prop: 1920

Top-level membership combinations (objects linked into several top-level collections):

- 1: Skeletal system + Bonus collection: 2141
- 4: Muscular system + Bonus collection: 885
- 7: Nervous system & Sense organs + Bonus collection: 737
- 5: Cardiovascular system + Bonus collection: 709
- 2: Muscular insertions: 705
- 3: Joints + Bonus collection: 457
- 8: Visceral systems: 342
- 9: Regions of human body + Bonus collection: 311
- 6: Lymphoid organs: 147
- 8: Visceral systems + Bonus collection: 137
- 3: Joints: 136
- 6: Lymphoid organs + Bonus collection: 129
- 7: Nervous system & Sense organs: 105
- 1: Skeletal system: 77
- 5: Cardiovascular system: 48
- Bonus collection + Reference lines, reference planes, movements: 37
- 9: Regions of human body: 32
- Reference lines, reference planes, movements: 17
- <Scene Collection> + Bonus collection: 12
- 4: Muscular system: 9
- Bonus collection: 4
- Cross section planes: 3
- <Scene Collection>: 3

## Naming conventions

Suffix statistics (last `.xyz` token) by object type:

- MESH: {'.j': 1228, '.r': 980, '.l': 976, '': 575, '.i': 344, '.ol': 136, '.or': 133, '.el': 97, '.er': 89, '.g': 11}
- CURVE: {'.r': 387, '.l': 386, '': 178}
- FONT: {'.t': 786, '.g': 521, '.s': 343, '.st': 9, '': 1}
- LIGHT: {'': 3}
- CAMERA: {'': 1}

- **parenthesized**: 69
- **parenthesizedSamples**: ['(Abdominal part of pectoralis major muscle).l', '(Abdominal part of pectoralis major muscle).ol', '(Abdominal part of pectoralis major muscle).or', '(Abdominal part of pectoralis major muscle).r', '(Accessory parotid gland).l', '(Accessory parotid gland).r', '(Adductor minimus).l', '(Adductor minimus).r', '(Anterior tibial node).l', '(Anterior tibial node).r']
- **bracketed**: 1
- **bracketedSamples**: ['[Trochlear spine].j']
- **leadingOrTrailingSpace**: 2
- **leadingOrTrailingSpaceSamples**: [' Posterior transverse collateral sulcus.l', ' Posterior transverse collateral sulcus.r']
- **blenderDuplicateCounters**: 0
- **duplicateSamples**: []
- **sideWordsInBase**: {'word:left': 118, 'word:right': 118}
- **groupObjects(.g)**: {'FONT': 521, 'MESH': 11}
- **labelObjects(.t)**: {'FONT': 786}
- **leaderLines(.j)**: {'MESH': 1228}
- **st(.st)**: {'FONT': 9}
- **originInsertion(.o/.i)**: {'MESH': 613}

Mesh object base name differs from mesh-data base name: 260 (samples: [('Adductor pollicis.e1l', 'Adductor pollicis.e1'), ('Adductor pollicis.e1r', 'Adductor pollicis.e1'), ('Bucinator.o1r', 'Bucinator.o1'), ('Bucinator.o1l', 'Bucinator.o1'), ('Deep head of flexor pollicis brevis.o1l', 'Deep head of flexor pollicis brevis.o1'), ('Deep head of flexor pollicis brevis.o1r', 'Deep head of flexor pollicis brevis.o1'), ('Descending part of trapezius muscle.ol', 'Ascending part of trapezius muscle.o1'), ('Descending part of trapezius muscle.or', 'Ascending part of trapezius muscle.o1')])

## Languages

- **translationsText**: True
- **header**: ['English', 'Latin', 'Français', 'Español', 'Portugues']
- **rows**: 7284
- **columnsPerRow**: {5: 7284}
- **filledPerLanguage**: {'English': 7284, 'Latin': 7284, 'Français': 7284, 'Español': 7284, 'Portugues': 7284}
- **structureNamesWithTranslation**: 2152
- **structureNamesTotal**: 2365
- **sampleRows**: ['Occiput;Occiput;Occiput;Occipucio;Occipício', 'Temple;Tempus;Tempe;Sien;Têmpora', 'Auricle;Auricula;Pavillon auriculaire;Oreja;Aurícula', "Lobule of auricle;Lobulus auriculae;Lobe de l'oreille;Lóbulo de la oreja;Lóbulo da orelha", 'Helix;Helix;Hélix;Hélix;Hélice', "Crus of helix;Crus helicis;Racine de l'hélix;Raíz da Hélix;Cruz da hélice"]
- **sameAsEnglishLatin**: 407
- **hasGerman**: False

## Definitions (text datablocks)

- text datablocks: 3839, ending with a URL: 2910, name matches a structure: 1758
- by target: {'structure:url': 1309, 'unmatched:url': 1134, 'structure:noUrl': 449, 'label:noUrl': 334, 'unmatched:noUrl': 146, 'label:url': 467}
- URL domains: {'en.wikipedia.org': 2893, 'ta2viewer.openanatomy.org': 9, 'fr.wikipedia.org': 2, 'www.pbmchealth.org': 2, 'pubmed.ncbi.nlm.nih.gov': 1, 'www.youtube.com': 1, 'dictionnaire.academie-medecine.fr': 1, 'medical-dictionary.thefreedictionary.com': 1}
- Texts matching neither a structure nor a label (1280):
  - `(Accessory pancreas)`: (ACCESSORY PANCREAS)
  - `(Anterior atlanto-occipital ligament)`: (ANTERIOR ATLANTO-OCCIPITAL LIGAMENT)
  - `(Ceratocricoid muscle)`: (CERATOCRICOID MUSCLE)
  - `(Cyamella)`: (CYAMELLA)
  - `(Hyaloid artery)`: (HYALOID ARTERY)
  - `(Incisive duct)`: INCISIVE DUCT
  - `(Interparietal bone)`: (INTERPARIETAL BONE)
  - `(Os centrale)`: (OS CENTRALE)
  - `(Premaxilla)`: (PREMAXILLA)
  - `(Suprasternal bones)`: (SUPRASTERNAL BONES)
  - `[Caroticoclinoid process]`: [CAROTICOCLINOID FORAMEN]
  - `[Craniopharyngeal canal]`: [CRANIOPHARYNGEAL CANAL]
  - `[Foramen petrosum]`: [FORAMEN PETROSUM]
  - `[Paramastoid process]`: [PARAMASTOID PROCESS]
  - `[Supracondylar process]`: [SUPRACONDYLAR PROCESS]
  - `[Third trochanter]`: [THIRD TROCHANTER]
  - `Abdomen`: ABDOMEN
  - `Abdominal aortic plexus`: ABDOMINAL AORTIC PLEXUS
  - `Abdominal fascia`: ABDOMINAL FASCIA
  - `Abdominal wall`: ABDOMINAL WALL
  - `Abductor digiti minimi muscle of hand`: ABDUCTOR DIGITI MINIMI MUSCLE OF HAND
  - `Accessory bone`: ACCESSORY BONE
  - `Accessory bone (Supernumerary bone)`: ACCESSORY BONES (SUPERNUMERARY BONES)
  - `Accessory bones of thorax`: ACCESSORY BONES OF THORAX
  - `Accessory breast`: ACCESSORY BREAST
  - `Accessory carpal bones`: ACCESSORY CARPAL BONES
  - `Aditus to mastoid antrum`: ADITUS TO MASTOID ANTRUM
  - `Agger nasi`: AGGER NASI
  - `Allocortex`: ALLOCORTEX
  - `Alveolar canals`: ALVEOLAR CANALS
  - `Alveolar process`: ALVEOLAR PROCESS
  - `Ampulla of vas deferens`: AMPULLA OF VAS DEFERENS
  - `Anal canal`: ANAL CANAL
  - `Anal columns`: ANAL COLUMNS
  - `Anal sinuses`: ANAL SINUSES
  - `Anal triangle`: ANAL TRIANGLE
  - `Anal valves`: ANAL VALVES
  - `Angle of mandible`: ANGLE OF MANDIBLE
  - `Angle of the mandible`: ANGLE OF THE MANDIBLE
  - `Angles of parietal bone`: ANGLES OF PARIETAL BONE
  - `Ankle`: ANKLE
  - `Anocutaneous line`: ANOCUTANEOUS LINE
  - `Anorectal varices`: ANORECTAL VARICES
  - `Ansa cervicalis`: ANSA CERVICALIS
  - `Ansa lenticularis`: ANSA LENTICULARIS
  - `Anterior cecal artery`: ANTERIOR CECAL ARTERY
  - `Anterior choroidal artery`: ANTERIOR CHOROIDAL ARTERY
  - `Anterior ciliary arteries`: ANTERIOR CILIARY ARTERIES
  - `Anterior cranial fossa`: ANTERIOR CRANIAL FOSSA
  - `Anterior ethmoidal nerve`: ANTERIOR ETHMOIDAL NERVE
  - `Anterior fontanelle`: ANTERIOR FONTANELLE
  - `Anterior gastric branches of anterior vagal trunk`: ANTERIOR GASTRIC BRANCHES OF ANTERIOR VAGAL TRUNK
  - `Anterior humeral circumflex artery`: ANTERIOR HUMERAL CIRCUMFLEX ARTERY
  - `Anterior hypothalamic nucleus`: ANTERIOR HYPOTHALAMIC NUCLEUS
  - `Anterior intercostal veins`: ANTERIOR INTERCOSTAL VEINS
  - `Anterior lacrimal crest`: ANTERIOR LACRIMAL CREST
  - `Anterior lobe of cerebellum`: ANTERIOR LOBE OF CEREBELLUM
  - `Anterior meniscofemoral ligament`: ANTERIOR MENISCOFEMORAL LIGAMENT
  - `Anterior nasal spine`: ANTERIOR NASAL SPINE
  - `Anterior nuclei of thalamus`: ANTERIOR NUCLEI OF THALAMUS
  - `Anterior olfactory nucleus`: ANTERIOR OLFACTORY NUCLEUS
  - `Anterior perforated substance`: ANTERIOR PERFORATED SUBSTANCE
  - `Anterior superior alveolar arteries`: ANTERIOR SUPERIOR ALVEOLAR ARTERIES
  - `Anterior superior alveolar nerve`: ANTERIOR SUPERIOR ALVEOLAR NERVE
  - `Anterior surface of ulna`: ANTERIOR SURFACE OF ULNA
  - `Anterior tibial vein`: ANTERIOR TIBIAL VEIN
  - `Anterior triangle of the neck`: ANTERIOR TRIANGLE OF THE NECK
  - `Anterior tympanic artery`: ANTERIOR TYMPANIC ARTERY
  - `Anterior vagal trunk`: ANTERIOR VAGAL TRUNK
  - `Anterior white commissure`: ANTERIOR WHITE COMMISSURE
  - `Anus`: ANUS
  - `Aortic orifice`: AORTIC ORIFICE
  - `Aortic sinus`: AORTIC SINUS
  - `Aorticorenal ganglion`: AORTICORENAL GANGLION
  - `Apex of orbit`: APEX OF ORBIT
  - `Apex of petrous part of temporal bone`: APEX OF PETROUS PART OF TEMPORAL BONE
  - `Apex of the petrous part`: APEX OF THE PETROUS PART
  - `Apical foramen`: APICAL FORAMEN
  - `Apocrine sweat gland`: APOCRINE SWEAT GLAND
  - `Apophysis`: APOPHYSIS
  - `Appendicular vein`: APPENDICULAR VEIN
  - `Appendix of testis`: APPENDIX OF TESTIS
  - `Arches of the foot`: ARCHES OF THE FOOT
  - `Archicortex`: ARCHICORTEX
  - `Area postrema`: AREA POSTREMA
  - `Areola`: AREOLA
  - `Areolar gland`: AREOLAR GLAND
  - `Arm`: ARM
  - `Armature`: ARMATURE
  - `Arrector pili muscle`: ARRECTOR PILI MUSCLE
  - `Arteriole`: ARTERIOLE
  - `Artery`: ARTERY
  - `Artery of bulb of penis`: ARTERY OF BULB OF PENIS
  - `Artery of round ligament of uterus`: ARTERY OF ROUND LIGAMENT OF UTERUS
  - `Artery of the pterygoid canal`: ARTERY OF THE PTERYGOID CANAL
  - `Artery to the ductus deferens`: ARTERY TO THE DUCTUS DEFERENS
  - `Articular capsule of the knee joint`: ARTICULAR CAPSULE OF THE KNEE JOINT
  - `Articular cartilage`: ARTICULAR CARTILAGE
  - `Articular circumference of ulna`: ARTICULAR CIRCUMFERENCE OF ULNA
  - `Articular processes`: ARTICULAR PROCESSES
  - `Articular surface of medial condyle of femur`: ARTICULAR SURFACE OF MEDIAL CONDYLE OF FEMUR
  - `Articular surface of the medial condyle`: ARTICULAR SURFACE OF THE MEDIAL CONDYLE
  - `Articular tubercle`: ARTICULAR TUBERCLE/EMINENCE
  - `Aryepiglottic fold`: ARYEPIGLOTTIC FOLD
  - `Ascending lumbar vein`: ASCENDING LUMBAR VEIN
  - `Ascending palatine artery`: ASCENDING PALATINE ARTERY
  - `Atrioventricular node`: ATRIOVENTRICULAR NODE
  - `Atrioventricular septum`: ATRIOVENTRICULAR SEPTUM
  - `Atrioventricular valve`: ATRIOVENTRICULAR VALVE
  - `Auditory ossicles (part of skeletal system)`: AUDITORY OSSICLES
  - `Auricular branch of occipital artery`: AURICULAR BRANCH OF OCCIPITAL ARTERY
  - `Auricular branch of posterior auricular artery`: AURICULAR BRANCH OF POSTERIOR AURICULAR ARTERY
  - `Auriculotemporal nerve`: AURICULOTEMPORAL NERVE
  - `Autonomic ganglion`: AUTONOMIC GANGLION
  - `Axilla`: AXILLA
  - `Basilar membrane`: BASILAR MEMBRANE
  - `Basilar sulcus`: BASILAR SULCUS
  - `Bicipital groove`: BICIPITAL GROOVE
  - `Bifurcated ligament`: BIFURCATED LIGAMENT
  - `Biventer lobule`: BIVENTER LOBULE
  - `Blood`: BLOOD
  - `Bone`: BONE
  - `Bone marrow`: BONE MARROW
  - `Bony external acoustic meatus`: BONY EXTERNAL ACOUSTIC MEATUS
  - `Bony external acoustic opening`: BONY EXTERNAL ACOUSTIC OPENING
  - `Bony labyrinth`: BONY LABYRINTH
  - `Bony part of nasal septum`: BONY PART OF NASAL SEPTUM
  - `Bony tympanic cavity`: (BONY) TYMPANIC CAVITY
  - `Borders of occipital bone`: BORDERS OF OCCIPITAL BONE
  - `Borders of parietal bone`: BORDERS OF PARIETAL BONE
  - `Borders of the frontal bone`: BORDERS OF FRONTAL BONE
  - `Brachiocephalic vein`: BRACHIOCEPHALIC VEIN
  - `Breast`: BREAST
  - `Bregma`: BREGMA
  - `Broad ligament of the uterus`: BROAD LIGAMENT OF THE UTERUS
  - `Bronchomediastinal lymph trunk`: BRONCHOMEDIASTINAL LYMPH TRUNK
  - `Bronchus`: BRONCHUS
  - `Buccal branches of the facial nerve`: BUCCAL BRANCHES OF THE FACIAL NERVE
  - `Buccinator muscle`: BUCCINATOR MUSCLE
  - `Bulb of penis`: BULB OF PENIS
  - `Bulb of vestibule`: BULB OF VESTIBULE
  - `Bulbourethral gland`: BULBOURETHRAL GLAND
  - `Buttock`: BUTTOCKS
  - `Calcaneocuboid joint`: CALCANEOCUBOID JOINT
  - `Calf`: CALF
  - `Calvaria`: CALVARIA
  - `Canine fossa`: CANINE FOSSA
  - `Capillary`: CAPILLARY
  - `Cardiac plexus`: CARDIAC PLEXUS
  - `Cardiac vessels`: CORONARY CIRCULATION
  - `Cardinal ligament`: CARDINAL LIGAMENT
  - `Cardiovascular system`: CARDIOVASCULAR SYSTEM
  - `Caroticotympanic arteries`: CAROTICOTYMPANIC ARTERIES
  - `Caroticotympanic canaliculi`: CAROTICOTYMPANIC CANALICULI
  - `Caroticotympanic nerves`: CAROTICOTYMPANIC NERVES
  - `Carotid body`: CAROTID BODY
  - `Carotid canal`: CAROTID CANAL
  - `Carotid plexus`: CAROTID PLEXUS
  - `Carotid sinus`: CAROTID SINUS
  - `Carotid sinus nerve`: CAROTID SINUS NERVE
  - `Carpal groove`: CARPAL TUNNEL/
  - `Carpometacarpal joint of thumb`: CARPOMETACARPAL JOINT OF THUMB
  - `Cartilage`: CARTILAGE
  - `Caudal pontine reticular nucleus`: CAUDAL PONTINE RETICULAR NUCLEUS
  - `Cavernous nerve plexus`: CAVERNOUS NERVE PLEXUS
  - `Cavernous nerves`: CAVERNOUS NERVES
  - `Cavity of bony pelvis`: CAVITY OF BONY PELVIS
  - `Cecum`: CECUM
  - `Celiac branches of vagus nerve`: CELIAC BRANCHES OF VAGUS NERVE
  - `Celiac ganglia`: CELIAC GANGLIA
  - `Celiac plexus`: CELIAC PLEXUS
  - `Cerebellopontine angle`: CEREBELLOPONTINE ANGLE
  - `Cerebral cortex`: CEREBRAL CORTEX
  - `Cerebral sulci`: CEREBRAL SULCI
  - `Cervical branch of the facial nerve`: CERVICAL BRANCH OF THE FACIAL NERVE
  - `Cervical canal`: CERVICAL CANAL
  - `Cervical ganglia`: CERVICAL GANGLIA
  - `Cervical vertebra-labels`: CERVICAL VERTEBRA
  - `Chondrocranium`: CHONDROCRANIUM
  - `Chondroglossus`: CHONDROGLOSSUS
  - `Choroid`: CHOROID
  - `Ciliary body`: CILIARY BODY
  - `Ciliary ganglion`: CILIARY GANGLION
  - `Ciliary muscle`: CILIARY MUSCLE
  - `Ciliary part of retina`: CILIARY PART OF RETINA
  - `Circular folds`: CIRCULAR FOLDS
  - `Circulatory system`: CIRCULATORY SYSTEM
  - `Circulus arteriosus minor`: CIRCULUS ARTERIOSUS MINOR
  - `Cistern of lateral cerebral fossa`: CISTERN OF LATERAL CEREBRAL FOSSA
  - `Cisterna chyli`: CISTERNA CHYLI
  - `Claustrum`: CLAUSTRUM
  - `Clavipectoral triangle`: CLAVIPECTORAL TRIANGLE
  - `Clitoris`: CLITORIS
  - `Clivus`: CLIVUS
  - `Coccygeal noerve`: COCCYGEAL NERVE
  - `Coccyx-labels`: COCCYX
  - `Cochlear canaliculus`: COCHLEAR CANALICULUS/AQUEDUCT
  - `Cochlear duct`: COCHLEAR DUCT
  - `Coeliac disease`: COELIAC DISEASE
  - `Collateral ligaments of metacarpophalangeal joints`: COLLATERAL LIGAMENTS OF METACARPOPHALANGEAL JOINTS
  - `Collateral ligaments of metatarsophalangeal joints`: COLLATERAL LIGAMENTS OF METATARSOPHALANGEAL JOINTS
  - `Commissural fibers of telencephalon`: COMMISSURAL FIBERS OF TELENCEPHALON
  - `Commissure of inferior colliculus`: COMMISSURE OF INFERIOR COLLICULUS
  - `Commissure of superior colliculus`: COMMISSURE OF SUPERIOR COLLICULUS
  - `Common carotid artery`: COMMON CAROTID ARTERY
  - `Common carotid plexus`: COMMON CAROTID PLEXUS
  - `Common hepatic duct`: COMMON HEPATIC DUCT
  - `Common iliac lymph nodes`: COMMON ILIAC LYMPH NODES
  - `Compact bone`: COMPACT BONE
  - `Condyloid fossa`: CONDYLOID FOSSA
  - `Condyloid process`: CONDYLOID PROCESS
  - `Content-scanner`: import bpy
  - `Coronary circulation`: CORONARY CIRCULATION
  - `Coronary ligament`: CORONARY LIGAMENT
  - `Coronoid process of the mandible`: CORONOID PROCESS OF THE MANDIBLE
  - `Corpus albicans`: CORPUS ALBICANS
  - `Corpus cavernosum of clitoris`: CORPUS CAVERNOSUM OF CLITORIS
  - `Corpus cavernosum penis`: CORPUS CAVERNOSUM PENIS
  - `Corpus luteum`: CORPUS LUTEUM
  - `Corrugator cutis ani muscle`: CORRUGATOR CUTIS ANI MUSCLE
  - `Costal cartilage of 10th rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 1st rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 2nd rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 3rd rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 4th rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 5th rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 6th rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 7th rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 8th rib`: COSTAL CARTILAGE(S)
  - `Costal cartilage of 9th rib`: COSTAL CARTILAGE(S)
  - `Costodiaphragmatic recess`: COSTODIAPHRAGMATIC RECESS
  - `Costomediastinal recess`: COSTOMEDIASTINAL RECESS
  - `Cranial cavity`: CRANIAL CAVITY
  - `Craniopharyngeal canal`: CRANIOPHARYNGEAL CANAL
  - `Cremasteric artery`: CREMASTERIC ARTERY
  - `Cremasteric fascia`: CREMASTERIC FASCIA
  - `Crico-pharyngeal ligament`: CRICO-PHARYNGEAL LIGAMENT/
  - `Cricothyroid muscle`: CRICOTHYROID MUSCLE
  - `Crista terminalis`: CRISTA TERMINALIS
  - `Cruciate anastomosis`: CRUCIATE ANASTOMOSIS
  - `Crus of clitoris`: CRUS OF CLITORIS
  - `Cuboideonavicular joint`: CUBOIDEONAVICULAR JOINT
  - `Cuneate nucleus`: CUNEATE NUCLEUS
  - `Cuneometatarsal interosseous ligament`: CUNEOMETATARSAL INTEROSSEOUS LIGAMENT
  - `Cuneonavicular joint`: CUNEONAVICULAR JOINT
  - `Cylindrical joint`: CYLINDRICAL JOINT
  - `Cystic duct`: CYSTIC DUCT
  - `Cystic vein`: CYSTIC VEIN
  - `Cystohepatic triangle`: CYSTOHEPATIC TRIANGLE
  - `Deep artery of the penis`: DEEP ARTERY OF THE PENIS
  - `Deep auricular artery`: DEEP AURICULAR ARTERY
  - `Deep cervical vein`: DEEP CERVICAL VEIN
  - `Deep circumflex iliac artery`: DEEP CIRCUMFLEX ILIAC ARTERY
  - `Deep facial vein`: DEEP FACIAL VEIN
  - `Deep temporal arteries`: DEEP TEMPORAL ARTERIES
  - `Deep temporal nerves`: DEEP TEMPORAL NERVES
  - `Deltopectoral groove`: DELTOPECTORAL GROOVE
  - `Dentate gyrus`: DENTATE GYRUS
  - `Dentate nucleus`: DENTATE NUCLEUS
  - `Dentin`: DENTIN
  - `Depressor supercilii muscle`: DEPRESSOR SUPERCILII MUSCLE
  - `Dermis`: DERMIS
  - `Descending aorta`: DESCENDING AORTA
  - `Descending branch of occipital artery`: DESCENDING BRANCH OF OCCIPITAL ARTERY
  - `Descending part of ileofemoral ligament`: DESCENDING PART OF ILEOFEMORAL LIGAMENT
  - `Descending part of iliofemoral segment`: DESCENDING PART OF ILIOFEMORAL SEGMENT
  - `Desmocranium`: DESMOCRANIUM
  - `Diagonal band of Broca`: DIAGONAL BAND OF BROCA
  - `Diaphysis`: DIAPHYSIS
  - `Digastric branch of facial nerve`: DIGASTRIC BRANCH OF FACIAL NERVE
  - `Diploe`: DIPLOE
  - `Distal phalanx of hand`: DISTAL PHALANX OF HAND
  - `Dorsal interossei of the hand`: DORSAL INTEROSSEI OF THE HAND
  - `Dorsal metacarpal veins`: DORSAL METACARPAL VEINS
  - `Dorsal nasal artery`: DORSAL NASAL ARTERY
  - `Dorsal ramus of spinal nerve`: DORSAL RAMUS OF SPINAL NERVE
  - `Dorsal talonavicular ligament`: DORSAL TALONAVICULAR LIGAMENT
  - `Dorsal ulnocarpal ligament.002`: DORSAL ULNOCARPAL LIGAMENT
  - `Dorsal veins of the penis`: DORSAL VEINS OF THE PENIS
  - `Dorsal venous arch of the foot`: DORSAL VENOUS ARCH OF THE FOOT
  - `Dorsomedial hypothalamic nucleus`: DORSOMEDIAL HYPOTHALAMIC NUCLEUS
  - `Dorsum of nose`: DORSUM OF NOSE
  - `Ductus reuniens`: DUCTUS REUNIENS
  - `Duodenal bulb`: DUODENAL BULB
  - `Duodenojejunal flexure`: DUODENOJEJUNAL FLEXURE
  - `Eccrine sweat gland`: ECCRINE SWEAT GLAND
  - `Efferent ducts`: EFFERENT DUCTS
  - `Elbow`: ELBOW
  - `Electrical conduction system of the heart`: ELECTRICAL CONDUCTION SYSTEM OF THE HEART
  - `Emboliform nucleus`: EMBOLIFORM NUCLEUS
  - `Endocardium`: ENDOCARDIUM
  - `Endochondral bone`: ENDOCHONDRAL BONE
  - `Endolymph`: ENDOLYMPH
  - `Endolymphatic duct`: ENDOLYMPHATIC DUCT
  - `Endolymphatic sac`: ENDOLYMPHATIC SAC
  - `Endometrium`: ENDOMETRIUM
  - `Endoneurium`: ENDONEURIUM
  - `Endosteum`: ENDOSTEUM
  - `Epidermis`: EPIDERMIS
  - `Epiglottic vallecula`: EPIGLOTTIC VALLECULA
  - `Epineurium`: EPINEURIUM
  - `Epiphysis`: EPIPHYSIS
  - `Epithalamus`: EPITHALAMUS
  - `Epitympanic recess`: EPITYMPANIC RECESS
  - `Eponychium`: EPONYCHIUM
  - `Epoophoron`: EPOOPHORON
  - `Esophageal gland`: ESOPHAGEAL GLAND
  - `Esophageal plexus`: ESOPHAGEAL PLEXUS
  - `Esophagus`: ESOPHAGUS
  - `Ethmoid bone-labels`: ETHMOID BONE
  - `Ethmoid bulla`: ETHMOID BULLA
  - `Ethmoidal infundibulum`: ETHMOIDAL INFUNDIBULUM
  - `Extension`: EXTENSION
  - `Extensor digitorum brevis manus muscle`: EXTENSOR DIGITORUM BREVIS MANUS MUSCLE
  - `Extensor expansion`: EXTENSOR EXPANSION
  - `Extensor hallucis longus muscle`: EXTENSOR HALLUCIS LONGUS MUSCLE
  - `External opening of carotid canal`: EXTERNAL OPENING OF CAROTID CANAL
  - `External spermatic fascia`: EXTERNAL SPERMATIC FASCIA
  - `Extraperitoneal space`: EXTRAPERITONEAL SPACE
  - `Eyebrow(hair)`: EYEBROW
  - `Face`: FACE
  - `Facial canal`: FACIAL CANAL
  - `Facial hair`: FACIAL HAIR
  - `Facial motor nucleus`: FACIAL MOTOR NUCLEUS
  - `Facial nerve`: FACIAL NERVE
  - `Falciform ligament`: FALCIFORM LIGAMENT
  - `Fallopian tube`: FALLOPIAN TUBE
  - `Fasciculus thalamicus`: FASCICULUS THALAMICUS
  - `Fastigial nucleus`: FASTIGIAL NUCLEUS
  - `Fibular retinaculum`: FIBULAR RETINACULUM
  - `Fimbriated fold of tongue`: FIMBRIATED FOLD OF TONGUE
  - `Flat bone`: FLAT BONE
  - `Flexion`: FLEXION
  - `Flexor digitorum longus muscle`: FLEXOR DIGITORUM LONGUS MUSCLE
  - `Flexor hallucis longus muscle`: FLEXOR HALLUCIS LONGUS MUSCLE
  - `Flocculonodular lobe`: FLOCCULONODULAR LOBE
  - `Fold of left vena cava`: FOLD OF LEFT VENA CAVA
  - `Folium vermis`: FOLIUM VERMIS
  - `Foot`: FOOT
  - `Foramen cecum`: FORAMEN CECUM
  - `Foramen lacerum`: FORAMEN LACERUM
  - `Foramen ovale (heart)`: FORAMEN OVALE (HEART)
  - `Foramen singulare`: FORAMEN SINGULARE
  - `Forearm`: FOREARM
  - `Forehead`: FOREHEAD
  - `Forward kinematics`: FORWARD KINEMATICS
  - `Fovea centralis`: FOVEA CENTRALIS
  - `Foveola`: FOVEOLA
  - `Frenulum of lower lip`: FRENULUM OF LOWER LIP
  - `Frontal bone-labels`: FRONTAL BONE
  - `Frontal nerve`: FRONTAL NERVE
  - `Frontal process of maxilla`: FRONTAL PROCESS OF MAXILLA
  - `Frontal sinus`: FRONTAL SINUS
  - `Frontonasal duct`: FRONTONASAL DUCT
  - `Fundiform ligament`: FUNDIFORM LIGAMENT
  - `Ganglion`: GANGLION
  - `Ganglion impar`: GANGLION IMPAR
  - `Gastric folds`: GASTRIC FOLDS
  - `Gastric glands`: GASTRIC GLANDS
  - `Gastric pits`: GASTRIC PITS
  - `Gastric plexuses`: GASTRIC PLEXUSES
  - `Gastrocolic ligament`: GASTROCOLIC LIGAMENT
  - `Gastrophrenic ligament`: GASTROPHRENIC LIGAMENT
  - `Gastrosplenic ligament`: GASTROSPLENIC LIGAMENT
  - `Geniculum of facial canal`: GENICULUM OF FACIAL CANAL
  - `Gigantocellular nucleus`: GIGANTOCELLULAR NUCLEUS
  - `Gigantocellular reticular nucleus`: GIGANTOCELLULAR RETICULAR NUCLEUS
  - `Gingiva of lower jaw`: GINGIVA/GUMS
  - `Gingiva of upper jaw`: GINGIVA/GUMS
  - `Gingival margin`: GINGIVAL MARGIN
  - `Gingival sulcus`: GINGIVAL SULCUS
  - `Glandular branches of facial artery`: GLANDULAR BRANCHES OF FACIAL ARTERY
  - `Globose nucleus`: GLOBOSE NUCLEUS
  - `Glottis`: GLOTTIS
  - `Gluteal lines`: GLUTEAL LINES
  - `Gonion`: GONION
  - `Gracile nucleus`: GRACILE NUCLEUS
  - `Granular foveolae`: GRANULAR FOVEOLAE
  - `Great auricular nerve`: GREAT AURICULAR NERVE
  - `Greater occipital nerve`: GREATER OCCIPITAL NERVE
  - `Greater palatine canal`: GREATER PALATINE CANAL
  - `Greater palatine foramen`: GREATER PALATINE FORAMEN
  - `Greater palatine nerve`: GREATER PALATINE NERVE
  - `Greater petrosal nerve`: GREATER PETROSAL NERVE
  - `Greater tympanic spine`: GREATER TYMPANIC SPINE
  - `Grey commissure`: GREY COMMISSURE
  - `Groove for greater petrosal nerve`: GROOVE FOR GREATER PETROSAL NERVE
  - `Groove for lesser petrosal nerve`: GROOVE FOR LESSER PETROSAL NERVE
  - `Groove for middle temporal artery`: GROOVE FOR MIDDLE TEMPORAL ARTERY
  - `Groove for occipital artery`: GROOVE FOR OCCIPITAL ARTERY
  - `Groove for superior petrosal sinus`: GROOVE FOR SUPERIOR PETROSAL SINUS
  - `Groove for superior sagittal sinus`: GROOVE FOR SUPERIOR SAGITTAL SINUS
  - `Groove for the subclavius muscle`: SUBCLAVIAN GROOVE/
  - `Groove of the pterygoid hamulus`: GROOVE OF THE PTERYGOID HAMULUS
  - `Habenular commissure`: HABENULAR COMMISSURE
  - `Habenular nuclei`: HABENULAR NUCLEI
  - `Hair follicle`: HAIR FOLLICLE
  - `Hand`: HAND
  - `Head`: HEAD
  - `Heel`: HEEL
  - `Helicine arteries of penis`: HELICINE ARTERIES OF PENIS
  - `Helicis major`: HELICIS MAJOR
  - `Helicis minor`: HELICIS MINOR
  - `Helicotrema`: HELICOTREMA
  - `Hemiazygos vein`: HEMIAZYGOS VEIN
  - `Hepatic branches of anterior vagal trunk`: HEPATIC BRANCHES OF ANTERIOR VAGAL TRUNK
  - `Hepatic plexus`: HEPATIC PLEXUS
  - `Hepatocolic ligament`: HEPATOCOLIC LIGAMENT
  - `Hepatoduodenal ligament`: HEPATODUODENAL LIGAMENT
  - `Hepatogastric ligament`: HEPATOGASTRIC LIGAMENT
  - `Hepatophrenic ligament`: HEPATOPHRENIC LIGAMENT
  - `Hepatorenal ligament`: HEPATORENAL LIGAMENT
  - `Hepatorenal recess`: HEPATORENAL RECESS
  - `Hiatus for greater petrosal canal`: HIATUS FOR GREATER PETROSAL NERVE
  - `Hiatus for lesser petrosal nerve`: HIATUS FOR LESSER PETROSAL NERVE
  - `HideFamily.py`: import bpy
  - `Hip`: HIP
  - `Hip bone-labels`: HIP BONE
  - `Hippocampal sulcus`: HIPPOCAMPAL SULCUS
  - `Horizontal plate of palatine bone`: HORIZONTAL PLATE OF PALATINE BONE
  - `Humerus-labels`: HUMERUS
  - `Hyaloid canal`: HYALOID CANAL
  - `Hyaloid fossa`: HYALOID FOSSA
  - `Hymen`: HYMEN
  - `Hypogastric nerve`: HYPOGASTRIC NERVE
  - `Hypoglossal nerve`: HYPOGLOSSAL NERVE
  - `Hyponychium`: HYPONYCHIUM
  - `Hypothalamic sulcus`: HYPOTHALAMIC SULCUS
  - `Hypothenar eminence`: HYPOTHENAR EMINENCE
  - `Ileal arteries`: ILEAL ARTERIES
  - `Ileal veins`: ILEAL VEINS
  - `Ileocecal fold`: ILEOCECAL FOLD
  - `Ileum`: ILEUM
  - `Iliofemoral ligament`: ILIOFEMORAL LIGAMENT
  - `Iliopectineal bursa`: ILIOPECTINEAL BURSA
  - `Impressions of cerebral gyri`: IMPRESSIONES OF CEREBRAL GYRI
  - `Incisive canals`: INCISIVE CANALS
  - `Incisive foramen`: INCISIVE FORAMEN
  - `Incisive fossa`: INCISIVE FOSSA
  - `Incisive papilla`: INCISIVE PAPILLA
  - `Index finger`: INDEX FINGER
  - `Indusium griseum`: INDUSIUM GRISEUM
  - `Inferior articular process of vertebra`: SUPERIOR ARTICULAR PROCESS OF VERTEBRA
  - `Inferior cervical ganglion`: INFERIOR CERVICAL GANGLION
  - `Inferior extensor retinaculum of foot`: INFERIOR EXTENSOR RETINACULUM OF FOOT
  - `Inferior frontal gyrus`: INFERIOR FRONTAL GYRUS
  - `Inferior ganglion of glossopharyngeal nerve`: INFERIOR GANGLION OF GLOSSOPHARYNGEAL NERVE
  - `Inferior hypogastric plexus`: INFERIOR HYPOGASTRIC PLEXUS
  - `Inferior hypophysial artery`: INFERIOR HYPOPHYSIAL ARTERY
  - `Inferior labial vein`: INFERIOR LABIAL VEIN
  - `Inferior ligament of epididymis`: INFERIOR LIGAMENT OF EPIDIDYMIS
  - `Inferior longitudinal muscle of tongue`: INFERIOR LONGITUDINAL MUSCLE OF TONGUE
  - `Inferior medullary velum`: INFERIOR MEDULLARY VELUM
  - `Inferior mesenteric ganglion`: INFERIOR MESENTERIC GANGLION
  - `Inferior mesenteric plexus`: INFERIOR MESENTERIC PLEXUS
  - `Inferior nasal concha`: INFERIOR NASAL CONCHA
  - `Inferior nasal concha bone-labels`: INFERIOR NASAL CONCHA BONE
  - `Inferior olivary complex`: INFERIOR OLIVARY COMPLEX
  - `Inferior olivary nucleus`: INFERIOR OLIVARY NUCLEUS
  - `Inferior pancreaticoduodenal lymph nodes`: PANCREATICODUODENAL NODES
  - `Inferior pancreaticoduodenal nodes`: INFERIOR PANCREATICODUODENAL NODES
  - `Inferior posterior nasal branches of greater palatine nerve`: INFERIOR POSTERIOR NASAL BRANCHES OF GREATER PALATINE NERVE
  - `Inferior transverse ligament of scapula`: INFERIOR TRANSVERSE LIGAMENT OF SCAPULA
  - `Inferior transverse ligament of the tibiofibular syndesmosis`: INFERIOR TRANSVERSE LIGAMENT OF THE TIBIOFIBULAR SYNDESMOSIS
  - `Inferior tympanic artery`: INFERIOR TYMPANIC ARTERY
  - `Inferior tympanic canaliculus`: INFERIOR TYMPANIC CANALICULUS
  - `Inferior vena cava-ab`: INFERIOR VENA CAVA
  - `Inferior vena cava-th`: INFERIOR VENA CAVA
  - `Inferior vesical artery`: INFERIOR VESICAL ARTERY
  - `Inferior vestibuar nucleus`: INFERIOR VESTIBULAR NUCLEUS
  - `Inferior vestibular nucleus`: INFERIOR VESTIBULAR NUCLEUS
  - `Infra-auricular lymph nodes`: INFRA-AURICULAR LYMPH NODES
  - `Infraglottic cavity`: INFRAGLOTTIC CAVITY
  - `Infraorbital canal`: INFRAORBITAL CANAL
  - `Infraorbital foramen`: INFRAORBITAL FORAMEN
  - `Infraorbital groove`: INFRAORBITAL GROOVE
  - `Infraorbital nerve`: INFRAORBITAL NERVE
  - `Infrapatellar bursitis`: INFRAPATELLAR BURSITIS
  - `Infratemporal crest`: INFRATEMPORAL CREST
  - `Infratrochlear nerve`: INFRATROCHLEAR NERVE
  - `Inguinal triangle`: INGUINAL TRIANGLE
  - `Interarytenoid fold`: INTERARYTENOID FOLD
  - `Intercalated nucleus`: INTERCALATED NUCLEUS
  - `Intercapitular veins of the hand`: INTERCAPITULAR VEINS OF THE HAND
  - `Intercornual ligaments`: INTERCORNUAL LIGAMENTS
  - `Intercostal arteries`: INTERCOSTAL ARTERIES
  - `Intercostal nerve`: INTERCOSTAL NERVES
  - `Intercostobrachial nerve`: INTERCOSTOBRACHIAL NERVE
  - `Intercuneiform joints`: INTERCUNEIFORM JOINTS
  - `Intergluteal cleft`: INTERGLUTEAL CLEFT
  - `Interiliac nodes`: INTERILIAC NODES
  - `Intermammary cleft`: INTERMAMMARY CLEFT
  - `Intermesenteric plexus`: INTERMESENTERIC PLEXUS
  - `Internal acoustic meatus`: INTERNAL ACOUSTIC MEATUS
  - `Internal acoustic opening`: INTERNAL ACOUSTIC OPENING
  - `Internal anal sphincter`: INTERNAL ANAL SPHINCTER
  - `Internal arcuate fibers`: INTERNAL ARCUATE FIBERS
  - `Internal auditory meatus`: INTERNAL AUDITORY MEATUS
  - `Internal capsule`: INTERNAL CAPSULE
  - `Internal carotid plexus`: INTERNAL CAROTID PLEXUS
  - `Internal obturator muscle`: INTERNAL OBTURATOR MUSCLE
  - `Internal orifice of carotid canal`: INTERNAL ORIFICE OF CAROTID CANAL
  - `Internal spermatic fascia`: INTERNAL SPERMATIC FASCIA
  - `Internal urethral orifice`: INTERNAL URETHRAL ORIFICE
  - `Internal urethral sphincter`: INTERNAL URETHRAL SPHINCTER
  - `Interosseous cuneocuboid ligament`: INTEROSSEOUS CUNEOCUBOID LIGAMENT
  - `Interosseous cuneometatarsal ligaments`: INTEROSSEOUS CUNEOMETATARSAL LIGAMENTS
  - `Interosseous intercuneiform ligaments`: INTEROSSEOUS INTERCUNEIFORM LIGAMENTS
  - `Interosseous talocalcaneal ligament`: INTEROSSEOUS TALOCALCANEAL LIGAMENT
  - `Interosseus border of tibia`: INTEROSSEUS BORDER OF TIBIA
  - `Interthalamic adhesion`: INTERTHALAMIC ADHESION
  - `Interventricular septum`: INTERVENTRICULAR SEPTUM
  - `INtervertebral symphysis-Sacrum-Coccyx`: INTERVERTEBRAL SYMPHYSIS
  - `Intestinal lymph trunk`: INTESTINAL LYMPH TRUNK
  - `Intestinal villus`: INTESTINAL VILLUS
  - `Intraglandular deep parotid lymph nodes`: INTRAGLANDULAR DEEP PAROTID LYMPH NODES
  - `Intrajugular process of temporal bone`: INTRAJUGULAR PROCESS OF TEMPORAL BONE
  - `Intralaminar nuclei of thalamus`: INTRALAMINAR NUCLEI OF THALAMUS
  - `Intrinsic auicular muscles`: INTRINSIC AURICULAR MUSCLES
  - `Inverse kinematics`: INVERSE KINEMATICS
  - `Iris folding`: IRIS FOLDING
  - `Iris sphincter muscle`: IRIS SPHINCTER MUSCLE
  - `Irregular bone`: IRREGULAR BONE
  - `Isthmus of cingulate gyrus`: ISTHMUS OF CINGULATE GYRUS
  - `Jejunal arteries`: JEJUNAL ARTERIES
  - `Jejunal veins`: JEJUNAL VEINS
  - `Jugular foramen`: JUGULAR FORAMEN
  - `Jugular fossa`: JUGULAR FOSSA
  - `Jugular notch of temporal bone`: JUGULAR NOTCH OF TEMPORAL BONE
  - `Jugular tubercle`: JUGULAR TUBERCLE
  - `Jugular vein`: JUGULAR VEIN
  - `Jugulo-omohyoid lymph node`: JUGULO-OMOHYOID LYMPH NODE
  - `Jugulo-omohyoid node`: JUGULO-OMOHYOID NODE
  - `Knee`: KNEE
  - `Labia minora`: LABIA MINORA
  - `Labial glands`: LABIAL GLANDS
  - `Labial surface of tooth`: LABIAL SURFACE OF TOOTH
  - `Labyrinthine artery`: LABYRINTHINE ARTERY
  - `Lacrimal bone-labels`: LACRIMAL BONE
  - `Lacrimal caruncle`: LACRIMAL CARUNCLE
  - `Lacrimal nerve`: LACRIMAL NERVE
  - `Lactiferous duct`: LACTIFEROUS DUCT
  - `Lambda`: LAMBDA
  - `Lamina terminalis`: LAMINA TERMINALIS
  - `Laryngeal cavity`: LARYNGEAL CAVITY
  - `Laryngeal inlet`: LARYNGEAL INLET
  - `Laryngeal saccules`: LARYNGEAL SACCULES
  - `Laryngeal ventricle`: LARYNGEAL VENTRICLE
  - `Laryngeal vestibule`: LARYNGEAL VESTIBULE
  - `Lateral basal segmental bronchus of left lung (BIX)`: LATERAL BASAL SEGMENTAL BRONCHUS OF LEFT LUNG (BIX)
  - `Lateral collateral ligament of ankle joint`: LATERAL COLLATERAL LIGAMENT OF ANKLE JOINT
  - `Lateral dorsal nucleus of thalamus`: LATERAL DORSAL NUCLEUS OF THALAMUS
  - `Lateral external iliac nodes`: LATERAL EXTERNAL ILIAC NODES
  - `Lateral geniculate nucleus`: LATERAL GENICULATE NUCLEUS
  - `Lateral inferior genicular artery`: LATERAL INFERIOR GENICULAR ARTERY
  - `Lateral inguinal fossa`: LATERAL INGUINAL FOSSA
  - `Lateral intermuscular septum`: LATERAL INTERMUSCULAR SEPTUM
  - `Lateral lemniscus`: LATERAL LEMNISCUS
  - `Lateral marginal vein`: LATERAL MARGINAL VEIN
  - `Lateral nasal branch of facial artery`: LATERAL NASAL BRANCH OF FACIAL ARTERY
  - `Lateral occipital sulcus`: LATERAL OCCIPITAL SULCUS
  - `Lateral palpebral arteries`: LATERAL PALPEBRAL ARTERIES
  - `Lateral part of the occipital bone`: LATERAL PART OF THE OCCIPITAL BONE
  - `Lateral posterior nucleus of thalamus`: LATERAL POSTERIOR NUCLEUS OF THALAMUS
  - `Lateral reticular nucleus`: LATERAL RETICULAR NUCLEUS
  - `Lateral sacral artery`: LATERAL SACRAL ARTERY
  - `Lateral superior genicular artery`: LATERAL SUPERIOR GENICULAR ARTERY
  - `Lateral umbilical fold`: LATERAL UMBILICAL FOLD
  - `Lateral vestibular nucleus`: LATERAL VESTIBULAR NUCLEUS
  - `Layer-as-list`: import bpy
  - `Left anterior descending artery`: LEFT ANTERIOR DESCENDING ARTERY
  - `Left atrioventricular orifice`: LEFT ATRIOVENTRICULAR ORIFICE
  - `Left border of heart`: LEFT BORDER OF HEART
  - `Left bundle branch block`: LEFT BUNDLE BRANCH BLOCK
  - `Left colic vein`: LEFT COLIC VEIN
  - `Left gastric nodes`: LEFT/RIGHT GASTRIC NODES
  - `Left gastric vein`: LEFT GASTRIC VEIN
  - `Left superior intercostal veins`: SUPERIOR INTERCOSTAL VEINS
  - `Left triangular ligament`: LEFT TRIANGULAR LIGAMENT
  - `Leg`: LEG
  - `Lenticular fasciculus`: LENTICULAR FASCICULUS
  - `Lenticulostriate arteries`: LENTICULOSTRIATE ARTERIES
  - `Lesser occipital nerve`: LESSER OCCIPITAL NERVE
  - `Lesser palatine arteries`: LESSER PALATINE ARTERIES
  - `Lesser palatine canals`: LESSER PALATINE CANALS
  - `Lesser palatine foramina`: LESSER PALATINE FORAMINA
  - `Lesser palatine nerve`: LESSER PALATINE NERVE
  - `Lesser petrosal nerve`: LESSER PETROSAL NERVE
  - `Lesser tympanic spine`: LESSER TYMPANIC SPINE
  - `Levator veli palatini`: LEVATOR VELI PALATINI
  - `Ligamentum arteriosum`: LIGAMENTUM ARTERIOSUM
  - `Ligamentum venosum`: LIGAMENTUM VENOSUM
  - `Limbus of cornea`: LIMBUS OF CORNEA
  - `Limen insulae`: LIMEN INSULAE
  - `Limen nasi`: LIMEN NASI
  - `Lingual artery`: LINGUAL ARTERY
  - `Lingual branches of glossopharyngeal nerve`: LINGUAL BRANCHES OF GLOSSOPHARYNGEAL NERVE
  - `Lingual nodes`: LINGUAL NODES
  - `Lingual papillae`: LINGUAL PAPILLAE
  - `Lingual septum`: LINGUAL SEPTUM
  - `Lingual tonsils`: LINGUAL TONSILS
  - `Lingula of mandible`: LINGULA OF MANDIBLE
  - `List of regions in the human brain`: LIST OF REGIONS IN THE HUMAN BRAIN
  - `List_3D`: Obj 
  - `List_Definitions`: Def 
  - `List_labels`: Labl 
  - `ListCreator.py`: import bpy
  - `Little finger`: LITTLE FINGER
  - `Lobules of testis`: LOBULES OF TESTIS
  - `Locus coeruleus`: LOCUS COERULEUS
  - `Long bone`: LONG BONE
  - `Long ciliary nerves`: LONG CILIARY NERVES
  - `Lower limb`: LOWER LIMB
  - `Lower lip`: LIP
  - `Lumbar ganglia`: LUMBAR GANGLIA
  - `Lumbar splanchnic nerves`: LUMBAR SPLANCHNIC NERVES
  - `Lumbar triangle`: LUMBAR TRIANGLE
  - `Lumbosacral trunk`: LUMBOSACRAL TRUNK
  - `Lymph`: LYMPH
  - `Lymph capillary`: LYMPH CAPILLARY
  - `Lymphatic system`: LYMPHATIC SYSTEM
  - `Lymphatic vessel`: LYMPHATIC VESSEL
  - `Macula`: MACULA (OF RETINA)
  - `Macula of saccule`: MACULA OF SACCULE
  - `Magnus raphe nucleus`: MAGNUS RAPHE NUCLEUS
  - `Major duodenal papilla`: MAJOR DUODENAL PAPILLA
  - `Malar node`: MALAR NODE
  - `Mammary gland`: MAMMARY GLAND
  - `Mammary ridge`: MAMMARY RIDGE
  - `Mammillary body`: MAMMILLARY BODY
  - `Mandibular canal`: MANDIBULAR CANAL
  - `Mandibular fossa`: MANDIBULAR FOSSA
  - `Mandibular lymph node`: MANDIBULAR LYMPH NODE
  - `Mandibular notch`: MANDIBULAR NOTCH
  - `Marginal mandibular branch of the facial nerve`: MARGINAL MANDIBULAR BRANCH OF THE FACIAL NERVE
  - `Masseteric artery`: MASSETERIC ARTERY
  - `Masseteric nerve`: MASSETERIC NERVE
  - `Mastoid antrum`: MASTOID ANTRUM
  - `Mastoid canaliculus`: MASTOID CANLICULUS
  - `Mastoid cells`: MASTOID CELLS
  - `Mastoid foramen`: MASTOID FORAMEN
  - `Mastoid part of the temporal bone`: MASTOID PART OF THE TEMPORAL BONE
  - `Maxilla-labels`: MAXILLA
  - `Maxillary hiatus`: MAXILLARY HIATUS
  - `Maxillary sinus`: MAXILLARY SINUS
  - `Maxillary tuberosity`: MAXILLARY TUBEROSITY
  - `Medial basal segmental bronchus of right lung (BVII)`: MEDIAL BASAL SEGMENTAL BRONCHUS OF RIGHT LUNG (BVII)
  - `Medial collateral artery`: MEDIAL COLLATERAL ARTERY
  - `Medial dorsal nucleus`: MEDIAL DORSAL NUCLEUS
  - `Medial forebrain bundle`: MEDIAL FOREBRAIN BUNDLE
  - `Medial geniculate nucleus`: MEDIAL GENICULATE NUCLEUS
  - `Medial inferior genicular artery`: MEDIAL INFERIOR GENICULAR ARTERY
  - `Medial inguinal fossa`: MEDIAL INGUINAL FOSSA
  - `Medial lemniscus`: MEDIAL LEMNISCUS
  - `Medial palpebral arteries`: MEDIAL PALPEBRAL ARTERIES
  - `Medial palpebral ligament`: MEDIAL PALPEBRAL LIGAMENT
  - `Medial patellofemoral ligament`: MEDIAL PATELLOFEMORAL LIGAMENT
  - `Medial superior genicular artery`: MEDIAL SUPERIOR GENICULAR ARTERY
  - `Medial tarsal arteries`: MEDIAL TARSAL ARTERIES
  - `Medial umbilical ligament`: MEDIAL UMBILICAL LIGAMENT
  - `Median eminence`: MEDIAN EMINENCE
  - `Median raphe nucleus`: MEDIAN RAPHE NUCLEUS
  - `Median sacral vein`: MEDIAN SACRAL VEIN
  - `Mediastinal lymph node`: MEDIASTINAL LYMPH NODE
  - `Mediastinum`: MEDIASTINUM
  - `Mediastinum testis`: MEDIASTINUM TESTIS
  - `Medullary cavity`: MEDULLARY CAVITY
  - `Medullary laminae of thalamus`: MEDULLARY LAMINAE OF THALAMUS
  - `Medullary striae of fourth ventricle`: MEDULLARY STRIAE OF FOURTH VENTRICLE
  - `Membranous bone`: MEMBRANOUS BONE
  - `Membranous labyrinth`: MEMBRANOUS LABYRINTH
  - `Membranous part of nasal septum`: MEMBRANOUS PART OF NASAL SEPTUM
  - `Membranous urethra`: MEMBRANOUS URETHRA
  - `Meningeal branches of vertebral artery`: MENINGEAL BRANCHES OF VERTEBRAL ARTERY
  - `Mental disorder`: MENTAL DISORDER
  - `Mesocolic nodes`: MESOCOLIC NODES
  - `Mesometrium`: MESOMETRIUM
  - `Mesosalpinx`: MESOSALPINX
  - `Mesovarium`: MESOVARIUM
  - `Metaphysis`: METAPHYSIS
  - `Metatarsalgia`: METATARSALGIA
  - `Midcarpal joint`: MIDCARPAL JOINT
  - `Middle cerebral artery`: MIDDLE CEREBRAL ARTERY
  - `Middle cervical ganglion`: MIDDLE CERVICAL GANGLION
  - `Middle cranial fossa`: MIDDLE CRANIAL FOSSA
  - `Middle finger`: MIDDLE FINGER
  - `Middle nasal concha`: MIDDLE NASAL CONCHA
  - `Middle phalanx of hand`: MIDDLE PHALANX OF HAND
  - `Middle superior alveolar nerve`: MIDDLE SUPERIOR ALVEOLAR NERVE
  - `Middle suprarenal arteries`: MIDDLE SUPRARENAL ARTERIES
  - `Middle temporal artery`: MIDDLE TEMPORAL ARTERY
  - `Minor duodenal papilla`: MINOR DUODENAL PAPILLA
  - `Mirror&Rename.l`: bpy.ops.object.duplicate_move_linked(OBJECT_OT_duplicate={"linked":True, "mode":'TRANSLATION'}, TRAN
  - `Mixed nerve`: MIXED NERVE (From 'spinal nerve')
  - `Mons pubis`: MONS PUBIS
  - `Mucosa of stomach`: MUCOSA OF STOMACH/
  - `Muscular artery`: MUSCULAR ARTERY
  - `Muscular branches of superficial fibular nerve`: MUSCULAR BRANCHES OF SUPERFICIAL FIBULAR NERVE
  - `Muscular layer`: MUSCULAR LAYER
  - `Muscular part of muscular system`: CRANIAL PART OF MUSCULAR SYSTEM
  - `Musculotubal canal`: MUSCULOTUBAL CANAL
  - `Myenteric plexus`: MYENTERIC PLEXUS
  - `Myometrium`: MYOMETRIUM
  - `Nail`: NAIL
  - `Nasal cavity`: NASAL CAVITY
  - `Nasal glands`: NASAL GLANDS
  - `Nasal meatus`: NASAL MEATUS
  - `Nasal septum`: NASAL SEPTUM
  - `Nasociliary nerve`: NASOCILIARY NERVE
  - `Nasolacrimal canal`: NASOLACRIMAL CANAL
  - `Nasopalatine nerve`: NASOPALATINE NERVE
  - `Navicular fossa of male urethra`: NAVICULAR FOSSA OF MALE URETHRA
  - `Neck`: NECK
  - `Neck of bladder`: NECK OF BLADDER
  - `Neocortex`: NEOCORTEX
  - `Nerve`: NERVE
  - `Nerve fascicle`: NERVE FASCICLE
  - `Nerve plexus`: NERVE PLEXUS
  - `Nerve root`: NERVE ROOT
  - `Nerve to tensor veli palatini`: NERVE TO TENSOR VELI PALATINI
  - `Nerves`: NERVE
  - `Neurocranial part of head`: NEUROCRANIUM
  - `Neurovascular bundle`: NEUROVASCULAR BUNDLE
  - `Nipple`: NIPPLE
  - `Node of anterior border of omental foramen`: NODE OF ANTERIOR BORDER OF OMENTAL FORAMEN
  - `Nostril`: NOSTRIL
  - `Nuchal lines`: NUCHAL LINES
  - `Nucleus basalis`: NUCLEUS BASALIS
  - `Nucleus prepositus`: NUCLEUS PREPOSITUS
  - `Nucleus propius`: NUCLEUS PROPIUS
  - `Nucleus proprius of spinal cord`: NUCLEUS PROPRIUS OF SPINAL CORD
  - `Nucleus raphe obscurus`: NUCLEUS RAPHE OBSCURUS
  - `Nucleus raphe pallidus`: NUCLEUS RAPHE PALLIDUS
  - `Nutrient artery`: NUTRIENT ARTERY
  - `Nutrient canal`: NUTRIENT CANAL
  - `Nutrient foramen`: NUTRIENT FORAMEN
  - `Obex`: OBEX
  - `obj_list`: @ Posterior transverse collateral sulcus.l@
  - `Oblique muscle of auricle`: OBLIQUE MUSCLE OF AURICLE
  - `Oblique vein of left atrium`: OBLIQUE VEIN OF LEFT ATRIUM
  - `Oblique vein of the left atrium`: OBLIQUE VEIN OF THE LEFT ATRIUM
  - `Obliquus capitis inferior muscle`: OBLIQUUS CAPITIS INFERIOR MUSCLE
  - `Obliquus capitis superior muscle`: OBLIQUUS CAPITIS SUPERIOR MUSCLE
  - `Obturator internus muscle`: OBTURATOR INTERNUS MUSCLE
  - `Obturator veins`: OBTURATOR VEINS
  - `Occipital bone-labels`: OCCIPITAL BONE
  - `Occipital branch of posterior auricular artery`: OCCIPITAL BRANCH OF POSTERIOR AURICULAR ARTERY
  - `Occipital branches of occipital artery`: OCCIPITAL BRANCHES OF OCCIPITAL ARTERY
  - `Occipital lymph nodes`: OCCIPITAL LYMPH NODES
  - `Occipital triangle`: OCCIPITAL TRIANGLE
  - `Occiput`: OCCIPUT
  - `Occlusal surface`: OCCLUSION (DENTISTRY)
  - `Olfactory bulb`: OLFACTORY BULB
  - `Olfactory epithelium`: OLFACTORY EPITHELIUM
  - `Olfactory glands`: OLFACTORY GLANDS
  - `Olfactory system`: OLFACTORY SYSTEM
  - `Olfactory tract`: OLFACTORY TRACT
  - `Olfactory trigone`: OLFACTORY TRIGONE
  - `Olivocochlear system`: OLIVOCOCHLEAR SYSTEM
  - `Omental foramen`: OMENTAL FORAMEN
  - `Opening of cochlear canaliculus`: OPENING OF COCHLEAR CANALICULUS
  - `Opening of vestibular canaliculus`: OPENING OF VESTIBULAR CANALICULUS
  - `Optic nerve`: OPTIC NERVE
  - `Optic recess`: OPTIC RECESS
  - `Oral pontine reticular nucleus`: ORAL PONTINE RETICULAR NUCLEUS
  - `Orbit`: ORBIT
  - `Orbital septum`: ORBITAL SEPTUM
  - `Osseous spiral lamina`: OSSEOUS SPIRAL LAMINA
  - `Ossification centers`: OSSIFICATION CENTERS
  - `Otic ganglion`: OTIC GANGLION
  - `Ovarian branch of uterine artery`: OVARIAN BRANCH OF UTERINE ARTERY
  - `Ovarian cortex`: OVARIAN CORTEX
  - `Ovarian follicle`: OVARIAN FOLLICLE
  - `Ovarian fossa`: OVARIAN FOSSA
  - `Ovarian ligament`: OVARIAN LIGAMENT
  - `Ovarian plexus`: OVARIAN PLEXUS
  - `Ovary`: OVARY
  - `Palatine aponeurosis`: PALATINE APONEUROSIS
  - `Palatine bone-labels`: PALATINE BONE
  - `Palatine glands`: PALATINE GLANDS
  - `Palatine nerves`: PALATINE NERVES
  - `Palatine process of maxilla`: PALATINE PROCESS OF MAXILLA
  - `Palatine raphe`: PALATINE RAPHE
  - `Palatine torus`: PALATINE TORUS
  - `Palatoglossal arch`: PALATOGLOSSAL ARCH
  - `Palatoglossus muscle`: PALATOGLOSSUS MUSCLE
  - `Palatopharyngeal arch`: PALATOPHARYNGEAL ARCH
  - `Palatovaginal canal`: PALATOVAGINAL CANAL
  - `Palatovaginal groove`: PALATOVAGINAL GROOVE
  - `Pallium`: PALLIUM
  - `Palmar carpal branch of ulnar artery`: PALMAR CARPAL BRANCH OF ULNAR ARTERY
  - `Palmar intercarpal ligaments`: PALMAR INTERCARPAL LIGAMENTS
  - `Palmar metacarpophalangeal ligaments`: PALMAR METACARPOPHALANGEAL LIGAMENTS
  - `Palmar ulnocarpal ligament`: PALMAR ULNOCARPAL LIGAMENT
  - `Palpebral fissure`: PALPEBRAL FISSURE
  - `Pampiniform plexus`: PAMPINIFORM PLEXUS
  - `Pancreatic cancer`: PANCREATIC CANCER
  - `Pancreatic islets`: PANCREATIC ISLETS
  - `Pancreatic plexus`: PANCREATIC PLEXUS
  - `Pancreatic veins`: PANCREATIC VEINS
  - `Pancreaticoduodenal veins`: PANCREATICODUODENAL VEINS
  - `Parabrachial nuclei`: PARABRACHIAL NUCLEI
  - `Paracolic gutters`: PARACOLIC GUTTERS
  - `Paradidymis`: PARADIDYMIS
  - `Paraganglion`: PARAGANGLION
  - `Parahippocampal gyrus`: PARAHIPPOCAMPAL GYRUS
  - `Paramedian arteries`: PARAMEDIAN ARTERIES
  - `Parametrium`: PARAMETRIUM
  - `Parapharyngeal space`: PARAPHARYNGEAL SPACE
  - `Pararectal fossa`: PARARECTAL FOSSA
  - `Parasternal lymph nodes`: PARASTERNAL LYMPH NODES
  - `Parasympathetic nervous system`: PARASYMPATHETIC NERVOUS SYSTEM
  - `Paraumbilical vein`: PARAUMBILICAL VEIN
  - `Paraventricular nucleus of hypothalamus`: PARAVENTRICULAR NUCLEUS OF HYPOTHALAMUS
  - `Paravesical fossa`: PARAVESICAL FOSSA
  - `Parietal bone-labels`: PARIETAL BONE
  - `Parietal border of temporal bone`: PARIETAL BORDER OF TEMPORAL BONE
  - `Parietal notch`: PARIETAL NOTCH
  - `Paroophoron`: PAROOPHORON
  - `Parotid plexus`: PAROTID PLEXUS
  - `Pars flaccida of tympanic membrane`: PARS FLACCIDA OF TYMPANIC MEMBRANE
  - `Parts of human body`: PARTS OF HUMAN BODY
  - `Parts of the frontal bone`: PARTS OF THE FRONTAL BONE
  - `Parvocellular reticular nucleus`: PARVOCELLULAR RETICULAR NUCLEUS
  - `Pectinate line`: PECTINATE LINE
  - `Pectinate muscles`: PECTINATE MUSCLES
  - `Pelvic splanchnic nerves`: PELVIC SPLANCHNIC NERVES
  - `Pelvis`: PELVIS
  - `Perforator vein`: PERFORATOR VEIN
  - `Periaortic nodes`: PERIAORTIC NODES
  - `Pericardiacophrenic artery`: PERICARDIACOPHRENIC ARTERY
  - `Pericardial sinus`: PERICARDIAL SINUS
  - `Pericardium`: PERICARDIUM
  - `Perichondrium`: PERICHONDRIUM
  - `Pericranium`: PERICRANIUM
  - `Perihypoglossal nuclei`: PERIHYPOGLOSSAL NUCLEI
  - `Perimetrium`: PERIMETRIUM
  - `Perineal artery`: PERINEAL ARTERY
  - `Perineal raphe`: PERINEAL RAPHE
  - `Perineum`: PERINEUM
  - `Perineurium`: PERINEURIUM
  - `Periodontium`: PERIODONTIUM
  - `Periosteum`: PERIOSTEUM
  - `Peripharyngeal space`: PERIPHARYNGEAL SPACE
  - `Peritoneal ligament`: PERITONEAL LIGAMENT
  - `Perpendicular plate of palatine bone`: PERPENDICULAR PLATE OF PALATINE BONE
  - `Pes anserine bursitis`: PES ANSERINE BURSITIS
  - `Petro-occipital fissure`: PETRO-OCCIPITAL FISSURE
  - `Petrosal fossula`: PETROSAL FOSSULA
  - `Petrosquamous fissure`: PETROSQUAMOUS FISSURE
  - `Petrotympanic fissure`: PETROTYMPANIC FISSURE
  - `Petrous part of the temporal bone`: PETROUS PART OF THE TEMPORAL BONE
  - `Petrous ridge`: PETROUS RIDGE
  - `Pharyngeal branches of glossopharyngeal nerve`: PHARYNGEAL BRANCHES OF GLOSSOPHARYNGEAL NERVE
  - `Pharyngeal nerve`: PHARYNGEAL NERVE
  - `Pharyngeal recess`: PHARYNGEAL RECESS
  - `Pharyngobasilar fascia`: PHARYNGOBASILAR FASCIA
  - `Phrenic nerve`: PHRENIC NERVE
  - `Phrenicocolic ligament`: PHRENICOCOLIC LIGAMENT
  - `Piriform aperture`: PIRIFORM APERTURE
  - `Pleural cavity`: PLEURAL CAVITY
  - `Pneumatized bone`: PNEUMATIZED BONE
  - `Pontine nuclei`: PONTINE NUCLEI
  - `Pontine raphe nucleus`: PONTINE RAPHE NUCLEUS
  - `Popliteal lymph nodes`: POPLITEAL LYMPH NODES
  - `Posterior auricular artery`: POSTERIOR AURICULAR ARTERY
  - `Posterior auricular nerve`: POSTERIOR AURICULAR NERVE
  - `Posterior branches of cervical nerves`: POSTERIOR BRANCHES OF CERVICAL NERVES
  - `Posterior cecal artery`: POSTERIOR CECAL ARTERY
  - `Posterior chamber of eyeball`: POSTERIOR CHAMBER OF EYEBALL
  - `Posterior compartment of the forearm`: POSTERIOR COMPARTMENT OF THE FOREARM
  - `Posterior cranial fossa`: POSTERIOR CRANIAL FOSSA
  - `Posterior ethmoidal nerve`: POSTERIOR ETHMOIDAL NERVE
  - `Posterior fontanelle`: POSTERIOR FONTANELLE
  - `Posterior gastric branches of posterior vagal trunk`: POSTERIOR GASTRIC BRANCHES OF POSTERIOR VAGAL TRUNK
  - `Posterior humeral circumflex artery`: POSTERIOR HUMERAL CIRCUMFLEX ARTERY
  - `Posterior labial arteries`: POSTERIOR LABIAL ARTERIES
  - `Posterior lobe of cerebellum`: POSTERIOR LOBE OF CEREBELLUM
  - `Posterior meningeal artery`: POSTERIOR MENINGEAL ARTERY
  - `Posterior meniscofemoral ligament`: POSTERIOR MENISCOFEMORAL LIGAMENT
  - `Posterior nasal spine`: POSTERIOR NASAL SPINE
  - `Posterior scrotal arteries`: POSTERIOR SCROTAL ARTERIES
  - `Posterior spinal artery`: POSTERIOR SPINAL ARTERY
  - `Posterior superior alveolar nerve`: POSTERIOR SUPERIOR ALVEOLAR NERVE
  - `Posterior thoracic nucleus`: POSTERIOR THORACIC NUCLEUS
  - `Posterior tibial vein`: POSTERIOR TIBIAL VEIN
  - `Posterior triangle of the neck`: POSTERIOR TRIANGLE OF THE NECK
  - `Posterior tympanic canaliculus`: POSTERIOR TYMPANIC CANALICULUS
  - `Posterior vagal trunk`: POSTERIOR VAGAL TRUNK
  - `Pre-auricular lymph nodes`: PRE-AURICULAR LYMPH NODES
  - `Precordium`: PRECORDIUM
  - `Prelaryngeal lymph nodes`: PRELARYNGEAL LYMPH NODES
  - `Preoptic area`: PREOPTIC AREA
  - `Preorbita`: PREORBITA
  - `Prepatellar bursa`: PREPATELLAR BURSA
  - `Prepositus nucleus`: PROPOSITUS NUCLEUS
  - `Pretectum`: PRETECTUM
  - `Prevertebral ganglia`: PREVERTEBRAL GANGLIA
  - `Princeps pollicis artery`: PRINCEPS POLLICIS ARTERY
  - `Principal sensory nucleus of trigeminal nerve`: PRINCIPAL SENSORY NUCLEUS OF TRIGEMINAL NERVE
  - `Promontory of tympanic cavity`: PROMONTORY OF TYMPANIC CAVITY
  - `Proper fasciculi`: PROPER FASCICULI
  - `Proper palmar digital nerves of median nerve`: PROPER PALMAR DIGITAL NERVES OF MEDIAN NERVE
  - `Prostatic ducts`: PROSTATIC DUCTS
  - `Prostatic sinus`: PROSTATIC SINUS
  - `Prostatic urethra`: PROSTATIC URETHRA
  - `Prostatic utricle`: PROSTATIC UTRICLE
  - `Proximal phalanx of hand`: PROXIMAL PHALANX OF HAND
  - `Pterygoid fovea`: PTERYGOID FOVEA
  - `Pterygoid processes of the sphenoid`: PTERYGOID PROCESSES OF THE SPHENOID
  - `Pterygopalatine ganglion`: PTERYGOPALATINE GANGLION
  - `Pubic hair`: PUBIC HAIR
  - `Pubocervical ligament`: PUBOCERVICAL LIGAMENT
  - `Pubovesical ligament`: PUBOVESICAL LIGAMENT
  - `Pulmonary artery`: PULMONARY ARTERY
  - `Pulmonary nodes`: PULMONARY NODES
  - `Pulmonary plexus`: PULMONARY PLEXUS
  - `Pulmonary vein`: PULMONARY VEIN
  - `Pulmonary vessels`: PULMONARY CIRCULATION
  - `Pulvinar nuclei`: PULVINAR NUCLEI
  - `Pylorus`: PYLORUS
  - `Pyramidal eminence`: PYRAMIDAL EMINENCE
  - `Pyramidal tract`: PYRAMIDAL TRACT
  - `Pyramidal tracts`: PYRAMIDAL TRACTS
  - `Radial recurrent artery`: RADIAL RECURRENT ARTERY
  - `Radicular artery`: RADICULAR ARTERY
  - `Ramus of mandible`: RAMUS OF MANDIBLE
  - `Rectococcygeal muscle`: RECTOCOCCYGEAL MUSCLE
  - `Rectoprostatic fascia`: RECTOPROSTATIC FASCIA
  - `Rectouterine fold`: RECTOUTERINE FOLD
  - `Rectouterine pouch`: RECTOUTERINE POUCH
  - `Rectovaginal fascia`: RECTOVAGINAL FASCIA
  - `Rectovesical pouch`: RECTOVESICAL POUCH
  - `Rectum`: RECTUM
  - `Rectus capitis posterior major muscle`: RECTUS CAPITIS POSTERIOR MAJOR MUSCLE
  - `Red bone marrow`: RED BONE MARROW
  - `Renal artery`: RENAL ARTERY
  - `Renal column`: RENAL COLUMN
  - `Renal cortex`: RENAL CORTEX
  - `Renal fascia`: RENAL FASCIA
  - `Renal medulla`: RENAL MEDULLA
  - `Renal plexus`: RENAL PLEXUS
  - `Renal vein`: RENAL VEIN
  - `Rete mirabile`: RETE MIRABILE
  - `Rete testis`: RETE TESTIS
  - `Reticulotegmental nucleus`: RETICULOTEGMENTAL NUCLEUS
  - `Retinohypothalamic tract`: RETINOHYPOTHALAMIC TRACT
  - `Retroinguinal space`: RETROINGUINAL SPACE
  - `Retromolar fossa`: RETROMOLAR FOSSA
  - `Retroperitoneal space`: RETROPERITONEAL SPACE
  - `Retropharyngeal lymph nodes`: RETROPHARYNGEAL LYMPH NODES
  - `Retropharyngeal space`: RETROPHARYNGEAL SPACE
  - `Retropubic space`: RETROPUBIC SPACE
  - `Rhomboid fossa`: RHOMBOID FOSSA
  - `Rib cage`: RIB CAGE
  - `Right atrioventricular orifice`: RIGHT ATRIOVENTRICULAR ORIFICE
  - `Right bundle branch block`: RIGHT BUNDLE BRANCH BLOCK
  - `Right gastric vein`: RIGHT GASTRIC VEIN
  - `Right lymphatic duct`: RIGHT LYMPHATIC DUCT
  - `Right superior intercostal veins`: SUPERIOR INTERCOSTAL VEINS
  - `Right triangular ligament`: RIGHT TRIANGULAR LIGAMENT
  - `Rima glottidis`: RIMA GLOTTIDIS
  - `Rima vestibuli`: RIMA VESTIBULI
  - `Ring finger`: RING FINGER
  - `Root canal`: ROOT CANAL
  - `Roots of the ciliary ganglion`: ROOTS OF THE CILIARY GANGLION
  - `Rotator cuff muscle`: ROTATOR CUFF
  - `Round ligament of liver`: ROUND LIGAMENT OF LIVER
  - `Round ligament of uterus`: ROUND LIGAMENT OF UTERUS
  - `Saccular nerve`: SACCULAR NERVE
  - `Saccule`: SACCULE
  - `Sacral ganglia`: SACRAL GANGLIA
  - `Sacral nerves`: SACRAL NERVES
  - `Sacral splanchnic nerves`: SACRAL SPLANCHNIC NERVES
  - `Sagittal plane`: SAGITTAL PLANE
  - `Salivary gland`: SALIVARY GLAND
  - `Salivatory nuclei`: SALIVATORY NUCLEI
  - `Scalp`: SCALP
  - `Scapholunate ligament`: SCAPHOLUNATE LIGAMENT
  - `Script-SwitchCamera`: bl_info = {
  - `Scrotal septum`: SCROTAL SEPTUM
  - `Scrotum`: SCROTUM
  - `Sebaceous gland`: SEBACEOUS GLAND
  - `Segmental medullary artery`: SEGMENTAL MEDULLARY ARTERY
  - `Semicanal for auditory tube`: SEMICANAL FOR AUDITORY TUBE
  - `Semicanal for tensor tympani`: SEMICANAL FOR TENSOR TYMPANI
  - `Semicircular canals`: SEMICIRCULAR CANALS
  - `Semilunar hiatus`: SEMILUNAR HIATUS
  - `Seminal colliculus`: SEMINAL COLLICULUS
  - `Seminiferous tubule`: SEMINIFEROUS TUBULE
  - `Semispinalis capitis muscle`: SEMISPINALIS CAPITIS MUSCLE
  - `Sensory nerve`: SENSORY NERVE
  - `Septa of testis`: SEPTA OF TESTIS
  - `Septum of musculotubal canal`: SEPTUM OF MUSCULOTUBAL CANAL
  - `Septum of the penis`: SEPTUM OF THE PENIS
  - `Sesamoid bone`: SESAMOID BONE
  - `Sheath of styloid process`: SHEATH OF STYLOID PROCESS
  - `SHEET_INPUT`: English
  - `SHEET_OUTPUT`: FALSE FALSE FALSE
  - `Short bone`: SHORT BONE
  - `Short ciliary nerves`: SHORT CILIARY NERVES
  - `Short gastric veins`: SHORT GASTRIC VEINS
  - `Short limb of incus`: SHORT LIMB OF INCUS
  - `Shoulder`: SHOULDER
  - `Sinoatrial node`: SINOATRIAL NODE
  - `Sinus of frontal bone-label`: SINUS OF FRONTAL BONE
  - `Sinus of the frontal bone`: SINUS OF THE FRONTAL BONE
  - `Sinus venosus`: SINUS VENOSUS
  - `Skeleton of upper limb`: SKELETON OF UPPER LIMB
  - `Skin`: SKIN
  - `Skin appendage`: SKIN APPENDAGE
  - `Solitary nucleus`: SOLITARY NUCLEUS
  - `Spermatic cord`: SPERMATIC CORD
  - `Spermatic plexus`: SPERMATIC PLEXUS
  - `Spheno-ethmoidal recess of cranium`: SPHENO-ETHMOIDAL RECESS
  - `Sphenoethmoidal recess`: SPHENOETHMOIDAL RECESS
  - `Sphenoid bone-labels`: SPHENOID BONE
  - `Sphenoid sinus`: SPHENOID SINUS
  - `Sphenoidal concha`: SPHENOIDAL CONCHA
  - `Sphenoidal conchae`: SPHENOIDAL CONCHAE
  - `Sphenoidal emissary foramen`: SPHENOIDAL EMISSARY FORAMEN
  - `Sphenoidal margin of temporal bone`: SPHENOIDAL MARGIN OF TEMPORAL BONE
  - `Sphenoidal process of palatine bone`: SPHENOIDAL PROCESS OF PALATINE BONE
  - `Sphenoidal rostrum`: SPHENOIDAL ROSTRUM
  - `Sphenopalatine artery`: SPHENOPALATINE ARTERY
  - `Sphenopetrosal fissure`: SPHENOPETROSAL FISSURE
  - `Sphincter of pancreatic duct`: SPHINCTER OF PANCREATIC DUCT
  - `Spinal nerve`: SPINAL NERVE
  - `Spinal nucleus of trigeminal nerve`: SPINAL NUCLEUS OF TRIGEMINAL NERVE
  - `Spinal trigeminal nucleus`: SPINAL TRIGEMINAL NUCLEUS
  - `Spino-olivary tract`: SPINO-OLIVARY TRACT
  - `Spinoreticular tract`: SPINORETICULAR TRACT
  - `Spinothalamic tract`: SPINOTHALAMIC TRACT
  - `Spiral limbus`: SPIRAL LIMBUS
  - `Splenic lymph nodes`: SPLENIC LYMPH NODES
  - `Splenic plexus`: SPLENIC PLEXUS
  - `Splenocolic ligament`: SPLENOCOLIC LIGAMENT
  - `Spongy bone`: SPONGY BONE
  - `Spongy urethra`: SPONGY URETHRA
  - `Stapedius muscle`: STAPEDIUS MUSCLE
  - `Sternocostal joints`: STERNOCOSTAL JOINTS
  - `Sternopericardial ligaments`: STERNOPERICARDIAL LIGAMENTS
  - `Sternum-labels`: STERNUM
  - `Stylohyoid branch of facial nerve`: STYLOHYOID BRANCH OF FACIAL NERVE
  - `Stylomastoid artery`: STYLOMASTOID ARTERY
  - `Stylomastoid foramen`: STYLOMASTOID FORAMEN
  - `Stylopharyngeal branch of glossopharyngeal nerve`: STYLOPHARYNGEAL BRANCH OF GLOSSOPHARYNGEAL NERVE
  - `Subarcuate fossa`: SUBARCUATE FOSSA
  - `Subcallosal area`: SUBCALLOSAL AREA
  - `Subclavian artery`: SUBCLAVIAN ARTERY
  - `Subclavian loop`: SUBCLAVIAN LOOP
  - `Subcommissural organ`: SUBCOMMISSURAL ORGAN
  - `Subcostal nerve`: SUBCOSTAL NERVE
  - `Subcutaneous tissue`: SUBCUTANEOUS TISSUE
  - `Subcutaneous tissue of penis`: SUBCUTANEOUS TISSUE OF PENIS
  - `Subfornical organ`: SUBFORNICAL ORGAN
  - `Subiculum`: SUBICULUM
  - `Submandibular fovea`: SUBMANDIBULAR FOVEA
  - `Submandibular ganglion`: SUBMANDIBULAR GANGLION
  - `Submandibular lymph nodes`: SUBMANDIBULAR LYMPH NODES
  - `Submental lymph nodes`: SUBMENTAL LYMPH NODES
  - `Submucosal plexus`: SUBMUCOSAL PLEXUS
  - `Suboccipital nerve`: SUBOCCIPITAL NERVE
  - `Suboccipital venous plexus`: SUBOCCIPITAL VENOUS PLEXUS
  - `Subphrenic abscess`: SUBPHRENIC ABSCESS
  - `Subserosa`: SUBSEROSA
  - `Subtalar joint`: SUBTALAR JOINT
  - `Subthalamic fasciculus`: SUBTHALAMIC FASCICULUS
  - `Subthalamic nucleus`: SUBTHALAMIC NUCLEUS
  - `Subthalamus`: SUBTHALAMUS
  - `Sulcus limitans`: SULCUS LIMITANS
  - `Sulcus terminalis of heart`: SULCUS TERMINALIS OF HEART/
  - `Supercilliary arch`: SUPERCILLIARY ARCH
  - `Superficial circumflex iliac artery`: SUPERFICIAL CIRCUMFLEX ILIAC ARTERY
  - `Superficial palmar branch of radial artery`: SUPERFICIAL PALMAR BRANCH OF RADIAL ARTERY
  - `Superficial parotid lymph nodes`: SUPERFICIAL PAROTID LYMPH NODES
  - `Superficial vein`: SUPERFICIAL VEIN
  - `Superior alveolar artery`: SUPERIOR ALVEOLAR ARTERY
  - `Superior cervical ganglion`: SUPERIOR CERVICAL GANGLION
  - `Superior dental plexus`: SUPERIOR DENTAL PLEXUS
  - `Superior extensor retinaculum of foot`: SUPERIOR EXTENSOR RETINACULUM OF FOOT
  - `Superior ganglion of glossopharyngeal nerve`: SUPERIOR GANGLION OF GLOSSOPHARYNGEAL NERVE
  - `Superior hypogastric plexus`: SUPERIOR HYPOGASTRIC PLEXUS
  - `Superior hypophysial artery`: SUPERIOR HYPOPHYSIAL ARTERY
  - `Superior laryngeal nerve`: SUPERIOR LARYNGEAL NERVE
  - `Superior ligament of epididymis`: SUPERIOR LIGAMENT OF EPIDIDYMIS
  - `Superior medullary velum`: SUPERIOR MEDULLARY VELUM
  - `Superior mesenteric ganglion`: SUPERIOR MESENTERIC GANGLION
  - `Superior mesenteric plexus`: SUPERIOR MESENTERIC PLEXUS
  - `Superior nasal concha`: SUPERIOR NASAL CONCHA
  - `Superior olivary complex`: SUPERIOR OLIVARY COMPLEX
  - `Superior pancreaticoduodenal artery`: SUPERIOR PANCREATICODUODENAL ARTERY
  - `Superior pancreaticoduodenal lymph nodes`: PANCREATICODUODENAL NODES
  - `superior parathyroid gland`: SUPERIOR PARATHYROIF GLAND
  - `Superior tarsal muscle`: SUPERIOR TARSAL MUSCLE
  - `Superior thoracic artery`: SUPERIOR THORACIC ARTERY
  - `Superior thyroid artery`: SUPERIOR THYROID ARTERY
  - `Superior tympanic artery`: SUPERIOR TYMPANIC ARTERY
  - `Superior vesical artery`: SUPERIOR VESICAL ARTERY
  - `Superior vestibular nucleus`: SUPERIOR VESTIBULAR NUCLEUS
  - `Suprachiasmatic nucleus`: SUPRACHIASMATIC NUCLEUS
  - `Supraclavicular nerves`: SUPRACLAVICULAR NERVES
  - `Supramastoid crest`: SUPRAMASTOID CREST
  - `Suprameatal fovea`: SUPRAMEATAL FOVEA
  - `Suprameatal spine`: SUPRAMEATAL SPINE
  - `Supraoptic nucleus`: SUPRAOPTIC NUCLEUS
  - `Supraorbital artery`: SUPRAORBITAL ARTERY
  - `Supraorbital nerve`: SUPRAORBITAL NERVE
  - `Suprapineal recess`: SUPRAPINEAL RECESS
  - `Suprarenal plexus`: SUPRARENAL PLEXUS
  - `Suprarenal veins`: SUPRARENAL VEINS
  - `Suprascapular notch`: SUPRASCAPULAR NOTCH
  - `Supratonsillar fossa`: SUPRATONSILLAR FOSSA
  - `Supratrochlear lymph nodes`: SUPRATROCHLEAR LYMPH NODES
  - `Supratrochlear nerve`: SUPRATROCHLEAR NERVE
  - `Supravaginal portion of cervix`: SUPRAVAGINAL PORTION OF CERVIX
  - `Supravesical fossa`: SUPRAVESICAL FOSSA
  - `Supreme intercostal vein`: SUPREME INTERCOSTAL VEIN
  - `Sural arteries`: SURAL ARTERIES
  - `Suspensory ligament of clitoris`: SUSPENSORY LIGAMENT OF CLITORIS
  - `Suspensory ligament of ovary`: SUSPENSORY LIGAMENT OF OVARY
  - `Suspensory ligament of penis`: SUSPENSORY LIGAMENT OF PENIS
  - `Suspensory muscle of duodenum`: SUSPENSORY MUSCLE OF DUODENUM
  - `Sweat glands`: SWEAT GLANDS
  - `Sympathetic ganglia`: SYMPATHETIC GANGLIA
  - `Sympathetic nervous system`: SYMPATHETIC NERVOUS SYSTEM
  - `Synovial fluid`: SYNOVIAL FLUID
  - `System integration`: SYSTEM INTEGRATION
  - `Taenia thalami`: TAENIA THALAMI
  - `Talocalcaneonavicular joint`: TALOCALCANEONAVICULAR JOINT
  - `Taste bud`: TASTE BUD
  - `Tectorial membrane`: TECTORIAL MEMBRANE
  - `Tela choroidea`: TELA CHOROIDEA
  - `Temple`: TEMPLE
  - `Temporal bone-labels`: TEMPORAL BONE
  - `Temporal branches of the facial nerve`: TEMPORAL BRANCHES OF THE FACIAL NERVE
  - `Temporal surface of temporal bone`: TEMPORAL SURFACE OF TEMPORAL BONE
  - `Tendon sheath of superior oblique muscle`: TENDON SHEATH OF SUPERIOR OBLIQUE MUSCLE
  - `Tensor tympani muscle`: TENSOR TYMPANI MUSCLE
  - `Tensor veli palatini muscle`: TENSOR VELI PALATINI MUSCLE
  - `Tentorium cereballi`: TENTORIUM CEREBELLI/
  - `Testicular vein`: TESTICULAR VEIN
  - `Ora serrata`: ORA SERRATA
  - `Brachial lymph nodes`: BRACHIAL LYMPH NODES
  - `Accessory cuneate nucleus`: ACCESSORY CUNEATE NUCLEUS
  - `Medial vestibular nucleus`: MEDIAL VESTIBULAR NUCLEUS
  - `text_list`: (Abdominal part of pectoralis major muscle)
  - `Thalamic fasciculus`: THALAMIC FASCICULUS
  - `The supreme intercostal artery`: SUPREME INTERCOSTAL ARTERY
  - `Thenar eminence`: THENAR EMINENCE
  - `Thigh`: THIGH
  - `Third occipital nerve`: THIRD OCCIPITAL NERVE
  - `Thoracic aortic plexus`: THORACIC AORTIC PLEXUS
  - `Thoracic duct`: THORACIC DUCT
  - `Thoracic ganglia`: THORACIC GANGLIA
  - `Thoracic skeleton-labels`: THORACIC SKELETON
  - `Thoracic splanchnic nerves`: THORACIC SPLANCHNIC NERVES
  - `Thoracic vertebra-labels`: THORACIC VERTEBRA
  - `Thoracoacromial artery`: THORACOACROMIAL ARTERY
  - `Thorax`: THORAX
  - `Thumb`: THUMB
  - `Thyro-arytenoid muscle`: THYRO-ARYTENOID MUSCLE
  - `Toe`: TOE
  - `Tonsillar branch of the facial artery`: TONSILLAR BRANCH OF THE FACIAL ARTERY
  - `Tonsillar branches of glossopharyngeal nerve`: TONSILLAR BRANCHES OF GLOSSOPHARYNGEAL NERVE
  - `Tonsillar fossa`: TONSILLAR FOSSA
  - `Torus tubarius`: TORUS TUBARIUS
  - `Tracheobronchial lymph nodes`: TRACHEOBRONCHIAL LYMPH NODES
  - `Translations`: English;Latin;Français;Español;Portugues
  - `Transverse cervical nerve`: TRANSVERSE CERVICAL NERVE
  - `Transverse folds of rectum`: TRANSVERSE FOLDS OF RECTUM
  - `Transverse metatarsal ligament`: TRANSVERSE METATARSAL LIGAMENT
  - `Transverse muscle of auricle`: TRANSVERSE MUSCLE OF AURICLE
  - `Transverse muscle of the chin`: TRANSVERSE MUSCLE OF THE CHIN
  - `Transverse muscle of tongue`: TRANSVERSE MUSCLE OF TONGUE
  - `Transverse tarsal joint`: TRANSVERSE TARSAL JOINT
  - `Trapezoid body`: TRAPEZOID BODY
  - `Traqueobronchial nodes`: TRAQUEOBRONCHIAL NODES
  - `Traqueobronchial tree`: TRAQUEOBRONCHIAL TREE
  - `Triangular fibrocartilage`: TRIANGULAR FIBROCARTILAGE
  - `Trigeminal impression`: TRIGEMINAL IMPRESSION
  - `Trigeminal motor nucleus`: TRIGEMINAL MOTOR NUCLEUS
  - `Trigone of urinary bladder`: TRIGONE OF URINARY BLADDER
  - `Trochlea of superior oblique`: TROCHLEA OF SUPERIOR OBLIQUE
  - `Trochlear nerve`: TROCHLEAR NERVE
  - `Trochlear nucleus`: TROCHLEAR NUCLEUS
  - `Tubal branch of uterine artery`: TUBAL BRANCH OF UTERINE ARTERY
  - `Tubal tonsil`: TUBAL TONSIL
  - `Tuber cinereum`: TUBER CINEREUM
  - `Tubercle (TA1)`: TUBERCLE
  - `Tuberomammillary nucleus`: TUBEROMAMMILLARY NUCLEUS
  - `Tunica albuginea of testis`: TUNICA ALBUGINEA OF TESTIS
  - `Tunica vaginalis`: TUNICA VAGINALIS
  - `Tympanic cavity`: TYMPANIC CAVITY
  - `Tympanic nerve`: TYMPANIC NERVE
  - `Tympanic notch`: TYMPANIC NOTCH
  - `Tympanic part of the temporal bone`: TYMPANIC PART OF THE TEMPORAL BONE
  - `Tympanic plexus`: TYMPANIC PLEXUS
  - `Tympanic ring`: TYMPANIC RING
  - `Tympanic sulcus`: TYMPANIC SULCUS
  - `Tympanomastoid fissure`: TYMPANOMASTOID FISSURE
  - `Tympanosquamous fissure`: TYMPANOSQUAMOUS FISSURE
  - `ui_panel.py`: bl_info = {
  - `Umbilical artery`: UMBILICAL ARTERY
  - `Umbilical vein`: UMBILICAL VEIN
  - `Uncus`: UNCUS
  - `Upper limb`: UPPER LIMB
  - `Ureteric plexus`: URETERIC PLEXUS
  - `Urethral artery`: URETHRAL ARTERY
  - `Urethral crest`: URETHRAL CREST
  - `Urethral sphincters`: URETHRAL SPHINCTERS
  - `Urogenital hiatus`: UROGENITAL HIATUS
  - `Uterine artery`: UTERINE ARTERY
  - `Uterine cavity`: UTERINE CAVITY
  - `Uterine gland`: UTERINE GLAND
  - `Uterine veins`: UTERINE VEINS
  - `Uterine venous plexus`: UTERINE VENOUS PLEXUS
  - `Uterosacral ligament`: UTEROSACRAL LIGAMENT
  - `Uterus`: UTERUS
  - `Utriculosaccular duct`: UTRICULOSACCULAR DUCT
  - `Vagina`: VAGINA
  - `Vaginal artery`: VAGINAL ARTERY
  - `Vaginal fornix`: VAGINAL FORNIX
  - `Vaginal rugae`: VAGINAL RUGAE
  - `Vaginal venous plexus`: VAGINAL VENOUS PLEXUS
  - `Vallecula of cerebellum`: VALLECULA OF CEREBELLUM
  - `Valve of coronary sinus`: VALVE OF CORONARY SINUS
  - `Valve of inferior vena cava`: VALVE OF INFERIOR VENA CAVA
  - `Vascular organ of lamina terminalis`: VASCULAR ORGAN OF LAMINA TERMINALIS
  - `Vein`: VEIN
  - `Vena comitans`: VENA COMITANS
  - `Venous plexus`: VENOUS PLEXUS
  - `Ventral anterior nucleus`: VENTRAL ANTERIOR NUCLEUS
  - `Ventral posterior nucleus`: VENTRAL POSTERIOR NUCLEUS
  - `Ventral posterolateral nucleus`: VENTRAL POSTEROLATERAL NUCLEUS
  - `Ventral posteromedial nucleus`: VENTRAL POSTEROMEDIAL NUCLEUS
  - `Ventral ramus of spinal nerve`: VENTRAL RAMUS OF SPINAL NERVE
  - `Ventral root of spinal nerve`: VENTRAL ROOT OF SPINAL NERVE
  - `Ventromedial nucleus of the hypothalamus`: VENTROMEDIAL NUCLEUS OF THE HYPOTHALAMUS
  - `Venule`: VENULE
  - `Vermian fossa`: VERMIAN FOSSA
  - `Vertebra-labels`: VERTEBRA
  - `Vertex`: VERTEX
  - `Vertical muscle of tongue`: VERTICAL MUSCLE OF TONGUE
  - `Vesicouterine pouch`: VESICOUTERINE POUCH
  - `Vessel`: VESSEL
  - `Vestibular canaliculus`: VESTIBULAR CANLICULUS
  - `Vestibular duct`: VESTIBULAR DUCT
  - `Vestibular fold`: VESTIBULAR FOLD
  - `Vestibular ganglion`: VESTIBULAR GANGLION
  - `Vestibular membrane`: VESTIBULAR MEMBRANE
  - `Vestibular window`: VESTIBULAR WINDOW/
  - `Vestibulocochlear nerve`: VESTIBULOCOCHLEAR NERVE
  - `Vestibulospinal tract`: VESTIBULOSPINAL TRACT
  - `Vocal cords`: VOCAL CORDS
  - `Vocalis muscle`: VOCALIS MUSCLE
  - `Vomeronasal organ`: VOMERONASAL ORGAN
  - `Vomerorostral canal`: VOMEROROSTRAL CANAL
  - `Vomerovaginal canal`: VOMEROVAGINAL CANAL
  - `Vomerovaginal groove`: VOMEROVAGINAL GROOVE
  - `Vulva`: VULVA
  - `Wiki Phrases`: 
  - `Wiki Results`: ===== Wiki download report =====
  - `Wrist`: WRIST
  - `Yellow bone marrow`: YELLOW BONE MARROW
  - `z-anatomy.py`: # This program is free software; you can redistribute it and/or modify
  - `z-script_ImportMultipleObjectsInBlender2.92-script`: # ##### BEGIN GPL LICENSE BLOCK #####
  - `Zona incerta`: ZONA INCERTA
  - `Zonular fibers`: ZONULAR FIBERS
  - `Zygomatic arch`: ZYGOMATIC ARCH
  - `Zygomatic branches of the facial nerve`: ZYGOMATIC BRANCHES OF THE FACIAL NERVE
  - `Zygomatic nerve`: ZYGOMATIC NERVE
  - `Zygomatic process`: ZYGOMATIC PROCESS
  - `Zygomatic process of temporal bone`: ZYGOMATIC PROCESS OF TEMPORAL BONE
  - `Zygomatico-orbital artery`: ZYGOMATICO-ORBITAL ARTERY
  - `Zygomatico-orbital foramina`: ZYGOMATICO-ORBITAL FORAMINA
  - `Zygomaticofacial foramen`: ZYGOMATICOFACIAL FORAMEN
  - `Zygomaticofacial nerve`: ZYGOMATICOFACIAL NERVE
  - `Zygomaticotemporal nerve`: ZYGOMATICOTEMPORAL NERVE

Sample `(Abdominal part of pectoralis major muscle)`:

```


(ABDOMINAL PART OF PECTORALIS MAJOR)


The more frequent variations include greater or less extent of attachment to the ribs and sternum, varying size of the abdominal part or its absence, greater or less extent of separation of sternocostal and clavicular parts, fusion of clavicular part with deltoid, and decussation in front of the sternum. 



https://en.wikipedia.org/wiki/Pectoralis_major
```

Sample `(Adductor minimus)`:

```


(ADDUCTOR MINIMUS)


Small and flat skeletal muscle in the thigh which constitutes the upper, lateral part of the adductor magnus muscle. 

It adducts and laterally rotates the femur.

The adductor minimus originates on the pelvis at the inferior ramus of the pubis as the anterior-most part of the adductor magnus. 

It is inserted on the back of the femur at the medial lip of the linea aspera and thus crosses the proximal part of the true adductor magnus.


=== Innervation ===

    -obturator 
```

### Embedded licence text (`1.Licence`)

```
This file is a mixed and modified version of several open source files. 
Most of it comes from two different files made by "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"
https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html


With regard to this database, you are licensed to:

    freely access part or whole of this database, and acquire data;
    freely redistribute part or whole of the data from this database; and
    freely create and distribute database and other derivative works based on part or whole of the data from this database,

under the license, as long as you comply with the following conditions:

    You must attribute this database in the manner specified by the author or licensor when distributing part or whole of this database or any derivative work.
    You must distribute any derivative work based on part or whole of the data from this database under the license.
    You need to contact the Licensor shown below to request a license for use of this database or any part thereof not licensed under the license.

The contribution of 'Z-anatomy' has been to
-repair the meshes (they should all be 'watertight')
-reduce the weight of the files (cleaning; cloning symmetrical structures)
-rename and organize the anatomical structures according to the 'Terminologia Anatomica-2d edition(2019)'
-integrate the structures of the 1st model into the second, when they were missing 
-Add materials
-Add the muscular insertions (of the appendicular skeleton,so far)
-Create a shortcut that gives access to collection through a double Left-clic
---

If you use, share, sell, mix, fix or modify these files; 
please be sure attribute these files as follows:
"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan"
mixed and modified by 'Z-anatomy.com'
```

## Labels and leader lines

- {'labels': 1660, 'withParent': 1657, 'parentType:MESH': 1191, 'withLeaderLineChild': 1228, 'baseMatchesStructure': 717, 'parentType:FONT': 461, 'parentSameBase': 29, 'parentType:CURVE': 5}
- leader lines: {'verts:2': 1221, 'parentType:FONT': 1228, 'verts:4': 6, 'verts:9': 1}
  - {'label': '(Canal for vertebral artery).t', 'parent': 'Atlas (C1)', 'children': ['(Canal for vertebral artery).j']}
  - {'label': '(External occipital crest).t', 'parent': 'Occipital bone', 'children': ['(External occipital crest).j']}
  - {'label': '(Internal occipital crest).t', 'parent': 'Occipital bone', 'children': ['(Internal occipital crest).j']}
  - {'label': '(Mandibular symphysis).t', 'parent': 'Mandible', 'children': ['(Mandibular symphysis).j']}
  - {'label': '(Middle clinoid process).t', 'parent': 'Sphenoid bone', 'children': ['(Middle clinoid process).j']}

## Custom properties

- **MESH**:
  - `comic_shader` ×4569 sample=false
  - `key_color` ×4569 sample=false
  - `Cross-section-X` ×4513 sample=1
  - `Cross-section-X-inverse` ×4513 sample=0
  - `Cross-section-Z` ×4508 sample=1
  - `Cross-section-Z-inverse` ×4508 sample=0
  - `Cross-section-Y` ×4494 sample=1
  - `Cross-section-Y-inverse` ×4494 sample=0
  - `muscle_color` ×4432 sample=0
  - `M3` ×2392 sample={}
  - `SheetGenerator` ×1268 sample={}
  - `MeasureItArchProps` ×472 sample={}
  - `BIMObjectProperties` ×156 sample={}
  - `hops` ×140 sample={}
  - `MeasureGenerator` ×45 sample=[{"measureit_segments": [], "measureit_num": 0}]
  - `BoolToolRoot` ×12 sample=1
  - `background` ×11 sample=0
  - `theme` ×11 sample=0
  - `BoolToolBrush` ×7 sample="DIFFERENCE"
  - `BoolTool_FTransform` ×7 sample="False"
  - `TLM_ObjectProperties` ×1 sample={}
  - `cycles_visibility` ×1 sample={"camera": 0, "diffuse": 0, "glossy": 0, "shadow": 0, "transmission": 0, "scatter": 0}
- **CURVE**:
  - `comic_shader` ×951 sample=false
  - `key_color` ×951 sample=false
  - `muscle_color` ×950 sample=0
  - `Cross-section-X` ×949 sample=1
  - `Cross-section-Y` ×949 sample=1
  - `Cross-section-Z` ×949 sample=1
  - `Cross-section-X-inverse` ×949 sample=0
  - `Cross-section-Y-inverse` ×949 sample=0
  - `Cross-section-Z-inverse` ×949 sample=0
  - `M3` ×858 sample={}
  - `SheetGenerator` ×33 sample={}
  - `MeasureItArchProps` ×7 sample={}
  - `background` ×1 sample=0
- **FONT**:
  - `comic_shader` ×1660 sample=false
  - `Cross-section-X` ×1645 sample=1
  - `Cross-section-X-inverse` ×1645 sample=0
  - `Cross-section-Z` ×1645 sample=1
  - `Cross-section-Z-inverse` ×1645 sample=0
  - `Cross-section-Y` ×1642 sample=1
  - `Cross-section-Y-inverse` ×1642 sample=0
  - `background` ×1444 sample=0
  - `theme` ×1444 sample=0
  - `key_color` ×109 sample=false
  - `muscle_color` ×9 sample=0
  - `M3` ×1 sample={}
- **LIGHT**:
  - `M3` ×3 sample={}
  - `SheetGenerator` ×3 sample={}
  - `comic_shader` ×3 sample=false
  - `muscle_color` ×3 sample=0
  - `Cross-section-X` ×3 sample=1
  - `Cross-section-Y` ×3 sample=1
  - `Cross-section-Z` ×3 sample=1
  - `Cross-section-X-inverse` ×3 sample=0
  - `Cross-section-Y-inverse` ×3 sample=0
  - `Cross-section-Z-inverse` ×3 sample=0
  - `key_color` ×3 sample=false
- **CAMERA**:
  - `BIMObjectProperties` ×1 sample={}
  - `comic_shader` ×1 sample=false

Modifiers: {'MESH:SOLIDIFY': 1308, 'MESH:SUBSURF': 1241, 'MESH:HOOK': 1076, 'MESH:MIRROR': 42, 'MESH:ARRAY': 30, 'MESH:CURVE': 30, 'MESH:SKIN': 20, 'CURVE:SUBSURF': 8, 'MESH:BOOLEAN': 8, 'MESH:NODES': 7, 'CURVE:SOLIDIFY': 3, 'CURVE:MIRROR': 2, 'MESH:WIREFRAME': 2, 'MESH:DECIMATE': 1}

## Materials

188 materials. Top 40 by users:

| material | users | hex | blend |
|---|---|---|---|
| Text | 1284 | #e7e7e7 | HASHED |
| Tendon | 245 | #f7e8e7 | HASHED |
| Artery | 235 | #e56f6f | HASHED |
| Cartilage | 210 | #d9cec7 | HASHED |
| Ligament | 193 | #e7fffc | HASHED |
| Vein | 134 | #7873e5 | HASHED |
| Skin-in | 123 | #dd9788 | HASHED |
| Brain-Inner | 68 | #f3cbb1 | HASHED |
| Skin-2 | 53 | #e7e7e7 | HASHED |
| Bursa | 39 | #23bacd | BLEND |
| End-Extension | 37 | #e7e7e7 | HASHED |
| Articular capsule | 35 | #c5b5e7 | HASHED |
| Skin-1 | 35 | #e7e7e7 | HASHED |
| Abductor | 31 | #e7e7e7 | HASHED |
| Fascia | 31 | #b8dde7 | BLEND |
| White matter | 30 | #bebebe | HASHED |
| Bone-1 | 28 | #e7e7e7 | HASHED |
| Lymph-1 | 28 | #e7e7e7 | HASHED |
| Pulmonary artery | 28 | #a783e5 | HASHED |
| Adductor | 27 | #e7e7e7 | HASHED |
| Nerve-1 | 27 | #e7e7e7 | HASHED |
| Skin-3 | 27 | #e7e7e7 | HASHED |
| Skin-5 | 26 | #e7e7e7 | HASHED |
| Origin-Abduction | 25 | #e7e7e7 | HASHED |
| Extension | 24 | #e7e7e7 | HASHED |
| Frontal lobe | 24 | #e7e7e7 | HASHED |
| Nerve-2 | 24 | #e7e7e7 | HASHED |
| Origin-Adduction | 24 | #e7e7e7 | HASHED |
| Skin-7 | 24 | #e7e7e7 | HASHED |
| End-Extension fingers | 23 | #e7e7e7 | HASHED |
| End-Flexion fingers | 23 | #e7e7e7 | HASHED |
| Bone | 22 | #e7e7e7 | HASHED |
| Flexion | 22 | #e7e7e7 | HASHED |
| Cerebellum | 21 | #9f7154 | HASHED |
| End-Abduction | 21 | #e7e7e7 | HASHED |
| Gland | 21 | #e78c66 | HASHED |
| Nucleus | 21 | #bb7036 | HASHED |
| Pulmonary vein | 21 | #e58597 | HASHED |
| Skin-8 | 21 | #e7e7e7 | HASHED |
| External rotation | 20 | #e7e7e7 | HASHED |

## Orientation and scale

- verdict: {'upAxis': '+Z', 'heightSource': 1.6963, 'patientLeft': '+X', 'anterior': '-Y', 'checks': [{'structure': 'liver', 'x': -0.0109, 'expected': 'right', 'ok': True}, {'structure': 'spleen', 'x': 0.0848, 'expected': 'left', 'ok': True}, {'structure': 'stomach', 'x': 0.0383, 'expected': 'left', 'ok': True}, {'structure': 'leftVentricle', 'x': 0.0424, 'expected': 'left', 'ok': True}]}
- anatomical geometry bbox (source units): {'min': [-0.3401, -0.1544, -0.0004], 'max': [0.3401, 0.1659, 1.7433], 'extent': [0.6802, 0.3203, 1.7437]}
- skeleton bbox (source units): {'min': [-0.3346, -0.1373, 0.0092], 'max': [0.3346, 0.1128, 1.7055], 'extent': [0.6692, 0.2501, 1.6963]}
- longest skeleton axis: Z
- `.l` / `.r` x statistics: {'.l': {'count': 1350, 'meanX': 0.09, 'fractionPositiveX': 0.9985}, '.r': {'count': 1352, 'meanX': -0.0896, 'fractionPositiveX': 0.0022}}
- wrong-side outliers: 5 [{'name': 'Eyelashes.l', 'x': -0.0322}, {'name': 'Eyelashes.r', 'x': 0.0322}, {'name': 'Lateral temporomandibular ligament.l', 'x': -0.0532}, {'name': 'Lateral temporomandibular ligament.r', 'x': 0.0532}, {'name': 'Vagus nerve (X).r', 'x': 0.0204}]
- liver: Liver @ [-0.0109, -0.0227, 1.1741]
- heart: 
- apexOfHeart: 
- leftVentricle: Left ventricle @ [0.0424, -0.0281, 1.2817]
- spleen: Spleen @ [0.0848, 0.0044, 1.1615]
- stomach: Stomach @ [0.0383, -0.0362, 1.1663]
- nasalBone: Nasal bone.l @ [0.0042, -0.0898, 1.5894]; Nasal bone.r @ [-0.0042, -0.0898, 1.5894]
- occipitalBone: Occipital bone @ [-0.0, 0.0455, 1.603]
- frontalBone: Frontal bone @ [-0.0, -0.0526, 1.6459]
- sternum: Body of sternum @ [0.0, -0.1, 1.2993]; Manubrium of sternum @ [-0.0001, -0.0577, 1.3769]
- patella: Patella.l @ [0.0844, -0.0073, 0.4443]; Patella.r @ [-0.0844, -0.0073, 0.4443]
- calcaneus: Calcaneus.l @ [0.0785, 0.0537, 0.037]; Calcaneus.r @ [-0.0785, 0.0537, 0.037]
- femur: Femur.i @ [0.0019, 0.0, -0.0002]; Femur.l @ [0.0902, 0.0203, 0.6571]; Femur.r @ [-0.0902, 0.0203, 0.6571]
- aorta: Ascending aorta @ [0.0112, -0.0243, 1.3358]

## Non-commercial candidates (keyword match, needs confirmation)

- **innerEar (CC BY-NC-SA 4.0, Univ. of Dundee)**: 4 objects; collections {'7: Nervous system & Sense organs': 4, 'Head': 4, 'Sense organs': 4, 'Cochlea': 2, 'Vestibule': 2}
  - ['Cochlea.l', 'Cochlea.r', 'Vestibule.l', 'Vestibule.r']
- **kidney (CC BY-NC 4.0, Lissie Cowley)**: 8 objects; collections {'Trunk': 8, '5: Cardiovascular system': 4, '8: Visceral systems': 4, 'Abdomen': 4, 'Urinary system': 4, 'Aorta': 2, 'Systemic arteries': 2, 'Systemic veins': 2}
  - ['Intrarenal arteries of left kidney', 'Intrarenal arteries of right kidney', 'Intrarenal veins of left kidney', 'Intrarenal veins of right kidney', 'Kidney.l', 'Kidney.r', 'Renal pelvis.l', 'Renal pelvis.r']

