# Contributing

Thank you for helping. The project needs two kinds of contribution most:

1. **Anatomy review** by people with anatomy training (medical students in their clinical years, anatomists,
   physicians). This covers checking definitions and reporting wrong sides, names or positions.
2. **Code**: the viewer, the UI, the asset pipeline and tests.

Three ground rules apply to everything:

- Never invent anatomical data, names or definitions. Never machine-translate anatomical names.
- Errors in the source data are corrected only through reviewed entries in `pipeline/config/`. Each entry needs a
  reason that someone else can check.
- The site stays static: no accounts, no tracking, no cookies, no external requests at runtime.

---

## Reviewing a definition

Definitions come from Wikipedia (CC BY-SA 3.0), via Z-Anatomy. The app marks every definition **"Unreviewed"**
until a person has checked it. A review is stored in `pipeline/config/definition-reviews.json` together with a hash
of the exact text you read. If that text later changes upstream, the definition goes back to "Unreviewed" until
someone checks it again.

You need the built assets (README, steps 1–3).

**1. Find the definition key.** It has the form `<system>/<definitionKey>`:

```bash
npm run review:definition -- --find femur
# skeletal/femur              not reviewed  Os femoris / Femur
# skeletal/head-of-femur      not reviewed  Caput ossis femoris / Head of femur
```

**2. Check the text.** Open the structure in the app (`npm run dev`, then search for it) and read the definition
next to the 3D model. Mark it reviewed only if all of these hold:

- It describes this structure, not a homonym or a neighbour, and does not contradict what the model shows.
- It is anatomically correct as far as it goes. It does not need to be complete.
- Side-specific statements are correct. Most definitions are side-neutral.
- The source link opens the page the text was taken from.

If something is wrong, do **not** mark the definition reviewed, and do not edit the text in this repository: the
text keeps its upstream provenance and licence. Open an issue that quotes the problem and gives your reference
(textbook or atlas, edition, page). The maintainers then report it upstream.

**3. Record the review.**

```bash
npm run review:definition -- skeletal/femur --reviewer "Your Name or handle"
# optional: --note "checked against Gray's Anatomy, 42nd ed., p. 1380"
```

The command prints the exact text you are signing off and writes the entry: reviewer, date, sha256. Your name or
handle becomes public in the repository.

**4. Publish and open a pull request.**

```bash
npm run assets:manifest            # rebuilds the data files; the definition is now "reviewed"
npm run assets:validate            # fails if a "reviewed" flag has no matching review
```

Commit `pipeline/config/definition-reviews.json` only. Generated files under `public/models/` are not committed. In
the pull request, say what you checked against. One reviewer per definition is enough.

To see progress, including stale reviews (text changed since the review), run:

```bash
npm run review:definition -- --status
```

## Reporting a wrong side, name or position

Open an issue with:

- the structure id: select the structure and copy it from the URL (`?s=<id>`), or use "Copy link";
- what is wrong and what it should be;
- your evidence: a reference, plus a screenshot from the app if it helps.

The data is checked automatically. The build fails if a structure's left/right side disagrees with its geometry,
unless a reviewed entry explains why. Fixes go into `pipeline/config/overrides.json`:

| list | for | applied when |
|---|---|---|
| `sideSwaps` | an object with the wrong `.l`/`.r` suffix upstream | `status: "approved"` |
| `nameFixes` | a spelling error in one name (`from` → `to`, per language) | `status: "approved"`, and only while the upstream text still equals `from` |
| `toReview` | a known upstream problem that is published as named | `status: "accepted"` (validator warning) |

Each entry needs a `reason` with the measurement or the reference. Problems that should be fixed upstream are
collected in [docs/UPSTREAM_ISSUES.md](docs/UPSTREAM_ISSUES.md).

## Code contributions

```bash
npm install
npm run dev                  # works without assets (mock data); real data needs README steps 1–3
npm run typecheck && npm run lint && npm test
npm run test:e2e             # Playwright, desktop + phone, software WebGL
```

- **Architecture, data model and decisions:** [ARCHITECTURE.md](ARCHITECTURE.md). The viewer (`src/viewer/`) and the
  UI (`src/ui/`, `src/quiz/`) talk only through the store contract in `src/contract/`.
- **Commits:** conventional commits (`feat:`, `fix:`, `docs:`, …). Keep a pull request to one topic.
- **UI text:** goes into `src/i18n/en.ts` and `de.ts`. Anatomical names are never translated by us; they come from
  the data.
- **Performance budgets:** ARCHITECTURE.md §9. Check the bundle size in the `npm run build` output.

## Licences of contributions

Code contributions are licensed under MIT ([LICENSE](LICENSE)). Contributions to the data and the configuration under
`pipeline/config/` are licensed under CC BY-SA 4.0 ([assets.LICENSE](assets.LICENSE)). This includes reviews and
corrections.
