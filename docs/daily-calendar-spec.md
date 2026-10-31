# Daily calendar: a month of daily years, a streak and an average

Phase 6, rank 4 in `review-plan.md`. Approved by Ben and built 2026-10-30, with both open choices as
recommended.

## The answer

Past festivals opens with a month grid of daily years. Each day you finished is a square filled in that
festival's medal colour with its score on it, so a good month reads at a glance. Under the grid: your current
streak, your longest streak, and the month's average and best. The streak also shows on the title screen's
Daily year button, on a daily year's festival screen, and on the share card.

Nothing new is saved and there are no rule changes. Everything comes from the daily years the journal already
keeps, and the streak earns no points or renown.

## How it plays

- **Which day a year belongs to:** the date in its seed (`daily-2026-10-30`), not the day it was finished. A
  daily started at 11:58 pm and finished after midnight still counts for the day it was dealt. Only the first
  finish of a day is in the journal already (`recordYear` skips a seed it has), so replays can't pad a streak.
- **Streak:** the run of days in a row with a finished daily, ending today. If today isn't played yet, the
  run ending yesterday still counts, so the streak doesn't drop to zero over breakfast. Miss a whole day and it
  goes back to zero. The longest streak is kept as well, worked out from the same years, so a broken streak
  isn't forgotten.
- **The grid:** seven columns, Sunday first, one month at a time with ‹ › to step back to the month of your
  first daily and forward to this month.

  | Day | Drawn as |
  |---|---|
  | Played, with a tier | Filled in the medal colour (bronze, silver, gold, Golden with its glint), score in the middle, date in the corner |
  | Played, a quiet year | Plain paper with the score |
  | Missed | Just the date, faded |
  | Today, not played yet | Dashed rust outline |
  | Days to come | Empty |

  The medal colours are the ones the festival screen's `medal` classes already use.
- **Under the grid:** "Streak 4 days · longest 9" and "October: 12 played · average 28 · best 41". The month
  line follows the ‹ › buttons; the streaks don't.
- **Tap a played day:** the matching row below opens to its score card and scrolls into view, the same as
  tapping the row.
- **Title screen:** the Daily year button reads "Daily year · streak 4 · played, 31 points" once today is done,
  and "Daily year · keep your 4-day streak" before. No streak, no change from today.
- **A daily's festival screen:** one line under the share button: "Day 4 in a row." or "A new streak starts
  today." Its new **Calendar** button opens Past festivals; Back returns to the festival.
- **Share card:** the first line gains the streak once it is 2 or more:
  `Underbrush daily · 2026-10-30 · streak 4`. Still spoiler-free.
- **No dailies yet:** the grid shows this month empty with "Play today's daily year to start a streak."
- **Screen reader:** each day is a button labelled like "October 12: Silver, 31 points", or "October 13: not
  played".

## Open choices for Ben

1. **A rest day.** Recommended: none. A plain streak is easy to read and fits on the share card, and the
   longest streak softens a miss. The alternative is one free missed day a week, which is kinder but needs a
   line of explanation wherever the streak shows.
2. **Where the calendar lives.** Recommended: at the top of Past festivals, as the plan says, with the
   festival screen's Calendar button as the quick way in. Today Past festivals is three taps from the title
   (title, Almanac, Past festivals). The alternative is a Calendar button on the title screen, which is quicker
   but adds a sixth button to a busy menu.

## Implementation plan

- **Core** (`src/core/journal.ts`): a pure `dailyStats(years, today)` returning the year for each date, the
  current and longest streaks, and a month's count, average and best. Pure so a test can pin it, and so the
  title, festival screen, share card and calendar all agree.
- **Calendar** (`src/ui/History.tsx`): a `DailyCalendar` above the list, with its own month state. Tapping a day
  sets the list's `open` to that seed and scrolls the row into view.
- **Title** (`src/ui/Screens.tsx`): the streak in the Daily year button.
- **Festival screen** (`src/ui/YearEnd.tsx`): the streak line and the Calendar button, dailies only.
  `App.tsx` gets a back target for the history view, so Back from Past festivals goes to the festival when it
  was opened from there and to the Almanac otherwise.
- **Share** (`src/ui/share.ts`): `shareText` takes the streak as an optional argument.
- **Styles** (`src/ui/styles.css`): the grid, medal fills, today's outline, faded misses. Squares about 44 px at
  375 px wide, so seven fit with the screen's padding.
- **Balance:** none. No points, no renown, no rules change, so no sim and no `tierLift` re-check.
- **Tests:** a new `daily.test.ts` for `dailyStats`: today played, today not yet played, a missed day, a streak
  across a month end, story years ignored, the longest kept after a break, and a month's average. `npm test` and
  the type check must pass. Browser check at 375 × 812 with a few daily years written into a backed-up save:
  the grid, a tap on a day, the title button, and the festival screen's line and Calendar button.
- Then a short section in `docs/DESIGN.md` and a Progress entry in `review-plan.md`.
