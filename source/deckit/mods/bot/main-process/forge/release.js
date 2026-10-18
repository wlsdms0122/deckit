module.exports = ({ forge, send }) => {
    const { look } = require('./workflow.js')(forge);

    const LOOK_LIMIT = 10 * 60 * 1000;

    let revision = 0;
    const status = look('release-status', LOOK_LIMIT, () => {
        revision += 1;
        send(snapshot());
    });
    const snapshot = () => ({ ...status.state, revision });

    return {
        state: snapshot,
        check: () => {
            status.look();
            return snapshot();
        },
    };
};
