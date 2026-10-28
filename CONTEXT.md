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

**Response**:
What the user tells the app after a Reminder: Done, Skip, or Snooze. A Done Response records which of the suggested Exercises were performed.
_Avoid_: check-in, completion

**Activity Log**:
The history of Responses: the app's record of whether the user moved.
_Avoid_: workout history

## Relationships

- A **Reminder** carries one **Suggestion**
- A **Suggestion** contains 1–3 **Exercises**, drawn from the **Exercise Library**
- A **Reminder** gets at most one **Response**; a Snooze schedules a follow-up **Reminder**
- The **Activity Log** is built only from **Responses**; the user self-reports, and nothing is detected from sensors

## Flagged ambiguities

- "Recording a workout" vs. "being active": resolved. Activity means a self-reported Done Response, not a detected movement.
