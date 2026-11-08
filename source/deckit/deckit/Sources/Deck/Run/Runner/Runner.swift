//
//  Runner.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Each principal runs its job in a sandbox of its own, one run at a time. Which jobs load or unload, and when, is the
// caller's. The driver says what happened to a run, and is answered what to do, in order: the runner never waits on it,
// and what comes of an effect comes back as what happened next.
final class Runner {
    // MARK: - Property
    // In the order they opened.
    private var sandboxes: [Sandbox] = []
    // Principal -> the number of its latest run, counted from 1.
    private var runNumbers: [String: Int] = [:]
    private var effects: [Effect] = []

    // MARK: - Initializer
    init() {}

    // MARK: - Public
    // The jobs that have a sandbox, in the order they opened.
    func jobs() -> [Job] {
        sandboxes.map(\.job)
    }

    // The job a sandbox runs, while it has one.
    func job(of id: String) -> Job? {
        sandbox(of: id)?.job
    }

    // The principal's latest run.
    func run(of id: String) -> Run? {
        sandbox(of: id)?.run
    }

    // Each job launches, in the order given, its page loaded anew. One whose principal's run has not ended is left as
    // it is. One of another revision than its principal's sandbox launches in a new sandbox.
    func load(_ jobs: [Job]) throws -> [Effect] {
        try decide {
            for job in jobs {
                let sandbox = sandbox(of: job.principal)
                guard (sandbox?.state ?? .notRunning) == .notRunning else { continue }

                let run = nextRun(of: job.principal)
                if let sandbox, sandbox.job.revision == job.revision {
                    sandbox.run = run
                    launch(sandbox)
                } else {
                    if let sandbox {
                        close(sandbox)
                    }
                    open(job, run: run)
                }
            }
        }
    }

    // Each principal named whose run has not ended terminates, and the sandbox of one whose run has ended closes.
    func unload(_ ids: [String]) throws -> [Effect] {
        try decide {
            for sandbox in sandboxes where ids.contains(sandbox.job.principal) {
                if sandbox.state == .notRunning {
                    close(sandbox)
                } else {
                    try terminate(sandbox)
                }
            }
        }
    }

    // It started, with what it contributes.
    func started(_ id: String, run number: Int, contributions: Contribution) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didLaunch(contributions) }
        }
    }

    // What it contributes now, while it runs.
    func joined(_ id: String, run number: Int, contributions: Contribution) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .running else { return }
            var run = sandbox.run
            run.join(contributions)
            sandbox.run = run
            effects.append(.keep(run))
        }
    }

    func report(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number) else { return }
            var run = sandbox.run
            guard run.record(problem) else { return }
            sandbox.run = run
            effects.append(.keep(run))
        }
    }

    // It did not start, and why: its sandbox ends at once.
    func notStarted(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .launching else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didFailToLaunch(problem) }
            effects.append(.kill(principal: id))
        }
    }

    func crashed(_ id: String, run number: Int, problem: String) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state != .notRunning else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.crash(problem) }
        }
    }

    // Its page ended it, its time ran out or its page is gone.
    func stopped(_ id: String, run number: Int) throws -> [Effect] {
        try decide {
            guard let sandbox = sandbox(of: id, run: number), sandbox.state == .terminating else { return }
            try move(sandbox) { run throws(LifecycleError) in try run.didTerminate() }
        }
    }

    // MARK: - Private
    // What one fact comes to. A terminating run's end is asked once.
    private func decide(_ fact: () throws -> Void) throws -> [Effect] {
        effects = []
        try fact()
        for sandbox in sandboxes where sandbox.state == .terminating && !sandbox.stopAsked {
            sandbox.stopAsked = true
            effects.append(.stop(principal: sandbox.job.principal, number: sandbox.run.number))
        }

        return effects
    }

    private func open(_ job: Job, run: Run) {
        let sandbox = Sandbox(job: job, run: run)
        sandboxes.append(sandbox)
        effects.append(.open(job))
        launch(sandbox)
    }

    private func close(_ sandbox: Sandbox) {
        sandboxes.removeAll { other in other === sandbox }
        effects.append(.close(principal: sandbox.job.principal))
    }

    private func launch(_ sandbox: Sandbox) {
        sandbox.stopAsked = false
        effects.append(.tell(.willLaunch, sandbox.run))
        effects.append(.loadPage(principal: sandbox.job.principal))
    }

    private func terminate(_ sandbox: Sandbox) throws {
        try move(sandbox) { run throws(LifecycleError) in try run.terminate() }
    }

    private func move(
        _ sandbox: Sandbox,
        _ step: (inout Run) throws(LifecycleError) -> LifecycleNotification?
    ) throws {
        var run = sandbox.run
        let notification = try step(&run)
        sandbox.run = run
        guard let notification else { return }
        effects.append(.tell(notification, run))
    }

    private func nextRun(of id: String) -> Run {
        let number = runNumbers[id, default: 0] + 1
        runNumbers[id] = number

        return Run(principal: id, number: number)
    }

    private func sandbox(of id: String) -> Sandbox? {
        sandboxes.first { sandbox in sandbox.job.principal == id }
    }

    // The principal's sandbox, while its latest run is the `number`th: what an older run said, still on its way, is not
    // the newer one's.
    private func sandbox(of id: String, run number: Int) -> Sandbox? {
        guard let sandbox = sandbox(of: id), sandbox.run.number == number else { return nil }
        return sandbox
    }
}
