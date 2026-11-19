// A seat's camera, as plain data: the rect `{ x, y, width, height }` of the desktop, a plane with no edge, that the
// seat's screen shows at one point a point. Frames, a seat's points and what a reading names are of the plane; what is
// laid on a screen is of the plane less its camera's top left.

// The top left of the camera of a seat that opens: where that of `from`, the local seat's camera then, is. Its size is
// its screen's.
function opened(from) {
    return { x: from.x, y: from.y };
}

// Whether `width` and `height` are the size of a screen: whole numbers 1 or more.
function isScreen({ width, height }) {
    return [width, height].every((value) => Number.isInteger(value) && value >= 1);
}

// `camera` at the size of its screen, `size`, its top left where it was.
function sized(camera, { width, height }) {
    return { ...camera, width, height };
}

// `camera` moved by a scroll of `dx`, `dy` on the desktop: the plane moves as content moves under a scroll.
function panned(camera, dx, dy) {
    return { ...camera, x: Math.round(camera.x + dx), y: Math.round(camera.y + dy) };
}

// The camera a scroll of `dx`, `dy` at `point` of the plane leaves, a scroll that reaches the desktop where no window,
// the Dock or a view lies: `camera` panned by it, or `camera` itself for one outside it, in the band `bar` high across
// its top, where the bar lies, or that moves nothing.
function scrolled(camera, point, { dx = 0, dy = 0 }, bar) {
    if (!reaches(camera, point) || point.y < camera.y + bar) return camera;
    if (![dx, dy].every(Number.isFinite) || (!dx && !dy)) return camera;
    return panned(camera, dx, dy);
}

// Whether `point` of the plane is in `camera`: one outside it reaches nothing.
function reaches({ x, y, width, height }, point) {
    return point.x >= x && point.y >= y && point.x < x + width && point.y < y + height;
}

// Whether `frame` meets `camera`, some of it shown there.
function meets(camera, frame) {
    return (
        frame.x < camera.x + camera.width &&
        frame.y < camera.y + camera.height &&
        frame.x + frame.width > camera.x &&
        frame.y + frame.height > camera.y
    );
}

// `camera` moved the least way that brings the whole `frame` into `zoomArea`, the zoom area of that camera: across and
// down each on its own, and, along a way the frame is longer than the zoom area, its left or its top to the zoom
// area's.
function brought(camera, frame, zoomArea) {
    const along = (start, length, from, room) => {
        if (length > room || start < from) return start - from;
        return Math.max(0, start + length - (from + room));
    };
    return {
        ...camera,
        x: camera.x + along(frame.x, frame.width, zoomArea.x, zoomArea.width),
        y: camera.y + along(frame.y, frame.height, zoomArea.y, zoomArea.height),
    };
}

// The camera of `size` whose centre is that of `camera`, rounded: what the host app's window shows of a seat it
// follows.
function centredOn(camera, { width, height }) {
    return {
        x: Math.round(camera.x + (camera.width - width) / 2),
        y: Math.round(camera.y + (camera.height - height) / 2),
        width,
        height,
    };
}

// The screen the host app's window shows, `{ seat, camera }`, the seat whose order it shows and the camera that is laid
// in: `own`, the local seat's screen, or, while the local seat follows a seat, a camera of `size`, the host window's,
// centred on the camera of `followed`, that seat's screen, in that seat's order.
function shownBy(own, followed, size) {
    return followed ? { seat: followed.seat, camera: centredOn(followed.camera, size) } : own;
}

// A point or a rect of the plane as it is on the screen `camera` shows, from the screen's top left.
function onScreen(camera, at) {
    return { ...at, x: at.x - camera.x, y: at.y - camera.y };
}

// A point or a rect of the screen `camera` shows, from its top left, as it is on the plane.
function onPlane(camera, at) {
    return { ...at, x: at.x + camera.x, y: at.y + camera.y };
}

// Layers laid at rects of the plane, `[{ rect, clip, spread, ... }]`, as they are laid on the screen `camera` shows:
// each rect less the camera's top left, and `input`, rects from a layer's own top left, as they are.
function laidOn(camera, layers) {
    const moved = (rect) => (rect ? onScreen(camera, rect) : rect);
    return layers.map((layer) => {
        const { rect, clip, spread } = layer;
        return {
            ...layer,
            ...(rect ? { rect: moved(rect) } : {}),
            ...(clip ? { clip: moved(clip) } : {}),
            ...(spread ? { spread: moved(spread) } : {}),
        };
    });
}

export {
    opened,
    isScreen,
    sized,
    panned,
    scrolled,
    reaches,
    meets,
    brought,
    centredOn,
    shownBy,
    onScreen,
    onPlane,
    laidOn,
};
