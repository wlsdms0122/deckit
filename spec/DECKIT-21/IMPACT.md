# What DECKIT-21 changes

| DECKIT | sentence | change | class |
|---|---|---|---|
| DECKIT-1 | *The host*, the table of bases, the row `system`: "the system alone, with nothing shipped, which opens none of the addresses it is handed to open outside the app" | format 7: adds "which shows none of the notifications of the machine it is handed to show and answers of each that the machine took it"; made in place, before Deckit's first release | supplement |
| DECKIT-1 | *What the system gives a host* | format 7: adds the row "the notifications of the machine", while the host app is started: "each notification a mod hands the host to show on the machine, which the host answers whether the machine took, and a press on one, which the host hands the system, as [notifications of the machine](../DECKIT-21/SPEC.md) fix them"; made in place | supplement |
| DECKIT-1 | *Steps*, the inputs | format 7: adds the input `press`, with the key `notification`: "the notification of the machine at the place `notification` in what `shown` answers is pressed"; made in place | supplement |
| DECKIT-1 | *Steps*, the looks | format 7: adds the look `shown`: "an array of each notification of the machine the system handed the host to show since the host app last started, in the order handed, each a table `{ title, body, silent }`"; made in place | supplement |
| DECKIT-1 | *Steps*, the keys | format 7: adds the key `notification`: "integer: the place, from 1, of a notification in what `shown` answers"; made in place | supplement |
| DECKIT-1 | *Steps*: "A `heard` look at a mod with no run `running` comes to nothing." | adds "A `press` comes to nothing where `shown` answers no notification at the place `notification`."; made in place | supplement |
| DECKIT-1 | *Steps*: "A case starts the host app again only after a `quit`, and calls and looks only while the host app is started" | "calls, presses and looks"; made in place | supplement |
| DECKIT-1 | *Formats* | adds "Format **7** adds the rows that say so, for what of the machine the base stands for", of which the notifications of the machine, shown and pressed, with [the clipboard](../DECKIT-20/SPEC.md), which adds to the same format; made in place | supplement |
| DECKIT-1 | Interactions | adds "The notifications a mod hands the host to show, what `shown` answers of each, and a press: [notifications of the machine](../DECKIT-21/SPEC.md)."; made in place | supplement |
| DECKIT-1 | `conformance/` | adds the case `shown-answers-the-notifications-handed-since-the-app-last-started`, which holds the look `shown`; made in place | supplement |
| DECKIT-7 | *The handle*, the row `notifications.show(notification)`: "the notifications' DECKIT" | links [notifications of the machine](../DECKIT-21/SPEC.md); made in place, DECKIT-7 being a draft | supplement |
| DECKIT-19 | *Rules*, the note "How a notification is shown ...": "a notification of the machine's through `notifications.show` of [the handle](../DECKIT-7/SPEC.md)" | "through `notifications.show`, as [notifications of the machine](../DECKIT-21/SPEC.md) fix it"; made in place, DECKIT-19 being a draft | supplement |
| DECKIT-19 | Interactions: "`INVALID_ARGUMENT`, what a value is, and `notifications.show`: [the handle](../DECKIT-7/SPEC.md)." | "`INVALID_ARGUMENT` and what a value is: [the handle](../DECKIT-7/SPEC.md)." and adds "A notification shown on the machine, and a press of it heard: [notifications of the machine](../DECKIT-21/SPEC.md)."; made in place | supplement |
| DECKIT-19 | Notes: "`silent`, `command`, `args`, and what a press runs: no input of the case format presses a notification, and how one is shown is the owner's." | "how a notification is shown is the owner's, so no case knows that one is shown on the machine where the input `press` of the case format presses it"; made in place | supplement |

No case of DECKIT-1 to DECKIT-20 changes its answer.
