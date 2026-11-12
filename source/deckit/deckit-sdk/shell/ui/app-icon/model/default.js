// MARK: - Property
// What a mod whose icon reads as none is drawn with: a grey tile with an outlined cube, on the app icons' grid.
const DEFAULT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
<defs><linearGradient id="dft" x1="0" y1="8" x2="0" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#c5cad2"/><stop offset="1" stop-color="#8e95a0"/></linearGradient>
<linearGradient id="dfr" x1="0" y1="8" x2="0" y2="120" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>
<linearGradient id="dfw" x1="0" y1="20" x2="0" y2="108" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e6eaf0"/></linearGradient>
<linearGradient id="dfh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="dfs" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#000" flood-opacity=".18"/></filter>
<clipPath id="dfc"><rect x="8" y="8" width="112" height="112" rx="26"/></clipPath>
</defs>
<rect x="8" y="8" width="112" height="112" rx="26" fill="url(#dft)"/>
<g filter="url(#dfs)">
<g fill="none" stroke="url(#dfw)" stroke-width="8" stroke-linejoin="round" stroke-linecap="round">
<path d="M64 26 L98 44 V84 L64 102 L30 84 V44 Z"/>
<path d="M30 44 L64 62 L98 44 M64 62 V102"/>
</g></g>
<rect x="8.5" y="8.5" width="111" height="111" rx="25.5" fill="none" stroke="url(#dfr)"/>
</svg>
`;

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { DEFAULT_ICON };
