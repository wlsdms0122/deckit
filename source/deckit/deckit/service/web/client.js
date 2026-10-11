DeckitModule.define("deckit/service/web/client", {
  uses: ["deckit/service/web/model/protocol"],
  provides: ["page", "window", "session", "connect"],
}, (PROTOCOL) => {
  const electron = () => { try { return require("electron"); } catch { return null; } };

  // Unique across reloads of this document, since main may still be closing the last one's pages.
  const boot = Date.now().toString(36);
  let seq = 0;

  const byContents = new Map();
  // What main said about a page before this side knew which element it was.
  const early = new Map();
  const earlyEvents = new Map();   // id -> [[event, payload]], in order
  const deliver = (id, event, payload) => {
    const p = byContents.get(id);
    if (p) { p.receive(event, payload); return; }
    if (!earlyEvents.has(id)) earlyEvents.set(id, []);
    earlyEvents.get(id).push([event, payload]);
  };

  // `owner` ({ deliver, recordFailure }) is whoever hands out the page, never the caller's own options.
  const handleOf = (owner, session, url = "") => {
    let delegate = null;
    const tell = (method, ...args) => {
      const fn = delegate?.[method];
      if (typeof fn === "function") owner.deliver(`page delegate ${method}()`, fn.bind(delegate), ...args);
    };
    const ask = async (method, fallback, ...args) => {
      const fn = delegate?.[method];
      if (typeof fn !== "function") return fallback;
      try { return await fn.apply(delegate, args); }
      catch (e) { owner.recordFailure(`page delegate ${method}() threw: ${(e && e.message) || e}`); return fallback; }
    };
    // Only false keeps the default back, so an owner that forgot to answer does not lose the request.
    const otherwiseOpen = async (method, url, options) => {
      if ((await ask(method, true, url, options)) === false) return;
      opener.open(url, options);
    };
    const receive = (event, payload) => {
      switch (event) {
        case "change": return tell("didChange", payload);
        case "press": return tell("didFocus");
        case "certificate": return tell("didRefuseCertificate", payload);
        case "notification": return tell("didReceiveNotification", payload);
        case "found": return tell("didFind", payload);
        case "close": return tell("didRequestClose");
        // A window gone is gone for good: nothing more is heard about it.
        case "closed": forget(); return tell("didClose");
        // Anything but true refuses: unanswered, the page would wait on it for as long as it lives.
        case "permission": {
          const { answer, ...request } = payload;
          return ask("decidePermission", false, request).then((allow) => answer(allow === true));
        }
        case "leave": return otherwiseOpen("shouldLeave", payload.url);
        case "window": return otherwiseOpen("shouldOpenWindow", payload.url, payload.options);
      }
    };
    const state = {
      url, title: "", icon: "", loading: !!url, canGoBack: false, canGoForward: false,
      audible: false, muted: false, capture: { microphone: false, camera: false, screen: false },
    };
    const apply = (next) => { Object.assign(state, next || {}); receive("change", { ...state }); };
    let id = null;
    const waiting = [];
    const act = (op, arg) => {
      if (id === null) { waiting.push([op, arg]); return; }
      PROTOCOL.act.send({ id, op, arg });
    };
    const know = (known) => {
      id = known;
      byContents.set(id, { apply, receive });
      if (early.has(id)) { apply(early.get(id)); early.delete(id); }
      for (const [event, payload] of earlyEvents.get(id) || []) receive(event, payload);
      earlyEvents.delete(id);
      for (const [op, arg] of waiting.splice(0)) act(op, arg);
      act("state");
    };
    const forget = () => { if (id !== null) byContents.delete(id); };
    const handle = {
      session,
      get state() { return { ...state }; },
      load(to) {
        const next = String(to || "");
        // Through main, which holds every load to one rule; before the page is known, act queues it.
        if (next) act("load", next);
      },
      back: () => act("back"),
      forward: () => act("forward"),
      reload: () => act("reload"),
      stop: () => act("stop"),
      mute: (on) => act("mute", !!on),
      find: (text, { start = false, back = false, matchCase = false } = {}) => act("find", { text: String(text || ""), start, back, matchCase }),
      stopFind: ({ keepSelection = false } = {}) => act("find-stop", keepSelection ? "keep" : "clear"),
      get delegate() { return delegate; },
      set delegate(next) { delegate = next && typeof next === "object" ? next : null; },
    };
    return { handle, know, forget, receive, act, isKnown: () => id !== null };
  };

  // `partition` has to be on the element before `src` is.
  const page = (partition, { url = "" } = {}, owner, session = null) => {
    const { handle, know, forget, receive, isKnown } = handleOf(owner, session, url);
    const key = boot + "-" + (++seq);
    // Not a frame: a framed page knows it is framed, and the cookies it writes are third-party.
    const element = document.createElement("webview");
    element.dataset.deckitPage = key;
    element.setAttribute("partition", partition);
    element.setAttribute("src", url || "about:blank");
    // Without it a <webview> refuses every window.open before main is asked.
    element.setAttribute("allowpopups", "");
    /* White under the page, as a browser has: a <webview> is see-through and Electron gives its page
       no background, so a site that leaves its own unset would show the panel through its text. */
    Object.assign(element.style, { position: "absolute", inset: "0", width: "100%", height: "100%", background: "#fff" });
    let closed = false;
    /* The <webview>'s methods exist only in the document's main world, not this preload's, so the
       id is read from there once and everything else goes through main. */
    const learn = async () => {
      if (isKnown() || closed) return;
      let id = null;
      try {
        id = await electron()?.webFrame.executeJavaScript(
          `document.querySelector('webview[data-deckit-page="${key}"]')?.getWebContentsId() ?? null`);
      } catch { id = null; }
      if (id === null || id === undefined || closed) return;
      know(id);
    };
    element.addEventListener("dom-ready", learn);
    element.addEventListener("close", () => { if (!closed) receive("close"); });
    // Focus is the only sign of a click in the page this document gets.
    element.addEventListener("focus", () => receive("press"));
    return Object.defineProperties(handle, {
      element: { value: element, enumerable: true },
      focus: { value: () => element.focus(), enumerable: true },
      close: { value: () => { closed = true; forget(); element.remove(); }, enumerable: true },
    });
  };

  const windowPage = (partition, { url = "", title = "" } = {}, owner, session = null) => {
    const { handle, know, act, receive } = handleOf(owner, session, url);
    Promise.resolve().then(() => PROTOCOL.window.ask({ partition, url: String(url || ""), title: String(title || "") }))
      .catch(() => 0)
      .then((id) => { if (id) know(id); else receive("closed"); });
    return Object.defineProperty(handle, "close", { value: () => act("close"), enumerable: true });
  };

  PROTOCOL.state.hear(({ id, state: next }) => {
    const p = byContents.get(id);
    if (p) p.apply(next); else early.set(id, next);
  });
  PROTOCOL.certificate.hear(({ id, certificate }) => deliver(id, "certificate", certificate));
  PROTOCOL.found.hear(({ id, matches, active, final }) => deliver(id, "found", { matches, active, final }));
  PROTOCOL.leave.hear(({ id, url }) => deliver(id, "leave", { url }));
  PROTOCOL.opens.hear(({ id, url, activates, target }) => deliver(id, "window", { url, options: { activates, target } }));
  PROTOCOL.permission.hear(({ id, ask, origin, permissions, app, url }) => {
    let answered = false;
    deliver(id, "permission", {
      origin, permissions, app: app || "", url: url || "",
      answer(allow) {
        if (answered) return;
        answered = true;
        PROTOCOL.permit.send({ ask, allow: !!allow });
      },
    });
  });
  PROTOCOL.notification.hear(({ id, notification, title, body, silent }) => {
    deliver(id, "notification", {
      title, body, silent,
      click: () => PROTOCOL.act.send({ id, op: "notification-click", arg: notification }),
    });
  });

  PROTOCOL.closed.hear(({ id }) => deliver(id, "closed"));

  // Through a promise, so a payload the protocol refuses rejects rather than throws.
  const invoke = (end, payload) => Promise.resolve().then(() => end.ask(payload));

  const session = (partition) => Object.freeze({
    fetchText: (url) => invoke(PROTOCOL.fetchText, { partition, url: String(url || "") }),
    clear: () => invoke(PROTOCOL.clear, { partition }),
    trust: (entries) => invoke(PROTOCOL.trust, { partition, entries: [].concat(entries || []) }),
    allow: (entries) => invoke(PROTOCOL.allow, { partition, entries: [].concat(entries || []) }),
    revoke: (entries) => invoke(PROTOCOL.revoke, { partition, entries: [].concat(entries || []) }),
  });

  let opener = { open: () => {} };

  return {
    page,
    window: windowPage,
    session,
    connect: ({ open } = {}) => { if (typeof open === "function") opener = { open }; },
  };
});
