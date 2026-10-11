DeckitModule.define("app/shell", {
  uses: [
    "deckit/service/home/model/config",
    "deckit/feature/window/main",
  ],
  provides: ["make"],
}, (CONFIG, FRAME) => {
  const { BrowserWindow } = require("electron");

  const make = ({ restart }) => {
    const KEY = "panel";
    const state = {
      win: null,
      opening: null,   // the open in progress: a second reveal waits on it rather than opening twice
    };
    let deck = null;
    let switcherView = null;
    const live = (win) => (win && !win.isDestroyed() ? win : null);
    const panelPage = () => deck?.panel.view()?.webContents || null;

    const reveal = () => {
      if (!deck) return Promise.resolve(null);
      const open = live(state.win);
      if (open) { FRAME.raise(open); return Promise.resolve(open); }
      if (state.opening) return state.opening;
      state.opening = deck.panel.presentInWindow({
        key: KEY, title: CONFIG.name, boundsKey: "window-bounds",
        onClose: () => {
          state.win = null;
          deck.panel.hide();
        },
      })
        .then((win) => (state.win = live(win)))
        .catch((e) => { console.error("[deckit] the panel's window did not open", e); return null; })
        .finally(() => { state.opening = null; });
      return state.opening;
    };

    // The panel and switcher pages are views this file placed in the panel's window.
    const windowOf = (wc) => {
      if (!wc) return null;
      if (wc === panelPage() || (switcherView && wc === switcherView.webContents)) return live(state.win);
      return BrowserWindow.fromWebContents(wc);
    };

    // A second press closes it. It took the keyboard when it opened, so the panel takes it back.
    const summonSwitcher = (wc) => {
      const win = windowOf(wc);
      const here = deck.switcher.shown();
      deck.switcher.close();
      if (here || !live(win) || win !== live(state.win)) return;
      const view = deck.switcher.view();
      if (!view) return;
      switcherView = view;
      FRAME.place(view, win, { front: true, onClose: () => deck.switcher.close() });
      deck.switcher.open().then((closed) => { if (closed && deck.panel.shown()) deck.panel.focus(); });
    };

    return Object.freeze({
      start: (d) => { deck = d; reveal(); },
      showsPanel: (wc) => {
        if (switcherView && wc === switcherView.webContents) return false;
        const win = windowOf(wc);
        return !!win && win === live(state.win) && !deck.switcher.shown();
      },
      reveal: () => { reveal(); },
      // Never called: the panel is presented as not dismissible.
      dismiss: () => {},
      summonSwitcher,
      noticeClicked: () => { reveal(); },
      restart,
    });
  };

  return Object.freeze({ make });
});
