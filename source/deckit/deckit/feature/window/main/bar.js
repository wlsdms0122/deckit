DeckitModule.define(
    'deckit/feature/window/main/bar',
    {
        uses: [],
        provides: ['HEIGHT', 'LIGHTS', 'SHOW_AT', 'HIDE_PAST', 'HIDE_DELAY', 'MOTION_MS', 'EASE', 'watch'],
    },
    () => {
        const HEIGHT = 38;
        // Room the macOS window buttons take in the corner.
        const LIGHTS = 82;
        const SHOW_AT = 6; // pointer this close to the top edge brings the bar down
        const HIDE_PAST = HEIGHT + 6; // and it goes back up once the pointer is below it
        const HIDE_DELAY = 90;
        // Longer and softer than the app's usual 170ms: a large surface moving a short distance snaps at that speed.
        const MOTION_MS = 260;
        const EASE = 'cubic-bezier(.2,.7,.3,1)';

        /* Fed pointer positions, not events: over the window buttons macOS takes the pointer and reports
     nothing, so event-based leave detection fires there. `soon` must not restart a running
     countdown: the caller polls every 50ms, so a restarted 90ms countdown would never run out. */
        const watch = ({ show, hide }) => {
            let timer = null;
            const cancel = () => {
                clearTimeout(timer);
                timer = null;
            };
            const soon = () => {
                if (timer) return;
                timer = setTimeout(() => {
                    timer = null;
                    hide();
                }, HIDE_DELAY);
            };
            return {
                // y in the window's content coordinates.
                moved(y) {
                    if (y <= SHOW_AT) {
                        cancel();
                        show();
                        return;
                    }
                    if (y > HIDE_PAST) soon();
                    else cancel();
                },
                left: soon,
                stop: cancel,
            };
        };

        return {
            HEIGHT,
            LIGHTS,
            SHOW_AT,
            HIDE_PAST,
            HIDE_DELAY,
            MOTION_MS,
            EASE,
            watch,
        };
    }
);
