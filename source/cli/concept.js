const CONCEPT = /^deckit\/(feature|service|module|ui)\/([^/]+)(?:\/(.+))?$/;

// A concept's face, what another concept may name, is the files at its root and its model/.
const conceptOf = (name) => {
  const found = CONCEPT.exec(name);
  if (!found) return null;
  const [, layer, folder, rest = ""] = found;
  return { concept: `deckit/${layer}/${folder}`, layer, face: !rest.includes("/") || rest.startsWith("model/") };
};

module.exports = { conceptOf };
