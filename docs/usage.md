# Using Second Brain

Second Brain is the shared board for planning the CAIS++ year. It has four
working areas — Schedule, GM ideas, To-do, and E-board meeting agenda — plus a
Home page that explains the board and links to each one.

Board changes save automatically; there is no button to save the whole board.

## Getting around

- The navigation bar is pinned to the top of the screen, so you can switch
  areas at any time: **Home**, **Schedule**, **GM ideas**, **To-do**, and
  **E-board meeting agenda**.
- The address bar follows the section (`#schedule/fall`, `#todos`, and so on),
  so browser Back and Forward work and a link opens the same view.
- A link can point at one task, for example
  `#schedule/fall/week-13/task-<id>` or `#todos/task-<id>`. Opening it reveals
  the right section, scrolls the row into view, and briefly highlights it.
- **Search** (the magnifier in the navigation bar, or `⌘K` / `Ctrl+K`) looks
  through task titles, descriptions, tags, GM ideas, to-dos, and section names.
  Use the arrow keys and Enter to jump to a result.
- **This week** in the navigation bar jumps to the week containing today, from
  any section.
- **Home** is the landing page. Its four cards jump straight to the working
  areas and show live counts, including overdue to-dos and the next meeting.
- **Schedule** has a second row of term buttons: **Before the year**,
  **Fall semester**, and **Spring semester**. The board remembers the term you
  last viewed for the session, so leaving Schedule and coming back lands where
  you left off.
- The first time you open Schedule in a session, it jumps to the week that
  contains today (when today falls inside a semester).

## Schedule

Fall and Spring are numbered from USC's official Classes Begin and Classes End
dates, and each week header shows its date range. Fall Week 1 and Spring Week 1
start on the first day of classes rather than on a fixed calendar date.

**Before the year** holds two sections: _Before end of spring semester_ (handoff
work such as confirming leads and writing descriptions) and _Summer_.

The board starts with a set of default events already placed in the right weeks.
They can be moved, renamed, or deleted like any other task.

When the current week is late in a term, the earlier weeks are hidden behind a
**Show N earlier sections** control so you do not have to scroll past them. Use
**Hide earlier sections** to fold them away again. The current week is marked
**THIS WEEK**.

USC holidays and recesses appear as reference rows with their own styling. They
are tied to real dates and cannot be checked off.

### GM blocks

Each week's GM is grouped into a labelled **GM** block. The GM row comes first,
and everything scheduled for that meeting — agenda items, prep tasks, and
assigned ideas — sits below it in the same block. The block counts its open
items, so it is clear at a glance which rows belong to the GM rather than to the
week in general.

A prep task can be scheduled in an earlier week than its GM. It then appears in
that earlier week as a **GM prep** block labelled with the GM's date and meeting
time, so you can still tell which meeting the work is for.

### Moving and spanning tasks

- Use the **⋯** menu on a task row to move it to another week.
- To make a task span several weeks, choose an end section in **spanning
  through** when adding it, or change **Span** in the task's Edit panel. A
  spanning task is listed under every week it covers, with the range shown
  under its title.
- The **Must be after** and **and before** fields when adding a task create
  ordering rules. The Edit panel lists the rules and lets you remove them.

## Tasks, subtasks, and descriptions

Add tasks with the field at the end of each section. To-dos also accept an
optional due date.

Each row has these controls:

- **Checkbox** — mark the task done. Holiday rows show a calendar marker and
  cannot be checked off.
- **▸ / task title** — open or close the description.
- **⋯** — open the row menu:
  - **Edit** changes the title, tags, span, lead time (for subtasks), and
    ordering rules.
  - **Add subtask** attaches work to a GM or task. Subtasks are scheduled in the
    same week or an earlier one, and their lead time says how many weeks before
    the parent they should be done. GM events use this to attach agenda items
    and follow-up work; those items appear in that GM's block for the week.
  - **Move to** sends the task to another section.
  - **Duplicate** inserts a copy right after the original, with the title
    suffixed “(copy)”. The copy starts unchecked and keeps tags, description,
    span, and due date.
  - **Copy link** copies a URL that opens the board at this task.
  - **Delete** removes the task and its subtasks. They go to **Recently
    deleted**.

Descriptions open inline and render as nested bullet points. Write one bullet
per line; indent with two spaces or a tab to nest a level. Bullet markers
(`-`, `*`, `•`) are optional. The description has its own **Save** button;
closing it without saving discards the draft.

## Tags and filtering

Tasks can carry one or more tags: **Projects**, **Curriculum**,
**Recruitment**, **Social events**, and **GM**.

The filter bar above the board shows only tasks with the selected tags. Selecting
several tags matches tasks with any of them. With no tags selected, everything
shows.

While a filter is active, an **Add while filtered** bar stays at the top of the
section. Choose a section, type the task, and it is tagged with the active
filters automatically so it appears immediately.

When anything is completed, **Hide completed** appears beside the tag filters.
It hides completed rows for the rest of the session without deleting them. Week
headers always show `done/total` alongside the open count.

Rows marked **Suggestion** are ideas for social events, not confirmed plans.
Keep, rename, move, or delete them as you like.

## GM ideas

The **GM ideas** area is a backlog for ideas that are not scheduled yet. Each
idea is a normal task with a checkbox, description, and tags, but it is not tied
to a week.

- **Suggested month** groups GM weeks in that month first when you assign the
  idea.
- **Assign to GM…** turns the idea into a task under that meeting, inside the
  GM's block for the week.
- **↩ Return to ideas** sends an assigned item back to the backlog.

Tagging a social event automatically creates three follow-up subtasks at their
lead times: **Poll for interest** four weeks before, **Start planning** three
weeks before, and **Announce** two weeks before. Follow-ups stay inside the
event's semester, and a deleted follow-up is not recreated. Retreats, the big
little reveal, and E-ball are planned directly, so they do not get these
automatic follow-ups.

## To-do

The **To-do** area is a checklist for work that is not tied to a week. Due dates
are optional; items are grouped by urgency:

- **Overdue**
- **Urgent** (due today or tomorrow)
- **Within the next week**
- **Within the next month**
- **Later or no due date**
- **Completed**

To-dos use the same checkboxes, descriptions, tags, and editing controls, but
they do not use spans, ordering rules, or subtasks.

The completed summary above the list has **Clear completed**, which moves every
checked to-do into one **Recently deleted** batch so it can be restored. The
summary also hides or shows the completed group for the session.

Two kinds of work appear here automatically:

- When the current week has a GM, that GM gets **Update social points** and
  **Make GM slides** as weekly prep tasks.
- When the current week has an e-board meeting, **Make e-board meeting agenda**
  appears as a to-do due on the meeting day.

Both are created only for the current week rather than seeded across the year.
Deleting one does not recreate it, and unfinished recurring work does not carry
forward into later weeks. A meeting day that falls on a USC holiday skips the
agenda task for that week.

## E-board meeting agenda

The **Weekly e-board meeting** card near the top of the board sets the meeting's
day of the week and time. GM rows and the GM assignment picker use that same slot,
so changing it updates every week at once. The default is Wednesday at 7:00 PM.

The **E-board meeting agenda** area drafts the next meeting from the board:

- It pulls open events from every week the meeting covers, plus open to-dos due
  by the end of that coverage.
- A meeting that happens after Wednesday's GM starts with the following week, so
  it plans the next GM rather than repeating the one that just happened. An
  earlier meeting starts with its own week.
- A week whose meeting day is a USC holiday has no meeting, so its items roll
  into the meeting before it. For example, Thanksgiving week items appear on the
  previous week's agenda.
- Every agenda row has an **Open** link back to the task on the board.
- **Copy as Markdown** puts the agenda on the clipboard as a plain checklist for
  a doc or message. **Print** opens the browser's print dialog with the board
  chrome hidden.

## Undo, deleted items, and reset

The toolbar above the board has three recovery tools:

- **Undo / Redo** — step through the current session's changes. Use the buttons
  or `⌘Z` / `Ctrl+Z` to undo and `⇧⌘Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) to redo.
  The button tooltip names the change it will reverse. Shortcuts pause while you
  are typing in a form field. History is kept in memory, so it clears on reload
  or when another tab changes the board.
- A short **toast** appears after deleting a task, clearing completed to-dos,
  resetting the board, or changing the meeting time. Its **Undo** button reverses
  that one change.
- **Recently deleted** — deleting an event, to-do, or GM task moves it to this
  list, newest first. Restore puts it back in its section together with its
  subtasks and ordering rules. The list keeps the 25 most recent deletions and
  is saved with the board.
- **Reset board** — clears this year's events, tasks, descriptions, GM ideas,
  to-dos, and recently deleted items, then restores the default board and the
  Wednesday 7:00 PM meeting time. The current week's recurring tasks are added
  back. The reset is saved to the server and can be undone until the page
  reloads.

## Saving and sharing

The board is a single shared document. Every change is written to the server's
`data/board.json` (or the path in `BOARD_DATA_FILE`) and cached in the browser so
the page can open before the server responds. If the server is briefly
unavailable, edits stay in the browser and are retried automatically.

The **Saving / Saved / Offline** chip in the toolbar reports the state of that
shared copy. **Saving…** means a write is in flight, **Saved 2:31 PM** means the
server accepted the latest change, and **Offline · retrying** means edits are
still safe in this browser and will be sent when the server is reachable again.

### Other tabs and teammates

The board notices when someone else saves. While this tab is open and visible it
checks the shared copy about every fifteen seconds, and it also checks when you
come back to the tab.

- If this tab has no changes in flight, the newer board appears on its own and a
  short note says newer changes were loaded.
- If you are in the middle of editing, the board is left alone. Instead, a
  banner appears the next time you save, with **Load latest** to discard this
  tab's changes and **Keep mine** to replace the newer shared copy with yours.
  The **Changed elsewhere** chip stays visible until you choose.
- Two tabs in the same browser also stay in step through the browser's local
  storage.

Neither copy is overwritten silently: the server refuses a save that was based
on an older board, which is what turns a collision into the banner instead of
lost work.

Reset clears board content; it does not move the academic calendar forward. To
start a new year, see
[Starting a new academic year](maintenance.md#starting-a-new-academic-year).

## Keyboard and quick reference

| Action | Shortcut |
| --- | --- |
| Search the board | `⌘K` / `Ctrl+K` |
| Open the selected search result | `Enter` |
| Move through search results | `↑` / `↓` |
| Undo | `⌘Z` / `Ctrl+Z` |
| Redo | `⇧⌘Z` / `Ctrl+Shift+Z` or `Ctrl+Y` |
| Close search or the reset panel | `Esc` |
