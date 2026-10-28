# Research: open exercise datasets for desk-friendly Exercises

Ticket: [#4](https://github.com/agmarco/activityReminder/issues/4). Researched 2026-10-28.

**Question.** Which open exercise datasets or APIs exist? For each one: its license (can it be bundled in the app?), size, attributes (body area, equipment, reps vs duration, seated vs standing), images or animations, and roughly how many entries can be done at or beside a desk with no equipment?

This note does not pick a source. That is a separate grilling ticket. Facts likely to decide that choice are marked **Decisive**.

## Method

- Licenses were read from each project's own LICENSE, NOTICE or README files, or from the license field in the data itself.
- Counts and attribute coverage were measured on the downloaded data on 2026-10-28:
  - free-exercise-db: `dist/exercises.json`.
  - wger: all 939 records from `https://wger.de/api/v2/exerciseinfo/`.
  - RepDB: `exercises.json`.
  - hasaneyldrm: `data/exercises.json`.
  - exercemus: `exercises.json`.
- "Desk-doable" means you can do it standing or seated at or beside a desk, with no equipment. A chair, wall or desk edge counts as allowed support. Floor work, lying down, kneeling, bars, benches and machines are excluded.
- Desk-doable counts are estimates. I first filtered by the equipment field, then filtered out instructions mentioning floor, lying, kneeling or bench, then reviewed the names by hand. Treat them as ±15.

## Summary table

| Source | License (text / media) | Bundle in an app? | Entries | No-equipment entries | Desk-doable (est.) | Media |
|---|---|---|---|---|---|---|
| [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) | Unlicense (public domain) for the whole repo, images included | Yes, no conditions. Provenance caveat below | 876 | 188 (`body only` or null) | ~45–55 | 2 JPGs per exercise (start/end); about 97 MB repo |
| [wger](https://github.com/wger-project/wger) (API at wger.de) | Each entry has its own CC license: CC-BY-SA 4 (781), CC-BY-SA 3 (132), CC0 (26). Images and videos are also licensed per item | Yes, with attribution per entry and share-alike on the data | 939 | 281 tagged bodyweight; 224 have no equipment tag at all | ~60–80 (many duplicated as left/right) | Images on 279 exercises (270 photos, 100 line drawings); videos on 46 |
| [ExerciseDB / AscendAPI](https://github.com/ExerciseDB/exercisedb-api) | Repo code is AGPL-3.0. No open license is stated for the data or media | No. Hosted API only. Free tier exists, terms not readable | 1,500 free / 11,000+ paid | n/a (not downloaded) | n/a | GIFs (180p on the free tier); paid tier adds images and video |
| [RepDB/exercise-dataset](https://github.com/RepDB/exercise-dataset) | Custom "RepDB Free Tier License v1.0" | Yes, inside the app only, with a credits link. Redistributing the dataset is forbidden | 701 | 216 (`is_bodyweight`) | ~30–45 | 512px WebP flat illustrations (AI-generated) with start, peak and main frames |
| [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) | Data under MIT. Media © Gym visual, redistributed by special permission | Text yes. **Media no**, without your own license from Gym visual | 1,324 | 325 (`body weight`) | not measured, similar share | 180×180 JPG and GIF |
| [exercemus/exercises](https://github.com/exercemus/exercises) | MIT for the code. Each entry's `license` field is null for 871 of 872 | Same position as free-exercise-db, whose data it mostly repackages | 872 | 185 | ~45–55 (overlaps free-exercise-db) | None. It has YouTube links |

No dedicated open dataset of desk or office stretches turned up. Every desk-friendly entry has to be filtered out of a general gym dataset.

## Per-source detail

### yuhonas/free-exercise-db

- **License.** The repo is under the Unlicense: "free and unencumbered software released into the public domain… for any purpose, commercial or non-commercial" ([LICENSE.md](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md)). The README calls it an "Open Public Domain Exercise Dataset" and does not license the images separately.
- **Provenance caveat.** The README says the data was restructured from [wrkout/exercises.json](https://github.com/wrkout/exercises.json), which is also Unlicense. Neither repo documents where the original text or photos came from. Public-domain status therefore rests on the upstream author's claim. That is irrelevant for personal use, but worth a look before any store release.
- **Size.** 876 exercises; `dist/exercises.json` is about 1.0 MB; the repo is about 97 MB, mostly images ([README](https://github.com/yuhonas/free-exercise-db#readme)).
- **Schema.** See [schema.json](https://github.com/yuhonas/free-exercise-db/blob/main/schema.json).
  - `id`, `name`.
  - `force`: push, pull or static.
  - `level`: beginner, intermediate or expert.
  - `mechanic`.
  - `equipment`: one value from 12. In the data, `body only` appears 111 times and null 77 times.
  - `primaryMuscles` and `secondaryMuscles`: 17 muscle names, including neck, traps and forearms.
  - `category`: strength 584, stretching 123, plyometrics 61, and others.
  - `instructions`: an array of steps.
  - `images`: paths.
  - There is no body-area field above muscle level, no reps or duration, and no seated or standing flag. The README notes that force, mechanic and equipment are incomplete.
- **Media.** 873 of 876 entries have exactly 2 JPGs, apparently start and end positions. There are no animations.
- **Desk-doable, ~45–55.** Examples:
  - Neck: Side Neck Stretch, Chin To Chest Stretch, Looking At Ceiling, Isometric Neck (×2).
  - Shoulders and arms: Shoulder Circles, Shoulder Raise, Arm Circles, Elbow Circles, Elbows Back, Overhead Stretch, Triceps Stretch, Tricep Side Stretch, Side Wrist Pull, Wrist Circles.
  - Chest and back: Dynamic Chest Stretch, One Arm Against Wall, Chair Lower Back Stretch, Standing Lateral Stretch.
  - Legs and hips: Standing Hip Circles, Standing Hip Flexors, Standing Pelvic Tilt, Calf Stretch Hands Against Wall, Standing Soleus And Achilles Stretch, Bodyweight Squat, Front, Side and Rear Leg Raises (chair-supported), Knee Circles, Ankle Circles.
  - Push-ups: 5 Incline Push-Up variants, which work against a desk edge.

### wger

- **License.**
  - The application code is AGPL-3.0-or-later. "Exercise/Ingredient Data: Creative Commons (see individual entries)" ([README § License](https://github.com/wger-project/wger#license)).
  - In the API every exercise carries a `license` object and a `license_author`. Measured: CC-BY-SA 4: 781, CC-BY-SA 3: 132, CC0: 26.
  - Each image and video carries its own `license`, `license_author`, `license_author_url` and `license_derivative_source_url`. Images: CC-BY-SA 4 ×295, CC-BY-SA 3 ×88. Videos: CC-BY-SA 4 ×78.
  - Each image also has an `is_ai_generated` flag.
  - **Decisive.** You can bundle wger data. The AGPL applies to wger's server code, not to the data, so it does not affect the app. But each entry needs attribution to its author and license, and CC-BY-SA means any modified copy of the exercise text or images must stay CC-BY-SA. That covers adapted text, not the app's own code. Plan to ship a credits screen generated from `license_author`.
- **Access.** Public endpoints such as exercises "can be accessed without authentication" and are not throttled ([API docs](https://wger.readthedocs.io/en/latest/api/api.html)). `exerciseinfo` returns everything nested. A one-time export at build time is easy: 5 pages of 200 records, about 7 MB of JSON across all languages. The docs mention no bulk dump and no API terms of use.
- **Schema.**
  - `category`: only 8 body-area values: Abs, Arms, Back, Calves, Cardio, Chest, Legs, Shoulders.
  - `muscles` and `muscles_secondary`: with Latin and English names, a front/back flag and SVG muscle-highlight images.
  - `equipment`: 12 values, including "none (bodyweight exercise)", "Gym mat", Bench and Pull-up bar.
  - `translations[]`: name, HTML description, aliases and notes per language. All 939 have English.
  - `variation_group`, `images[]` and `videos[]`.
  - There are no reps, duration or position fields. Reps and sets live in wger routines, not in exercises.
- **Data quality.**
  - 224 exercises have no equipment at all. Many of them are clearly machine or cable exercises, so "no equipment" cannot be trusted as a filter.
  - Many entries are user-contributed and short, with descriptions under 100 characters.
  - Some English entries have non-English names, such as "Remo maquina agarre estrecho".
  - Some entries have no real movement, such as "Rest (for timed workouts)", meditation and swimming drills.
  - Many stretches are split into left and right entries.
- **Desk-doable, ~60–80 counting the left/right duplicates.** It is the richest source for neck and shoulder mobility:
  - Neck: Chin tuck, Front, Back, Left and Right neck stretch, clockwise and counterclockwise neck circles, Neck half circles, Head tilts, Head turns, Neck CARs, left and right levator scapulae stretch.
  - Shoulders: Forward and Backward shoulder rotation, forward and backward arm circles, Cross-Body Stretch, Wall Angels, Wall Slides, Doorway Pectoral Stretch, Wall Pushup.
  - Legs and hips: Standing and Supported Calf Stretch, Standing Calf Raises, Wall-sit, Bodyweight Squat, Quad Stretch, Abduction while standing, Leg Swings, Hip Circles, Marching High Knees, March or jog in place, Seated Piriformis Stretch, Standing IT Band Stretch.
  - Also: Torso Twist, Standing Side Crunches, Deep breathing (standing or seated), Radio Taiso, and more.

### ExerciseDB (AscendAPI)

- **License.**
  - The [ExerciseDB/exercisedb-api](https://github.com/ExerciseDB/exercisedb-api) repo is AGPL-3.0. It markets 11,000+ exercises, 15,000+ videos and 5,000+ GIFs through RapidAPI paid plans.
  - The docs ([docs.ascendapi.com](https://docs.ascendapi.com/), [V1 overview](https://docs.ascendapi.com/products/edb-v1/overview.md)) describe a free hosted tier with 1,500 exercises and one 180p GIF each. They state no license for the data or media and do not mention caching or storing it.
  - The README's Terms of Use link (`dub.sh/exercisedb-api-tos`) was rate-limited (HTTP 429) and could not be read.
  - The README says its playground endpoints are "not recommended for production integration."
- **Media ownership, inferred.** The hasaneyldrm dataset (below) uses ExerciseDB's v1 ID and schema shape: ids `0001`–`1324`, body part `waist`, `target`. It credits that media to © Gym visual. That suggests ExerciseDB's GIFs are Gym visual's commercial artwork. This is unconfirmed from an ExerciseDB primary source.
- **Schema (v1 free).** `exerciseId`, `name`, `gifUrl`, `bodyParts`, `targetMuscles`, `secondaryMuscles`, `equipments`, `instructions`. v2 adds `exerciseType`, `gender` and more.
- **Decisive.** This is not a bundleable open dataset. It is a commercial API with unclear terms, and it contradicts the local-only data model.

### RepDB/exercise-dataset

- **License.** "RepDB Free Tier License v1.0" ([LICENSE-DATA.md](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md)). Its terms:
  - Free for personal and commercial use "inside applications."
  - It requires a visible credit: "Exercise data by RepDB (repdb.co)."
  - Term 3 forbids republishing it "as a dataset, dataset repository, or API."
  - Term 5 forbids using the images in generative AI.
  - Preview animations are for evaluation only.
- **Store risk.** Bundling the data in the APK counts as in-app use and is allowed. But a public app repo that commits `exercises.json` could arguably count as redistribution "as a dataset repository," so check this before committing the data publicly. The license also says the images are AI-generated, and it claims a German sui-generis database right.
- **Size and schema.** 701 exercises, about 2.6 MB of JSON. Fields:
  - Text: `name_en/de/es`, `description_*`, `instructions_*` (step arrays), `tips_*`.
  - `category`, `force_type`: push, pull, static or dynamic.
  - `difficulty`, `body_part`: 9 values, including core and full_body.
  - `primary_muscles` and `secondary_muscles`: 28 fine-grained values.
  - `goals`: including mobility and rehabilitation.
  - `tags`: including `knee_safe`, `lower_back_safe`, `shoulder_safe`, `warm_up` and `requires_bench`.
  - `is_unilateral`, `is_bodyweight`, `met` (calorie estimate) and `equipment`.
  - There are no reps, duration or seated/standing fields. `force_type: static` means a held position.
- **Media.** Each exercise has flat-style 512px WebP frames: `start`, `peak` and `main`. The repo is about 47 MB.
- **Desk-doable, ~30–45.** Examples: Chin Tuck Hold, Neck Side Stretch, Isometric Neck Lateral Flexion, Cross-Body Shoulder Stretch, Overhead Triceps Stretch, Doorway Chest Stretch, Standing Side Bend, Torso Twists, Standing Quad Stretch, Standing Hip Abduction, Seated Spinal Twist, Chair Pose, Tree Pose, Mountain Pose, Supported Single-Leg Stand, High Knees.

### hasaneyldrm/exercises-dataset

- **License.** The data (names, categories, muscles, instructions in 10 languages) is MIT. The media is "the property of Gym visual," redistributed "with permission," at 180×180 only. The NOTICE warns: "This repository does not grant you any rights to the media… cloning this repo is not a license" ([NOTICE.md](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md)).
- **Size and schema.** 1,324 exercises, about 17 MB of JSON. Fields: `body_part` (10 values, including `neck` ×2), `equipment` (`body weight` ×325), `target`, `muscle_group`, `secondary_muscles`, `instruction_steps`, and `image` and `gif_url`, which point to the restricted media. There are no reps, duration or position fields.
- **Decisive.** Only the text is reusable. The illustrations need your own Gym visual license.

### exercemus/exercises

- MIT for the code ([repo](https://github.com/exercemus/exercises)). Its 872 exercises largely repackage free-exercise-db/exercises.json, plus a few wger entries.
- Each entry has a `license` field, but it is null for 871 entries. One entry is CC-BY-SA 3 from wger.de.
- It adds `tempo`, `tips`, `aliases`, `variations_on` and YouTube `video` links. It has no images.
- It brings no new desk content beyond free-exercise-db.

## Cross-cutting facts

- **No dataset says whether an exercise is done seated or standing,** and none has a desk or office tag. The position has to be read from instructions or names, or hand-curated. Only RepDB has `force_type: static` and mobility or rehab goals. Only wger has distinct neck-mobility coverage.
- **No dataset has reps or a duration per exercise.** At most, the instruction text says "hold for 20–30 seconds." The Suggestion's dose (reps or seconds) would have to be authored by the app.
- **The desk-doable subset is small everywhere,** about 30–80 entries. The datasets are gym-oriented, and 60–80% of entries need equipment or the floor.
- **Image licensing ranks as follows:**
  - Most permissive: free-exercise-db (public domain claim).
  - wger: CC-BY-SA per image, with attribution.
  - RepDB: in-app only, with attribution.
  - Not usable without a commercial license: Gym visual (hasaneyldrm) and ExerciseDB.
  - Only wger has real videos under an open license, on 46 exercises.

## Sources

- free-exercise-db: [README](https://github.com/yuhonas/free-exercise-db#readme), [LICENSE.md](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md), [schema.json](https://github.com/yuhonas/free-exercise-db/blob/main/schema.json), [dist/exercises.json](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json); upstream [wrkout/exercises.json](https://github.com/wrkout/exercises.json)
- wger: [README § License](https://github.com/wger-project/wger#license), [API docs](https://wger.readthedocs.io/en/latest/api/api.html), [exerciseinfo endpoint](https://wger.de/api/v2/exerciseinfo/), [license endpoint](https://wger.de/api/v2/license/), [equipment](https://wger.de/api/v2/equipment/), [categories](https://wger.de/api/v2/exercisecategory/)
- ExerciseDB: [ExerciseDB/exercisedb-api README](https://github.com/ExerciseDB/exercisedb-api), [AscendAPI docs](https://docs.ascendapi.com/), [EDB v1 overview](https://docs.ascendapi.com/products/edb-v1/overview.md)
- RepDB: [LICENSE-DATA.md](https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md), [exercises.json](https://github.com/RepDB/exercise-dataset/blob/main/exercises.json)
- hasaneyldrm: [NOTICE.md](https://github.com/hasaneyldrm/exercises-dataset/blob/main/NOTICE.md), [data/exercises.json](https://github.com/hasaneyldrm/exercises-dataset/blob/main/data/exercises.json)
- exercemus: [repo](https://github.com/exercemus/exercises), [exercises.json](https://github.com/exercemus/exercises/blob/main/exercises.json)
