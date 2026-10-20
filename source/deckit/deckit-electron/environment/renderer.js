// What Electron gives deck on a page's side (deckit-shell/environment: PAGE): its IPC carries the messages.
import { messages } from '../messages/renderer.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
const environment = Object.freeze({ messages });

// MARK: - Private

export { environment };
