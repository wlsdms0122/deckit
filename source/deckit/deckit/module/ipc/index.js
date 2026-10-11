DeckitModule.define("deckit/module/ipc", { uses: [], provides: ["ask", "tell", "report"] , runs: "electron",}, () => {
  const electron = require("electron");
  const IN_MAIN = process.type === "browser";

  const kindOf = (value) => (value === null ? "null" : Array.isArray(value) ? "array" : typeof value);
  const fits = (type, value) => type === "any" || kindOf(value) === type;

  const problemOf = (channel, fields, payload) => {
    if (kindOf(payload) !== "object") return `${channel} carries an object, not ${kindOf(payload)}`;
    for (const key of Object.keys(payload)) if (!Object.prototype.hasOwnProperty.call(fields, key)) return `${channel} has no field ${key}`;
    for (const [key, written] of Object.entries(fields)) {
      const optional = written.endsWith("?");
      const type = optional ? written.slice(0, -1) : written;
      const value = payload[key];
      if (value === undefined || value === null) {
        if (!optional) return `${channel} needs ${key}`;
        continue;
      }
      if (!fits(type, value)) return `${channel}'s ${key} is ${kindOf(value)}, not ${type}`;
    }
    return "";
  };
  const sending = (channel, fields, payload) => {
    const problem = problemOf(channel, fields, payload);
    if (problem) throw new Error(`[deckit] ${problem}`);
    return payload;
  };
  const arriving = (channel, fields, payload) => {
    const problem = problemOf(channel, fields, payload);
    if (problem) console.error(`[deckit] refused: ${problem}`);
    return problem;
  };
  const failed = (channel, e) => console.error(`[deckit] ${channel} failed`, e);

  const ask = (channel, fields, { now = false } = {}) => {
    if (IN_MAIN) {
      const { ipcMain } = electron;
      return Object.freeze({
        answer(fn) {
          if (now) {
            /* The page is answered the moment returnValue is set, so it is set once. An answer that
               cannot be sent (a promise, a function) throws as it is set, and the page gets undefined
               rather than waiting forever. */
            ipcMain.on(channel, (e, payload) => {
              if (arriving(channel, fields, payload)) { e.returnValue = undefined; return; }
              try { e.returnValue = fn(payload, e.sender); } catch (error) {
                failed(channel, error);
                e.returnValue = undefined;
              }
            });
          } else {
            ipcMain.handle(channel, (e, payload) => {
              const problem = arriving(channel, fields, payload);
              if (problem) throw new Error(problem);
              return fn(payload, e.sender);
            });
          }
        },
      });
    }
    const { ipcRenderer } = electron;
    return Object.freeze({
      ask: (payload = {}) => (now
        ? ipcRenderer.sendSync(channel, sending(channel, fields, payload))
        : ipcRenderer.invoke(channel, sending(channel, fields, payload))),
    });
  };

  const tell = (channel, fields) => {
    if (IN_MAIN) {
      return Object.freeze({
        send(webContents, payload = {}) {
          // Logged, not thrown: an exception nobody catches in main ends the app.
          const problem = problemOf(channel, fields, payload);
          if (problem) { console.error(`[deckit] not sent: ${problem}`); return; }
          if (!webContents || webContents.isDestroyed()) return;
          try { webContents.send(channel, payload); } catch {}
        },
      });
    }
    const { ipcRenderer } = electron;
    return Object.freeze({
      hear(fn) {
        const listener = (_e, payload) => {
          if (arriving(channel, fields, payload)) return;
          fn(payload);
        };
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
      },
    });
  };

  const report = (channel, fields) => {
    if (IN_MAIN) {
      const { ipcMain } = electron;
      return Object.freeze({
        hear(fn) {
          ipcMain.on(channel, (e, payload) => {
            if (arriving(channel, fields, payload)) return;
            try {
              const out = fn(payload, e.sender);
              if (out && typeof out.catch === "function") out.catch((error) => failed(channel, error));
            } catch (error) { failed(channel, error); }
          });
        },
      });
    }
    const { ipcRenderer } = electron;
    return Object.freeze({
      send: (payload = {}) => ipcRenderer.send(channel, sending(channel, fields, payload)),
    });
  };

  return Object.freeze({ ask, tell, report });
});
