DeckitModule.define("deckit/ui/kit/component/popover", { uses: ["deckit/ui/token"], provides: ["make"] }, (T) => {
  const { MOTION } = T;

  return { make: (theme, ui, inner) => {
    return {
      popover({ width = "", onClose } = {}) {
        const pop = document.createElement("div");
        Object.assign(pop.style, {
          position: "fixed", display: "none", maxWidth: width || "340px", minWidth: "230px",
          padding: "12px 14px", borderRadius: "10px", border: theme.border, background: theme.contentBg,
          color: theme.contentColor, boxShadow: "0 10px 32px rgba(0,0,0,.32)", boxSizing: "border-box",
          font: "13px " + theme.font, lineHeight: "1.5",
        });
        document.body.appendChild(pop);
        let layer = null, at = null;
        const keys = (e) => {
          if (e.key !== "Escape" || !layer?.isTop()) return;
          e.preventDefault(); e.stopPropagation(); close();
        };
        const close = () => {
          if (!layer) return;
          layer.drop();
          layer = null;
          window.removeEventListener("keydown", keys, true);
          pop.style.transition = `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.fast} ${MOTION.ease}`;
          Object.assign(pop.style, { opacity: "0", transform: "translateY(-4px)" });
          const ms = parseFloat(MOTION.fast) || 0;
          setTimeout(() => { if (!layer) pop.style.display = "none"; }, ms);
          onClose?.();
        };
        pop.show = (anchor) => {
          at = anchor;
          if (!layer) {
            // A press on the card or on what it is about is the card's; any other puts it away (token.js).
            layer = T.raise({ close, contains: (t) => pop.contains(t) || !!(at && at.contains(t)) });
            pop.style.zIndex = String(layer.z);
            // Next tick: the key that opened it must not be the one that closes it.
            setTimeout(() => { if (layer) window.addEventListener("keydown", keys, true); }, 0);
          }
          Object.assign(pop.style, { display: "block", left: "0px", top: "0px", transition: "none" });
          const a = anchor.getBoundingClientRect(), box = pop.getBoundingClientRect();
          const below = a.bottom + 6;
          pop.style.left = Math.min(Math.max(8, a.left), window.innerWidth - box.width - 8) + "px";
          pop.style.top = (below + box.height > window.innerHeight - 8 ? Math.max(8, a.top - box.height - 6) : below) + "px";
          T.play(pop, { opacity: "0", transform: "translateY(-4px)" }, {
            transition: `opacity ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.fast} ${MOTION.ease}`,
            opacity: "1", transform: "none",
          });
          return pop;
        };
        pop.close = close;
        Object.defineProperty(pop, "open", { get: () => !!layer });
        return pop;
      },
    };
  } };
});
