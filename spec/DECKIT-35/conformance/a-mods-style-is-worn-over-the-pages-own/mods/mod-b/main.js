module.exports = class {
    attach() {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':root { --case-order: own; }');
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
};
