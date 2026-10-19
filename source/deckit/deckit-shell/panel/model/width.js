// MARK: - Property
// A generous ceiling: in a window of its own the panel has room, and sidebar lists want width.
const MIN = 240;
const MAX = 720;
// Leaves the mod room to draw beside the sidebar.
const CONTENT_MIN = 360;

// MARK: - Initializer
// MARK: - Public
// The sidebar's width as it is drawn across `room` px: the one asked for, within the one allowed anywhere and
// what leaves the mod room.
function fitted(width, room) {
    const ceiling = Math.max(MIN, Math.min(MAX, room - CONTENT_MIN));
    return Math.min(ceiling, Math.max(MIN, width));
}

// MARK: - Private

export { fitted };
