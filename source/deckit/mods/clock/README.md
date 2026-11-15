# Clock

The date and time in the status bar, the machine's, short, as the language you set writes them: the day, the date and the time to the minute, written again as each minute turns. A press on it opens the notification center (the Notifications mod's README, `notifications/center`), and a press again closes it. Where no mod provides `notifications/center`, a press does nothing.

It declares its item to the status bar (the Status Bar mod's README) and runs in the background from the start, setting the item's label. It is no app: it has no Dock item and no window of its own.

## Commands

| Command | What it does |
|---|---|
| `toggle-center` | opens the notification center, or closes it where it is open |
