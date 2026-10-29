# Drafting guide

How to draft a curation entry from a free-exercise-db candidate. The agent drafts every field below; the owner reviews every field, batch by batch, on a throwaway review page (one card per Exercise: start and end photos, source steps, drafted fields). Format and validation rules: [README.md](README.md). Attribute definitions: issue #7. Terms: `CONTEXT.md`.

The context to keep in mind for every judgment: **a quick break at or beside a desk**, in work clothes, a minute or two, no warm-up.

## 1. Keep or drop

Keep a candidate only if all of these hold:

- It can be done in a minute or two with no warm-up, in ordinary clothes.
- It is explainable in a short Cue and a few plain Steps (not "too technical for a quick break").
- It is safe done cold: no maximal effort, no ballistic stretching, no balance risk.
- It doesn't need anything the Equipment list lacks (a bench, a bar, a partner, a wall is fine).
- It isn't a near-duplicate of an Exercise already kept.

Drop sprint drills, Olympic-style technique drills, partner stretches and anything whose photos don't make the move clear. Dropped candidates get no entry; nothing records them.

## 2. Position

| Position | Use when |
|---|---|
| `Standing` | The move needs standing: squats, jumps, lunges, anything with the legs moving. |
| `Seated` | The move needs the chair: a chair dip, a seated twist using the backrest, a seated figure-4. Not for moves that merely can be done sitting. |
| `Either` | The move works the same sitting or standing: most neck, shoulder, arm, wrist and upper-back moves. **Use Either whenever the legs aren't involved**, even if the photos show standing. |
| `Floor` | You lie or kneel on the floor. Goes in `floor.yaml` (or the Equipment file), never `base.yaml`. |

## 3. Energetic

`energetic: true` only if the move raises the heart rate noticeably within the Dose: jumping, hopping, high knees, fast skipping. Squats, holds, stretches and mobility circles are `false`, even if tiring.

## 4. Difficulty, re-graded for a desk break

Grade for an untrained office worker doing it cold, not for a gym user:

- **Beginner**: anyone can do it safely right now. Most stretches, mobility moves and gentle holds.
- **Intermediate**: needs some fitness, coordination or impact: jumps, deep or single-leg work, push-up variants.
- **Expert**: hard even for fit people, or needs real skill. Rarely kept at all for a quick break.

The source `level` is a starting point only. It often grades stretches as Expert (e.g. `Seated_Biceps`) and explosive jumps as beginner; correct both.

## 5. Dose

A default Dose is reps **or** seconds, never sets.

- **Reps: 10** for anything that moves and repeats (squats, jumps, circles).
- **Seconds** for anything held: stretches **20 s** by default (30 s only for a larger stretch, such as hamstrings or hips), isometric holds **15 s**, planks **20–30 s**.
- **`eachSide: true`** when the move is done on one side and then the other (a neck tilt, a lunge, a one-arm stretch). The Dose is then per side. One-sided moves are **never** split into left and right Exercises.
- Moves done with both sides at once (both wrists, both shoulders) are not Each Side.

## 6. Cue

One glanceable line, **8 words or fewer**, no full stop. It's the move's key action plus the one thing people get wrong. Imperative, plain words, no anatomy terms.

- Good: `Ear to shoulder, shoulders stay down`
- Too long: `Start with your shoulders relaxed and gently tilt your head towards your shoulder`
- Too vague: `Stretch your neck`

## 7. Steps

Rewrite the source instructions; never copy them as they are.

- Short imperative sentences, one action per step, usually 3–5 steps.
- **Remove every dose or count mention**: "hold for 30 seconds", "repeat 10 times", "for the recommended number of repetitions", "3 sets", "rest and repeat". The Dose field carries that.
- **One exception:** a count may appear in a step **only** to say how a reps Dose splits across directions or phases ("10 times forwards, then 10 times backwards", "each way"), and it must repeat the Dose's own number. Never a different count, never a hold time, never sets. (The Dose has no direction field, so `reps: 10` for Wrist Circles means 10 in each direction, and the steps say so.)
- Remove gym tips, "this will be your starting position", anatomy lectures and asides.
- Start with the set-up position. For Either moves, start with "Sit or stand tall."
- For Each Side moves, end with "…, then switch sides."
- British spelling (centre, colour) in every curated field and in this guide.

Before (`Isometric_Chest_Squeezes`, source):

> 3. Hold for the recommended number of seconds.
> 4. Now release the tension slowly.
> 5. Rest for the recommended amount of time and repeat.

After:

> 5. Release the tension slowly.

## 8. Overrides

Leave a field out to take the script mapping. Write it only when the mapping is wrong, with the reason in a YAML comment above it.

- **`name`**: only if the source name is awkward, jargon or a bare body part (`Adductor/Groin`, `Isometric Chest Squeezes`). Keep it short and recognisable. The Id never changes.
- **`exerciseType`**: when the source category is wrong for the move, e.g. a static hold filed under `plyometrics`.
- **`bodyArea`**: when the first source Target Muscle doesn't match where the move is felt (e.g. a full-body jump whose first muscle is not the point). Prefer overriding `bodyArea` alone over reordering `targetMuscles`.
- **`difficulty`**: always written, after re-grading (section 4), even when it equals the source.

## 9. Worked examples (calibration set)

The five calibration Exercises, one per role. Each shows the source fields and the curated result.

### Stretch: `Upper_Back_Stretch`

Source: *Upper Back Stretch* · stretching · beginner · middle back · "Clasp fingers together with your thumbs pointing down, round your shoulders as you reach your hands forward."

| Field | Curated | Why |
|---|---|---|
| name | (source) | Already plain. |
| exerciseType / bodyArea | Stretch / Shoulders & Upper Back | Mapping is right. |
| position | Either | Arms only; works at the desk. Photos show standing, which doesn't matter. |
| energetic | false | A held stretch. |
| difficulty | Beginner | Anyone can do it cold. |
| dose | 20 s | A held stretch of a small area: the default 20. |
| cue | Clasp hands, reach forward, round your back | Action plus the rounding people forget. |
| steps | 4 steps, set-up first | One source sentence split into single actions. |

### Strength move: `Isometric_Chest_Squeezes`

Source: *Isometric Chest Squeezes* · plyometrics · beginner · chest · 5 steps including "Hold for the recommended number of seconds" and "Rest … and repeat".

| Field | Curated | Why |
|---|---|---|
| name | Chest Squeeze | "Isometric" is jargon; plural reads oddly as one Exercise. |
| exerciseType | **Strength** (override) | Source says plyometrics; it's a static press (force: static). |
| bodyArea | Chest & Arms | Mapping is right. |
| position | Either | Source says seated or standing; arms only. |
| energetic | false | A hold. |
| difficulty | Beginner | Self-limiting effort. |
| dose | 15 s | An isometric hold. |
| cue | Press palms together hard, keep breathing | Action plus the breath-holding people do. |
| steps | Dose lines removed | See the before/after in section 7. |

### One-sided move: `Side_Neck_Stretch`

Source: *Side Neck Stretch* · stretching · beginner · neck · "Start with your shoulders relaxed, gently tilt your head towards your shoulder." "Assist stretch with a gentle pull on the side of the head."

| Field | Curated | Why |
|---|---|---|
| name | (source) | Already plain. |
| position | Either | Neck only. |
| energetic | false | A held stretch. |
| difficulty | Beginner | Gentle. |
| dose | 20 s each side | Held stretch done one side then the other; one Exercise, not two. |
| cue | Ear to shoulder, shoulders stay down | Action plus the shrug people do. |
| steps | Ends "…, then switch sides." | Each Side moves end with the switch. |

### Either: `Wrist_Circles`

Source: *Wrist Circles* · stretching · beginner · forearms · 3 steps starting "Start by standing straight…" and ending "Repeat for the recommended amount of repetitions."

| Field | Curated | Why |
|---|---|---|
| name | (source) | Already plain. |
| exerciseType / bodyArea | Stretch / Wrists & Forearms | Mapping is right (it's mobility; Stretch is the nearest type). |
| position | **Either** | Source says standing, but only the arms move: Either. |
| energetic | false | Mobility. |
| difficulty | Beginner | Trivial. |
| dose | 10 reps | Repeating movement; both wrists at once, so not Each Side. |
| cue | Arms out wide, circle both wrists | Set-up plus action. |
| steps | "Repeat for…" removed; "forwards 10 times", then "backwards 10 times" | Standing set-up replaced by "Sit or stand tall." The Dose's 10 reps means 10 in each direction; the steps repeat the Dose's number to say so (the one allowed count, section 7). |

### Energetic: `Star_Jump`

Source: *Star Jump* · plyometrics · beginner · quadriceps · "squat down halfway and explode back up as high as possible…"

| Field | Curated | Why |
|---|---|---|
| name | (source) | Already plain. |
| exerciseType / bodyArea | Plyometric / Hips & Legs | Mapping is right. |
| position | Standing | Legs and a jump. |
| energetic | **true** | A jump; raises the heart rate in 10 reps. |
| difficulty | **Intermediate** (re-graded up) | Impact and an explosive jump, done cold. |
| dose | 10 reps | Repeating movement. |
| cue | Squat, jump up, spread arms and legs | The three phases. |
| steps | "as high as possible" dropped; soft landing added | No maximal effort cold; landing is the safety point. |

## Owner corrections

Each correction becomes a rule above.

### 2026-10-29: calibration set review

The owner reviewed the five calibration drafts and accepted all as recommended:

1. **Strength move:** keep Chest Squeeze (`Isometric_Chest_Squeezes`, renamed, `exerciseType: Strength` override). The calibration set should cover all Body Areas; Bodyweight Squat comes in the first batch.
2. **Star Jump:** kept as the Energetic example, graded Intermediate. The Energetic switch is what lets the user turn it off.
3. **Wrist Circles:** "10 reps" means 10 in each direction, and the steps say so ("forwards 10 times", then "backwards 10 times"). The Dose stays `reps: 10` with no `eachSide`, because the Dose has no direction field. Rule added to section 7: a count in a step is allowed only to say how a reps Dose splits across directions or phases, repeating the Dose's own number.
4. **Positions:** keep "Either whenever the legs aren't involved". Seated is for moves that need the chair, such as a chair dip or a seated twist (section 2).
5. **Dose defaults** confirmed: 20 s for stretches (30 s only for a larger stretch), 15 s for isometric holds (section 5).
6. **Spelling:** British (centre, colour) in curated text and in this guide.
