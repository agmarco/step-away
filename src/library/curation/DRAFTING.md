# Drafting guide

How to draft a curation entry from a free-exercise-db candidate. The agent drafts every field below; the owner reviews every field, batch by batch, on a throwaway review page (one card per Exercise: start and end photos, source steps, drafted fields). The exception is #20 CP4: its 193 drafts were accepted as drafted, unreviewed (see Owner corrections). Format and validation rules: [README.md](README.md). Attribute definitions: issue #7. Terms: `CONTEXT.md`.

The context to keep in mind for every judgment: **a quick break at or beside a desk**, in work clothes, a minute or two, no warm-up.

## 1. Keep or drop

Keep a candidate only if all of these hold:

- It can be done in a minute or two with no warm-up, in ordinary clothes.
- It is explainable in a short Cue and a few plain Steps (not "too technical for a quick break").
- It is safe done cold: no maximal effort, no ballistic stretching, no balance risk. Explosive and hard moves (jumps, bounds, a handstand push-up) are kept: drafting removes the maximal push ("as high as possible") and tags them Energetic or grades them Intermediate or Expert, because the user's Energetic switch and Difficulty ceiling gate them.
- It needs nothing beyond v1's Equipment (dumbbells and resistance bands) and the room: no bench, bar or rack. A wall, desk or chair is fine, and so is a resistance band anchored low on a desk leg; a move that needs the band anchored at chest or elbow height is dropped. `library:draft` already leaves out entries whose source equipment is anything else, but the source lists some kit moves as body only, so check the photos and steps.
- A small step or box is not needed: any small elevation (a book, a stair, a door threshold) replaces it, so a move that raises a heel or the toes on one is kept, and its steps say so. A move that steps up onto a bench-high box is still dropped.
- It works alone. A stretch shown with a partner is kept when it works alone, and its steps are rewritten for doing it alone; only a move that truly needs a second person is dropped. A partner stretch's contract-relax press phase (pushing against the partner's hold) is kept when it can be done alone, with your own hand resisting (`Overhead_Triceps`), and dropped when it can't (section 7).

Every variant that passes these rules is kept, even a near-identical one, because any variety is welcome (owner decision, #20).

Drop sprint drills, Olympic-style technique drills, non-desk moves (e.g. trail running) and anything whose photos don't make the move clear. Dropped candidates get no entry; nothing records them. A candidate that passes these rules but is done lying or kneeling on the floor is not dropped: it goes in the floor group (`floor.yaml`), curated in #20.

## 2. Position

| Position | Use when |
|---|---|
| `Standing` | The move needs standing: squats, jumps, lunges, anything with the legs moving. |
| `Seated` | The move needs the chair: a chair dip, a seated twist using the backrest, a seated figure-4. Not for moves that merely can be done sitting. |
| `Either` | The move works the same sitting or standing: most neck, shoulder, arm, wrist and upper-back moves. **Use Either whenever the legs aren't involved**, even if the photos show standing. |
| `Floor` | You lie or kneel on the floor. Goes in `floor.yaml` (or the Equipment file), never `base.yaml`. |

The same goes for photos that sit on the floor: a move whose photos are seated on the floor but that involves only the head or arms is Either, not Floor (`Chin_To_Chest_Stretch`).

## 3. Energetic

`energetic: true` only if the move raises the heart rate noticeably within the Dose: jumping, hopping, high knees, fast skipping. Squats, holds, stretches and mobility circles are `false`, even if tiring.

## 4. Difficulty, re-graded for a desk break

Grade for an untrained office worker doing it cold, not for a gym user:

- **Beginner**: anyone can do it safely right now. Most stretches, mobility moves and gentle holds.
- **Intermediate**: needs some fitness, coordination or impact: jumps, deep or single-leg work, push-up variants.
- **Expert**: hard even for fit people, or needs real skill. Kept when it passes section 1; the user's Difficulty ceiling hides it from those who don't want it.

Two cases settled in the #20 pilot:

- **Jumps:** a jump of Star Jump's height and impact is Intermediate; anything beyond it, such as a tuck jump or a bound, is Expert (`Knee_Tuck_Jump`).
- **Loaded hinges:** a hinge with a weight (a bent-over row, a stiff-legged deadlift, a good morning) done cold is Intermediate, and its steps say to use a light weight and to keep the back flat throughout, including standing up at the end (`Bent_Over_Two-Dumbbell_Row`).

The source `level` is a starting point only. It often grades stretches as Expert (e.g. `Seated_Biceps`) and explosive jumps as beginner; correct both.

## 5. Dose

A default Dose is reps **or** seconds, never sets.

- **Reps: 10** for anything that moves and repeats (squats, jumps, circles).
- **Seconds** for anything held: stretches **20 s** by default (30 s only for a larger stretch, which means the hips or hamstrings are the main target, as in `Seated_Glute`; a calf, side or arm stretch stays at 20), isometric holds **15 s**, planks **20 s** (the low end, since they are done cold).
- **`eachSide: true`** when the move is done on one side and then the other (a neck tilt, a lunge, a one-arm stretch). The Dose is then per side. One-sided moves are **never** split into left and right Exercises.
- Moves done with both sides at once (both wrists, both shoulders) are not Each Side.
- **Alternating moves** (left, right, left within one set: a walking lunge, a dead bug, an alternate curl) are **reps: 10**, not Each Side, and their last step says "keep alternating" (`Bodyweight_Walking_Lunge`, `Dead_Bug`).
- **Front and back count as two sides**: a move done to the front and then to the back is Each Side, like left and right (`Isometric_Neck_Exercise_-_Front_And_Back`).
- **A hard move keeps the default 10 reps.** The Difficulty grade gates it, not a smaller Dose (`Handstand_Push-Ups`, Expert, 10 reps).

## 6. Cue

One glanceable line, **8 words or fewer**, no full stop. It's the move's key action plus the one thing people get wrong. Imperative, plain words, no anatomy terms.

- Good: `Ear to shoulder, shoulders stay down`
- Too long: `Start with your shoulders relaxed and gently tilt your head towards your shoulder`
- Too vague: `Stretch your neck`

## 7. Steps

Rewrite the source instructions; never copy them as they are.

- Short imperative sentences, one action per step, usually 3–5 steps.
- **Remove every dose or count mention**: "hold for 30 seconds", "repeat 10 times", "for the recommended number of repetitions", "3 sets", "rest and repeat". The Dose field carries that.
- **No count or number in a step, ever.** The Dose, which the user can change, carries it, so a number in a step would contradict an overridden Dose. When a reps Dose applies in each direction or phase, say so without a number ("Then circle them backwards the same number of times."). The build step fails on any digit in a step, naming the Id.
- Remove gym tips, "this will be your starting position", anatomy lectures and asides.
- Start with the set-up position. For Either moves, start with "Sit or stand tall."
- For Each Side moves, end with "…, then switch sides." A held move's last step keeps that form ("Release slowly, then switch sides."); a reps move's last step finishes the reps first ("…finish your reps, then switch sides.").
- For reaching moves, write "reach towards … until you feel the stretch", never a fixed end position the untrained can't reach (not "touch your toes").
- A partner stretch done alone (section 1) keeps its press phase only when your own hand can resist it: "Press the elbow up into your hand for a few seconds, without letting it move." Otherwise the steps leave the press out, including when both arms are working and no hand is free to resist (`Seated_Front_Deltoid`, `Seated_Biceps`).
- **Travelling moves** (walking lunges, skips, bounds, crawls) are done on the spot or as a short out-and-back ("after a few steps forward, turn round and come back"), never "as far as you can" (`Bodyweight_Walking_Lunge`, `Fast_Skipping`).
- **Upright rows and elbow-led raises stop at chest height**, not at the chin or shoulders: "Stop at about chest height, with your elbows higher than your hands." (`Standing_Dumbbell_Upright_Row`, `Upright_Row_-_With_Bands`).
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
  - The rename may be **descriptive**, not just a minimal fix, when the source name is jargon, a bare body part, or would be confused with another Exercise: `Overhead_Triceps` becomes Triceps Press and Stretch, because `Triceps_Stretch` already exists; `Hip_Extension_with_Bands` becomes Band Leg Kickback.
  - Drop Position words that contradict section 2: `Standing_Lateral_Stretch` is Either, so it becomes Side Stretch.
  - Drop "Seated" from the name of a move done sitting on the floor: it reads as a chair move (`Seated_Calf_Stretch` becomes Floor Calf Stretch). The same goes for a move drafted as Either (`Seated_Front_Deltoid` becomes Front Shoulder Stretch).
  - Jargon to rename: Oblique, Delt/Deltoid, Scaption, Extensor, Isometric, alongside the anatomy terms above (Adductor, Gastrocnemius). A source "… - With Bands" name becomes "Band …" (`Lateral_Raise_-_With_Bands` becomes Band Lateral Raise), as with Band Leg Kickback.
  - Other pilot renames: Standing Calf Stretch (`Standing_Gastrocnemius_Calf_Stretch`, jargon), Seated Glute Stretch (`Seated_Glute`, a bare body part), Split Squat (`Split_Squats`, plural).
  - Don't re-punctuate a kept source name: Bent Over Two-Dumbbell Row stays as it is. This holds even next to renamed entries that read "Push-Up": Plyo Push-up (`Plyo_Push-up`) and Push Up to Side Plank (`Push_Up_to_Side_Plank`) keep the source's punctuation.
- **`exerciseType`**: when the source category is wrong for the move, e.g. a static hold filed under `plyometrics`. Posture and activation moves (a chin tuck, wrist mobility) are `Stretch`, following `Wrist_Circles`; a House Exercise writes it (`custom/Chin_Tuck`).
  - A repeated rep move filed under `stretching` is `Strength` (`Sit_Squats`, `Scissor_Kick`).
  - An explosive move filed under another category is `Plyometric`, even when nothing jumps: the hands leave the floor on every rep of `Clock_Push-Up`. A repeated jump filed elsewhere is `Plyometric` too (`Freehand_Jump_Squat`).
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
| steps | "Repeat for…" removed; "circle both wrists forwards", then "backwards the same number of times" | Standing set-up replaced by "Sit or stand tall." The Dose's 10 reps means 10 in each direction; the steps say so without a number (section 7). |

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
3. **Wrist Circles:** "10 reps" means 10 in each direction, and the steps say so ("forwards 10 times", then "backwards 10 times"). The Dose stays `reps: 10` with no `eachSide`, because the Dose has no direction field. Rule added to section 7: a count in a step is allowed only to say how a reps Dose splits across directions or phases, repeating the Dose's own number. *Superseded 2026-11 (#30): steps never carry a number, since the user can change the Dose; see section 7.*
4. **Positions:** keep "Either whenever the legs aren't involved". Seated is for moves that need the chair, such as a chair dip or a seated twist (section 2).
5. **Dose defaults** confirmed: 20 s for stretches (30 s only for a larger stretch), 15 s for isometric holds (section 5).
6. **Spelling:** British (centre, colour) in curated text and in this guide.

### 2026-11-23: #20 grilling

Decisions for the base set, from the #20 grilling session:

1. **No cap on size:** every base candidate that passes section 1 is kept, Energetic ones included.
2. **No near-duplicate filter:** every variant that passes section 1 is its own Exercise, near-identical pairs included. The near-duplicate line is removed from section 1.
3. **At least 5 Exercises in every Body Area.** House Exercises (`custom/…`, written by us, no photos) fill Neck and Wrists & Forearms, which the source can't fill.
4. **Floor candidates** found among the base candidates go in the floor group (`floor.yaml`), not dropped. (First parked for #33; the floor group was then curated in #20.)

### 2026-11-23: #20 triage

The owner gave verdicts on all 212 candidates (base 147, dumbbells 50, resistance bands 15) on the triage page. Section 1 now reflects them.

1. **Drops brought back** (owner decision after the first triage):
   - **Partner stretches** that work alone are kept, and drafting rewrites their steps for doing them alone (e.g. `Seated_Front_Deltoid`, `Overhead_Triceps`, `Seated_Biceps`, `Seated_Glute`, `Standing_Towel_Triceps_Extension`). Their solo versions that lie or kneel on the floor go in the floor group (`floor.yaml`; first parked for #33, then curated in #20). Only moves that truly need a second person stay dropped.
   - **Explosive and hard moves** are kept, tagged Energetic or graded Intermediate or Expert, because the Energetic switch and the Difficulty ceiling gate them (e.g. `Knee_Tuck_Jump`, `Lateral_Bound`, `Handstand_Push-Ups`). Explosive push-ups are floor moves, so they go in the floor group (`floor.yaml`; first parked for #33, then curated in #20).
   - Sprint drills, Olympic-style lifts, moves needing a bench, bar or rack, unclear photos and non-desk moves stay dropped.
2. **Four owner flips from drop to keep:**
   - `Linear_Acceleration_Wall_Drill`: recommended drop as a sprint drill. The owner left no note; unlike the other sprint drills it is done on the spot, leaning against a wall, so it is gated like the other explosive moves (Energetic).
   - `One_Half_Locust`: recommended drop because the photos (all fours, then side-lying) contradict the steps (lying face down). Drafting writes the steps from the photos, or marks it for the owner. Both the photos and the steps are on the floor, which `base.yaml` doesn't allow, so the owner confirms its group before it is drafted. (Since then: it went to `floor.yaml` as Side-Lying Half Locust, drafted from the photos as a side-lying foot pull.)
   - `Split_Squats`: recommended drop because the photos show a static split-stance lunge while the steps describe a jumping leg switch. Drafting follows the photos (a static split squat); `Split_Jump` and `Scissors_Jump` already cover the jump.
   - `Standing_Gastrocnemius_Calf_Stretch`: recommended drop for its step. The owner: "we can just add a note that any small elevation can sub the box".
3. **Small elevation:** any small elevation (a book, a stair, a door threshold) can replace a small step or box, so a move needing one is kept and its steps say so (section 1).
4. **v1 Equipment is dumbbells and resistance bands only.** Kettlebell, medicine ball, exercise ball and foam roller leave v1, so a candidate needing one is dropped (e.g. `Crunch_-_Legs_On_Exercise_Ball`, which the source wrongly lists as body only). The code change is #20 CP2.
5. **Band anchors:** a band anchored low on a desk leg is fine (e.g. `Hip_Extension_with_Bands`, `Hip_Flexion_with_Band`); moves that need it anchored at chest or elbow height (`Cross_Over_-_With_Bands`, `External_Rotation_with_Band`, `Internal_Rotation_with_Band`) stay dropped.
6. **Calf Raise House Exercise:** the owner wants a plain calf raise. The source has none without kit (its calf raises need a barbell, a machine, a dumbbell or a band), so a bodyweight Calf Raise is added as a House Exercise (Hips & Legs).

### 2026-11-23: #20 pilot (owner approved all 11 as drafted)

The owner reviewed the eleven pilot drafts (seven base, Chin Tuck, Plank, the bent-over row and the band kickback) and approved all of them as drafted. The rules they settled:

1. **Each Side endings:** a reps move's last step reads "…finish your reps, then switch sides."; a hold keeps "…, then switch sides." (section 7).
2. **Names:** a rename may be descriptive when the source name is jargon, a bare body part or would be confused with another Exercise; Position words that contradict section 2 are dropped; a kept source name is not re-punctuated (section 8).
3. **Grading:** jumps beyond Star Jump's height or impact (tuck jumps, bounds) are Expert; a loaded hinge done cold is Intermediate, with a light weight and a flat back in the steps (section 4).
4. **Partner stretches done alone:** the contract-relax press phase stays when your own hand can resist, and goes when it can't (sections 1 and 7).
5. **Exercise Type:** posture and activation moves (chin tuck, wrist mobility) are Stretch, following Wrist Circles (section 8).
6. **Dose:** planks take 20 s; a stretch is "larger" (30 s) only when the hips or hamstrings are the main target (section 5).
7. **Reach:** reaching moves say "reach towards … until you feel the stretch", never a fixed end position (section 7).
8. **Position from photos:** a move whose photos sit on the floor but that uses only the head or arms is Either (section 2).

### 2026-11-23: #20 CP4 (accepted as drafted, unreviewed)

The owner accepted all 193 CP4 drafts (base 60 including 8 House Exercises, floor 79, dumbbells 43, resistance bands 11) as drafted, without reviewing them card by card. Every open question took the drafted answer: Handstand Push-Up is kept as Expert at 10 reps, Vertical Swing is one-handed and Each Side, the renames stand as drafted, and the duplicate source photos are kept. The drafters' guide-gap decisions became these rules:

1. **Alternating moves** are 10 reps, not Each Side, and the steps say "keep alternating" (section 5).
2. **Travelling moves** are done on the spot or as a short out-and-back, never "as far as you can" (section 7).
3. **Front and back** count as two sides, for Each Side (section 5).
4. **"Seated"** is dropped from the names of floor-sitting moves (section 8).
5. **Jargon:** the list grows by Oblique, Lateral, Delt/Deltoid, Scaption, Flexor, Extensor and Isometric; "- With Bands" becomes "Band …" (section 8). (At the #20 final gate, Lateral and Flexor left the list: the accepted names keep them, as in Band Lateral Raise, Lateral Bound and Standing Hip Flexor Stretch.)
6. **Partner press:** dropped when no hand is free to resist (section 7).
7. **Wrong source category:** overridden, to Strength for rep moves filed as stretching and to Plyometric for non-jump explosive moves (section 8).
8. **Punctuation:** kept source punctuation stays, even next to renamed "Push-Up" entries (section 8).
9. **Upright rows and elbow-led raises** stop at chest height (section 7).
10. **Hard moves** keep the default 10 reps; the owner accepted Handstand Push-Up at 10 (section 5).

Known source photo issues, kept as they are:

- `Leg-Up_Hamstring_Stretch` shares `90_90_Hamstring`'s photos.
- `One_Half_Locust` shares a start photo with `All_Fours_Quad_Stretch`.
