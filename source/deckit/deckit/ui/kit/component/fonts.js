DeckitModule.define("deckit/ui/kit/component/fonts", { uses: [], provides: ["make"] }, () => {

  return { make: (theme, ui, inner) => {
    return {
      /* A face that is not installed falls back and measures like the fallback, so a width unlike both
         generic fallbacks means it is there. */
      installedFonts(faces) {
        const ctx = document.createElement("canvas").getContext("2d");
        const probe = "mmmmmmmmmmlli1|WW@#";
        const width = (font) => { ctx.font = `20px ${font}`; return ctx.measureText(probe).width; };
        const mono = width("monospace"), serif = width("serif");
        return faces.filter((f) => !f.font || width(`${f.font}, monospace`) !== mono || width(`${f.font}, serif`) !== serif);
      },
    };
  } };
});
