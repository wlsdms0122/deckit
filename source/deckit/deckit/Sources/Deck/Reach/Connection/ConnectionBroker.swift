//
//  ConnectionBroker.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A mod reaches another only through a connection, by a name its manifest gives: a lifecycle of its run and the exports
// another mod opened for that name. By a mod id it names in its [dependencies], the exports that mod opened for its
// dependents, while it is at a version the dependent takes. By an interface it names in its `uses`, the exports the
// interface's owner opened for it, while the owner provides the major the dependent uses; a mod that owns an interface
// it uses reaches no one by it. Exports opened in lifecycle g reach the lifecycles stacked at g and above. A connection
// stands from when both lifecycles are up, the dependent's run launching or running and the dependency's running, until
// either lifecycle ends or the interface has another owner. A lifecycle is up from when its page begins it until its
// page says it ended, or its run has ended.
public final class ConnectionBroker {
    // MARK: - Property
    private let runner: Runner
    // Mod id -> its run whose lifecycles are up, and those lifecycles.
    private var up: [String: (run: Int, lifecycles: Set<Int>)] = [:]
    private var connections: [Connection] = []
    // The connections a dependency's page refused, by name and ends, never asked again while both are up.
    private var refused: [(name: String, ends: [Endpoint])] = []
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
        refused.append((connection.name, [connection.dependent, connection.dependency]))
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
    // A run that ended has no lifecycle up, and a connection to an interface's owner ends as it has another.
    func changes() -> [Effect] {
        up = up.filter { id, up in
            runner.run(of: id).map { run in run.number == up.run && run.state != .notRunning } ?? false
        }
        let ended = connections.filter { connection in
            !isUp(connection.dependent)
                || !isUp(connection.dependency)
                || provider(of: connection.name, for: connection.dependent.modId) != connection.dependency.modId
        }
        connections.removeAll { connection in ended.contains(connection) }
        refused = refused.filter { refusal in
            refusal.ends.allSatisfy(isUp)
                && provider(of: refusal.name, for: refusal.ends[0].modId) == refusal.ends[1].modId
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
    // that waits for each name, whose exports are those of the mod it reaches by it.
    func problems(of run: Run) -> [String] {
        guard let awaits = run.contributions?.awaits else { return [] }

        return awaits.keys.sorted().compactMap { name in
            guard let id = provider(of: name, for: run.modId),
                let opened = runner.run(of: id)?.contributions?.exportedIn[name],
                let lifecycle = awaits[name],
                opened > lifecycle
            else { return nil }
            return "it waits for \(name) in a lifecycle its exports do not reach: they are opened in one stacked above"
        }
    }

    // The id of the mod the mod of `id` reaches by `name`, or nil: the mod a mod id names, the owner of an interface
    // but for the mod itself, as the catalog was last read. Nil for a name its manifest does not give.
    func provider(of name: String, for id: String) -> String? {
        guard let manifest = runner.mod(of: id)?.manifest else { return nil }
        if manifest.dependencies[name] != nil {
            return name
        }
        guard manifest.uses[name] != nil, let owner = runner.owner(of: name), owner != id else { return nil }

        return owner
    }

    // MARK: - Private
    // The connections the dependent lifecycle has but did not have, now made: one for each name its mod gives whose
    // mod takes it, runs, and opened its exports for the name at the lifecycle or under.
    private func open(for dependent: Endpoint) -> [Connection] {
        guard let mod = runner.mod(of: dependent.modId),
            let run = runner.run(of: dependent.modId),
            run.state == .launching || run.state == .running
        else { return [] }

        var opened: [Connection] = []
        let names = (Array(mod.manifest.dependencies.keys) + Array(mod.manifest.uses.keys)).sorted()
        for name in names {
            guard let id = provider(of: name, for: mod.manifest.id),
                let other = runner.mod(of: id),
                takes(other.manifest, by: name, for: mod.manifest),
                let otherRun = runner.run(of: id),
                otherRun.state == .running,
                let lifecycle = otherRun.contributions?.exportedIn[name],
                lifecycle <= dependent.lifecycle
            else { continue }

            let exports = Endpoint(modId: id, run: otherRun.number, lifecycle: lifecycle)
            let standing = connections.contains { connection in
                connection.name == name
                    && connection.dependent == dependent
                    && connection.dependency == exports
            }
            let refusedBefore = refused.contains { refusal in
                refusal.name == name && refusal.ends == [dependent, exports]
            }
            guard isUp(exports), !standing, !refusedBefore else { continue }

            lastId += 1
            let connection = Connection(
                id: lastId,
                name: name,
                dependent: dependent,
                dependency: exports,
                required: !(mod.manifest.dependencies[name]?.optional ?? true)
            )
            connections.append(connection)
            opened.append(connection)
        }

        return opened
    }

    // Whether `dependent` takes `provider` by `name`: a mod at the version it names for it, an owner that provides the
    // major it uses.
    private func takes(_ provider: Manifest, by name: String, for dependent: Manifest) -> Bool {
        if let major = dependent.uses[name] {
            return provider.provides[name]?.contains(major) ?? false
        }

        return dependent.depends(on: provider)
    }

    private func isUp(_ endpoint: Endpoint) -> Bool {
        guard let up = up[endpoint.modId] else { return false }

        return up.run == endpoint.run && up.lifecycles.contains(endpoint.lifecycle)
    }
}
