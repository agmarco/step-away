# Activity Reminder

A personal Android app that nudges a desk worker to move on a configurable schedule and suggests quick exercises to do at the desk.

## Language

**Reminder**:
A scheduled nudge telling the user it's time to move, fired on a user-configured basis.
_Avoid_: alert, notification (the notification is just how a Reminder is delivered)

**Suggestion**:
The set of 1–3 Exercises offered alongside a Reminder. How many is a user setting (default 1) that applies to every Reminder.
_Avoid_: recommendation, workout

**Exercise**:
A single movement from the Exercise Library that can be done at or beside a desk.

**Exercise Library**:
The catalogue of Exercises that Suggestions are drawn from.
_Avoid_: exercise DB (implementation term)

**Target Muscle**:
The primary muscle an Exercise works (e.g. quadriceps, neck).

**Body Area**:
A coarse grouping of Target Muscles used to categorise Exercises. There are six: Neck; Shoulders & Upper Back; Chest & Arms; Wrists & Forearms; Core & Lower Back; Hips & Legs. Each Exercise belongs to exactly one Body Area, set by its main Target Muscle.
_Avoid_: category, muscle group

**Dose**:
How much of an Exercise a Suggestion asks for: a number of reps (usually 10), or a number of seconds for a held stretch, optionally "each side" for one-sided Exercises (never split into left and right Exercises). Every Exercise has a default Dose, which the user can change for that Exercise.
_Avoid_: sets, volume

**Difficulty**:
How hard an Exercise is: Beginner, Intermediate or Expert. The user chooses a Difficulty (default Intermediate) as a ceiling: Exercises above it are never suggested.
_Avoid_: level, intensity

**Energetic Exercise**:
An Exercise involving jumping, skipping or similar bursts: louder and sweatier than the rest. The user can switch them off.
_Avoid_: cardio, plyometric

**Active Hours**:
The time window, set per day of the week, during which Reminders may fire. Mon–Fri are on by default; Sat and Sun are off unless the user enables them.
_Avoid_: working hours, schedule

**Interval**:
How long after the user's last Response the next Reminder fires (default 45 minutes). With no Response, it counts from the last Reminder instead.
_Avoid_: frequency

**Response**:
What the user tells the app after a Reminder: Done, Skip, or Snooze. A Done Response records which of the suggested Exercises were performed.
_Avoid_: check-in, completion

**Snooze**:
A Response that postpones the current Reminder by the Snooze delay (default 10 minutes); it returns with the same Suggestion. A Reminder can be snoozed at most twice, after which only Done or Skip remain.

**Pause**:
A user-chosen stretch (1 hour, 2 hours, or the rest of today) during which no Reminders fire. Nothing during a Pause counts as Missed; Reminders resume automatically one Interval after it ends.
_Avoid_: mute, do not disturb

**Missed**:
The outcome of a Reminder that never got a Response before the next Reminder replaced it. Recorded in the Activity Log; not a Response, since the user said nothing.
_Avoid_: ignored, expired

**Dropped**:
The end of a snoozed Reminder whose re-fire would land at or after its day's closing time: it never re-fires, and once the Active Hours end it is dropped. Not Missed, and not a Response: it isn't counted in the Activity Log, so snoozing near the end of the day isn't punished.
_Avoid_: cancelled, expired

**Activity Log**:
The history of Responses: the app's record of whether the user moved.
_Avoid_: workout history

**Daily Goal**:
The number of Done Responses the user aims for in a day (default 4), set by the user. A day that reaches it is a **Goal Day**.
_Avoid_: target, quota

**Streak**:
The run of consecutive Goal Days. Days with no Active Hours, and Days Off, neither break nor extend it.
_Avoid_: chain, combo

**Day Off**:
A whole day the user marks as off, ahead of time or on the day. No Reminders fire, and the Streak skips it like a day without Active Hours. Unlike a Pause, which covers only part of a day, it leaves the Streak untouched.
_Avoid_: vacation, sick day, rest day

**Badge**:
A one-off achievement unlocked by something in the Activity Log (a Streak length, a total of Done Responses, Exercise variety, a balanced or perfect day). Once unlocked, never taken away.
_Avoid_: trophy, award

**Record**:
A personal best computed from the Activity Log (longest Streak, most Done in a day or week). Unlike a Badge, always recalculated.
_Avoid_: high score

**Cue**:
A one-line reminder of how to do an Exercise, short enough to read at a glance (e.g. "Drop ear to shoulder, keep shoulders down"). Every Exercise has one, alongside its full step-by-step instructions.
_Avoid_: tip, description

**Position**:
How an Exercise is done: Seated, Standing, Either (works seated or standing), or Floor.
_Avoid_: posture, stance

**Exercise Type**:
The kind of movement an Exercise is: Strength, Stretch, Plyometric or Cardio. Separate from Energetic, which is the on/off switch for noisy, sweaty Exercises.
_Avoid_: category, kind

**Floor Exercise**:
An Exercise whose Position is Floor (lying, kneeling, plank). Excluded unless the user switches them on.

**Equipment**:
A light piece of kit an Exercise needs: dumbbells, kettlebell, resistance bands, medicine ball, exercise ball or foam roller. An Exercise is only suggested if the user has said they own its Equipment.
_Avoid_: gear

**Excluded Exercise**:
An Exercise the user has marked "never suggest". It stays in the Exercise Library and can be brought back in Settings.
_Avoid_: blocked, hidden, disliked

**Swap**:
Replacing one Exercise in the current Suggestion with another that fits the same rules. Not a Response: it doesn't use up a Snooze or appear in the Activity Log.
_Avoid_: reroll, shuffle, skip (Skip is a Response)

## Relationships

- A **Reminder** carries one **Suggestion**
- A **Suggestion** contains 1–3 **Exercises**, drawn from the **Exercise Library**
- An **Exercise** has one or more **Target Muscles**; its main Target Muscle places it in exactly one **Body Area**
- A **Reminder** ends with one final **Response** (Done or Skip), as **Missed**, or **Dropped** (a Snooze past closing time); up to two **Snoozes** may come before that, each re-firing the same **Reminder**
- Only one **Reminder** is outstanding at a time; when a new one fires, an unanswered previous one becomes **Missed**
- The **Activity Log** is built from **Responses** and **Missed** Reminders; the user self-reports, and nothing is detected from sensors

## Flagged ambiguities

- "Recording a workout" vs. "being active": resolved. Activity means a self-reported Done Response, not a detected movement.
