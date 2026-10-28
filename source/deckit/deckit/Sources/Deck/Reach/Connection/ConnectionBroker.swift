//
//  ConnectionBroker.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A mod reaches another only through a connection: a lifecycle of its run and the exports of a mod it names in its
// [dependencies], at the version it names. Exports opened in lifecycle g reach the lifecycles stacked at g and above. A
// connection stands from when both lifecycles are up, the dependent's run launching or running and the dependency's
// running, until either lifecycle ends. A lifecycle is up from when its page begins it until its page says it ended,
// or its run has ended.
public final class ConnectionBroker {
    // MARK: - Property
    private let runner: Runner
    // Mod id -> its run whose lifecycles are up, and those lifecycles.
    private var up: [String: (run: Int, lifecycles: Set<Int>)] = [:]
    private var connections: [Connection] = []
    // The ends of connections a dependency's page refused, never asked again while both are up.
    private var refused: Set<[Endpoint]> = []
    // "<mod id> <run> <dependency id>": a wait already shown on the run's row.
    private var warned: Set<String> = []
    private var lastId = 0

    // MARK: - Initializer
    init(runner: Runner) {
        self.runner = runner
    }

    // MARK: - Public
    // The `lifecycle`th lifecycle of the run begins: answers the connections it has from now on.
    public func begin(mod id: String, run number: Int, lifecycle: Int) throws(ConnectionError) -> [Connection] {
        guard let run = runner.run(of: id), run.number == number, run.state == .launching || run.state == .running
        else { throw .notRunning(id) }

        let lifecycles = up[id].flatMap { up in up.run == number ? up.lifecycles : nil } ?? []
        up[id] = (number, lifecycles.union([lifecycle]))

        return open(for: Endpoint(modId: id, run: number, lifecycle: lifecycle))
    }

    // The `lifecycle`th lifecycle of the run has ended.
    func end(mod id: String, run number: Int, lifecycle: Int) {
        guard let up = up[id], up.run == number else { return }
        self.up[id] = (number, up.lifecycles.subtracting([lifecycle]))
    }

    // The dependency's page refused the connection: it stays down while both its ends are up.
    public func refuse(_ id: Int) {
        guard let connection = connections.first(where: { connection in connection.id == id }) else { return }
        connections.removeAll { other in other.id == id }
        refused.insert([connection.dependent, connection.dependency])
    }

    // The other end of the connection, for a message from the `number`th run of `id` on it.
    public func route(from id: String, run number: Int, connection: Int) throws(ConnectionError) -> Endpoint {
        guard let connection = connections.first(where: { other in other.id == connection }) else { throw .ended }
        if connection.dependent.modId == id && connection.dependent.run == number {
            return connection.dependency
        }
        if connection.dependency.modId == id && connection.dependency.run == number {
            return connection.dependent
        }
        throw .notAnEnd(mod: id)
    }

    // The connections that ended since, then those that stand since and were not answered to a beginning lifecycle.
    func changes() -> [Effect] {
        let ended = connections.filter { connection in !isUp(connection.dependent) || !isUp(connection.dependency) }
        connections.removeAll { connection in ended.contains(connection) }
        refused = refused.filter { ends in ends.allSatisfy(isUp) }
        var effects = ended.map(Effect.disconnect)
        for (id, up) in up.sorted(by: { one, other in one.key < other.key }) {
            for lifecycle in up.lifecycles.sorted() {
                let dependent = Endpoint(modId: id, run: up.run, lifecycle: lifecycle)
                guard isUp(dependent) else { continue }
                effects += open(for: dependent).map(Effect.connect)
            }
        }

        return effects
    }

    // What the run waits for in a lifecycle the exports it waits for do not reach, each once: `awaits` names the
    // lowest lifecycle that waits for each mod.
    func problems(of run: Run) -> [String] {
        guard let awaits = run.contributions?.awaits else { return [] }

        return awaits.keys.sorted().compactMap { id in
            guard let opened = runner.run(of: id)?.contributions?.exports,
                let lifecycle = awaits[id],
                opened > lifecycle,
                warned.insert("\(run.modId) \(run.number) \(id)").inserted
            else { return nil }
            return "it waits for \(id) in a lifecycle \(id)'s exports do not reach: "
                + "\(id) opens them in one stacked above"
        }
    }

    // MARK: - Private
    // The connections the dependent lifecycle has but did not have, now made: one for each of its mod's dependencies
    // whose exports are up, opened at its lifecycle or under.
    private func open(for dependent: Endpoint) -> [Connection] {
        guard let mod = runner.mod(of: dependent.modId),
            let run = runner.run(of: dependent.modId),
            run.state == .launching || run.state == .running
        else { return [] }

        var opened: [Connection] = []
        for (id, dependency) in mod.manifest.dependencies.sorted(by: { one, other in one.key < other.key }) {
            guard let other = runner.mod(of: id),
                mod.manifest.depends(on: other.manifest),
                let otherRun = runner.run(of: id),
                otherRun.state == .running,
                let lifecycle = otherRun.contributions?.exports,
                lifecycle <= dependent.lifecycle
            else { continue }

            let exports = Endpoint(modId: id, run: otherRun.number, lifecycle: lifecycle)
            let standing = connections.contains { connection in
                connection.dependent == dependent && connection.dependency == exports
            }
            guard isUp(exports), !standing, !refused.contains([dependent, exports]) else { continue }

            lastId += 1
            let connection = Connection(
                id: lastId,
                dependent: dependent,
                dependency: exports,
                required: !dependency.optional
            )
            connections.append(connection)
            opened.append(connection)
        }

        return opened
    }

    private func isUp(_ endpoint: Endpoint) -> Bool {
        guard let up = up[endpoint.modId],
            up.run == endpoint.run,
            up.lifecycles.contains(endpoint.lifecycle),
            let run = runner.run(of: endpoint.modId)
        else { return false }

        return run.number == endpoint.run && run.state != .notRunning
    }
}
