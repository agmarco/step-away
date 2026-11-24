# Curation files

One YAML file per group, named after it: `base.yaml`, `floor.yaml`, `dumbbells.yaml`, `resistance-bands.yaml`. Any other `.yaml` name fails the build, `kettlebell.yaml` included: v1's Equipment is dumbbells and resistance bands (#20). The folder holds only these `<group>.yaml` files, this README and the drafting guide (`DRAFTING.md`): any other file, such as a `base.yml` typo, fails the build. Hidden files (names starting with `.`, such as `.DS_Store` or `.gitkeep`) are ignored. Only Exercises with an entry here ship.

Each file is a map keyed by frozen Id. A source-backed entry (Id from `library/source/exercises.json`) holds only the curated fields:

```yaml
Side_Neck_Stretch:
  name: Side Neck Stretch     # optional; the source name otherwise
  targetMuscles: [neck]       # optional; the source primaryMuscles otherwise
  bodyArea: Neck              # optional; from the first Target Muscle otherwise
  exerciseType: Stretch       # optional; from the source category otherwise
  difficulty: Beginner        # optional; from the source level otherwise
  position: Either            # Seated | Standing | Either | Floor
  energetic: false
  dose:
    seconds: 30               # or reps: 10
    eachSide: true            # optional, default false
  cue: Drop ear to shoulder, keep shoulders down
  steps:
    - Sit or stand tall with your shoulders relaxed.
    - Gently tilt your head towards one shoulder.
  # sourceId: New_Source_Id   # only if free-exercise-db renamed the entry; the Id stays
  # equipment: …              # optional; must equal the source mapping (Equipment comes from the source)
```

The format allows leaving `difficulty` out, in which case it falls back to the source level, but the drafting guide requires writing it on every entry.

A House Exercise (one the curators write, not taken from free-exercise-db; `source: 'self-authored'` in the generated library) has an Id starting `custom/` and writes every field above except `sourceId`, including `equipment` (`null` for none). It has no photos.

Group rules: `floor` entries have `position: Floor` and no Equipment (a floor move that needs Equipment, such as a dumbbell floor press, goes in that Equipment's file with `position: Floor`); `base` entries are never Floor and have no Equipment; each Equipment file holds only that Equipment. A source entry whose equipment is not v1 Equipment (a machine, cable, barbell, e-z curl bar or other, and the kettlebells, medicine ball, exercise ball and foam roll that left v1) fails the build, and `library:draft` never offers it. Unknown keys fail the build, and so does a digit in a step: steps never carry a count, the Dose does.

`npm run library:draft -- <group>` prints the candidates for a group with the script-filled fields. After editing, run `npm run library:photos` and `npm run library:build`, and commit the curation file, the photos and the generated output together. [`DRAFTING.md`](DRAFTING.md) is the drafting guide: how to fill each field, with the calibration set as worked examples.
