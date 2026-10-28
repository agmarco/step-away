# Activity Reminder

A personal Android app that nudges a desk worker to move on a configurable schedule and suggests quick exercises to do at the desk.

## Language

**Reminder**:
A scheduled nudge telling the user it's time to move, fired on a user-configured basis.
_Avoid_: alert, notification (the notification is just how a Reminder is delivered)

**Suggestion**:
The set of 1–3 Exercises offered alongside a Reminder.
_Avoid_: recommendation, workout

**Exercise**:
A single movement from the Exercise Library that can be done at or beside a desk.

**Exercise Library**:
The catalogue of Exercises that Suggestions are drawn from.
_Avoid_: exercise DB (implementation term)

**Target Muscle**:
The primary muscle an Exercise works (e.g. quadriceps, neck).

**Body Area**:
A coarse grouping of Target Muscles (e.g. Neck, Hips & Legs) used to categorise Exercises.
_Avoid_: category, muscle group

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

**Activity Log**:
The history of Responses: the app's record of whether the user moved.
_Avoid_: workout history

**Floor Exercise**:
An Exercise done on the floor (lying, kneeling, plank). Excluded unless the user switches them on.

**Equipment**:
A light piece of kit an Exercise needs: dumbbells, kettlebell, resistance bands, medicine ball, exercise ball or foam roller. An Exercise is only suggested if the user has said they own its Equipment.
_Avoid_: gear

## Relationships

- A **Reminder** carries one **Suggestion**
- A **Suggestion** contains 1–3 **Exercises**, drawn from the **Exercise Library**
- An **Exercise** has one or more **Target Muscles**, which place it in a **Body Area**
- A **Reminder** ends with one final **Response** (Done or Skip) or as **Missed**; up to two **Snoozes** may come before that, each re-firing the same **Reminder**
- Only one **Reminder** is outstanding at a time; when a new one fires, an unanswered previous one becomes **Missed**
- The **Activity Log** is built from **Responses** and **Missed** Reminders; the user self-reports, and nothing is detected from sensors

## Flagged ambiguities

- "Recording a workout" vs. "being active": resolved. Activity means a self-reported Done Response, not a detected movement.
