const styled = (tag, style = {}, text) => {
const node = document.createElement(tag);
Object.assign(node.style, style);
if (text != null) node.textContent = text;
return node;
};

module.exports = { styled };
