//
//  ConnectionBroker.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A mod reaches another only through a connection: a lifecycle of its run and the exports the mod picked for an
// interface it names in its [dependencies] opened for that interface, while that mod implements it at a version the
// dependent takes. A mod picked for an interface it depends on itself is none. Exports opened in lifecycle g reach the
// lifecycles stacked at g and above. A connection stands from when both lifecycles are up, the dependent's run
// launching or running and the dependency's running, until either lifecycle ends or another mod is picked for the
// interface. A lifecycle is up from when its page begins it until its page says it ended, or its run has ended.
public final class ConnectionBroker {
    // MARK: - Property
    private let runner: Runner
    // Mod id -> its run whose lifecycles are up, and those lifecycles.
    private var up: [String: (run: Int, lifecycles: Set<Int>)] = [:]
    private var connections: [Connection] = []
    // The connections a dependency's page refused, by interface and ends, never asked again while both are up.
    private var refused: [(interface: String, ends: [Endpoint])] = []
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
        refused.append((connection.interface, [connection.dependent, connection.dependency]))
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
    // A run that ended has no lifecycle up, and a connection to a mod no longer picked for its interface ends.
    func changes() -> [Effect] {
        up = up.filter { id, up in
            runner.run(of: id).map { run in run.number == up.run && run.state != .notRunning } ?? false
        }
        let ended = connections.filter { connection in
            !isUp(connection.dependent)
                || !isUp(connection.dependency)
                || runner.pick(of: connection.interface) != connection.dependency.modId
        }
        connections.removeAll { connection in ended.contains(connection) }
        refused = refused.filter { refusal in
            refusal.ends.allSatisfy(isUp) && runner.pick(of: refusal.interface) == refusal.ends[1].modId
        }
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

    // What the run waits for in a lifecycle the exports it waits for do not reach: `awaits` names the lowest lifecycle
    // that waits for each interface, whose exports are those of the mod picked for it.
    func problems(of run: Run) -> [String] {
        guard let awaits = run.contributions?.awaits else { return [] }

        return awaits.keys.sorted().compactMap { interface in
            guard let pick = runner.pick(of: interface),
                pick != run.modId,
                let opened = runner.run(of: pick)?.contributions?.exportedIn[interface],
                let lifecycle = awaits[interface],
                opened > lifecycle
            else { return nil }
            return "it waits for \(interface) in a lifecycle its exports do not reach: they are opened in one stacked "
                + "above"
        }
    }

    // MARK: - Private
    // The connections the dependent lifecycle has but did not have, now made: one for each interface its mod depends
    // on whose pick implements it at a version the mod takes, runs, and opened its exports at the lifecycle or under.
    private func open(for dependent: Endpoint) -> [Connection] {
        guard let mod = runner.mod(of: dependent.modId),
            let run = runner.run(of: dependent.modId),
            run.state == .launching || run.state == .running
        else { return [] }

        var opened: [Connection] = []
        for (interface, dependency) in mod.manifest.dependencies.sorted(by: { one, other in one.key < other.key }) {
            guard let id = runner.pick(of: interface),
                id != mod.manifest.id,
                let other = runner.mod(of: id),
                dependency.isSatisfied(by: other.manifest.implements[interface]),
                let otherRun = runner.run(of: id),
                otherRun.state == .running,
                let lifecycle = otherRun.contributions?.exportedIn[interface],
                lifecycle <= dependent.lifecycle
            else { continue }

            let exports = Endpoint(modId: id, run: otherRun.number, lifecycle: lifecycle)
            let standing = connections.contains { connection in
                connection.interface == interface && connection.dependent == dependent && connection.dependency == exports
            }
            let refusedBefore = refused.contains { refusal in
                refusal.interface == interface && refusal.ends == [dependent, exports]
            }
            guard isUp(exports), !standing, !refusedBefore else { continue }

            lastId += 1
            let connection = Connection(
                id: lastId,
                interface: interface,
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
        guard let up = up[endpoint.modId] else { return false }

        return up.run == endpoint.run && up.lifecycles.contains(endpoint.lifecycle)
    }
}
