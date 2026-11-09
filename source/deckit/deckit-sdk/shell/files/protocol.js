// Between main and a mod's page, about the person's files shown to them outside the app.
import * as CHANNEL from '../../deckit/channel/index.js';

// Answers the absolute paths of the folders the person chose, one unless `multiple`, none when they chose none, the
// dialog titled `title` and saying `message`.
export const chooseFolders = CHANNEL.pageToMain(
    'deckit-shell:files-choose-folders',
    { multiple: 'boolean', title: 'string?', message: 'string?' },
    { reply: true }
);
// Answers nothing once `path` is shown where it lies.
export const reveal = CHANNEL.pageToMain('deckit-shell:files-reveal', { path: 'string' }, { reply: true });
