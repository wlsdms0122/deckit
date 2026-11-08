// MARK: - Property
// How long what a mod's code does as its run ends may take before the run ends anyway: the end of each of its
// lifecycles.
const END_LIMIT_MS = 5000;
// How long a run's code may take to start once it launched, before it fails to launch, timed out.
const LAUNCH_LIMIT_MS = 20000;

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { END_LIMIT_MS, LAUNCH_LIMIT_MS };
