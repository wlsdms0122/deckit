// The view files run as one script, so this is in scope in all of them.
const el = (tag, style = {}, text) => {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (text != null) e.textContent = text;
  return e;
};
