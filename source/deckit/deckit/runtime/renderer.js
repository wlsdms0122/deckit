export function createRuntime({ PROTOCOL }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    function about() {
        return PROTOCOL.about.invoke();
    }

    function restart() {
        return PROTOCOL.restart.invoke();
    }

    // MARK: - Private

    return { about, restart };
}
