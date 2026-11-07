//
//  ConnectionBroker.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A mod reaches another only through a connection, by a name its job reaches by: a lifecycle of its run and the exports
// another mod opened for that name. By a mod id in its `reaches`, the exports that mod opened for those that reach it by
// id. By an interface in its `uses`, the exports the interface's owner opened for it, while the owner provides the major
// it uses; a mod that owns an interface it uses reaches no one by it. Exports opened in lifecycle g reach the lifecycles
// stacked at g and above. A connection stands from when both lifecycles are up, the client's run launching or running
// and the service's running, until either lifecycle ends or the interface has another owner. A lifecycle is up from
// when its page begins it until its page says it ended, or its run has ended. A lifecycle that reaches a mod that does
// not run waits for it, and deck tells so once.
public final class ConnectionBroker {
    // MARK: - Property
    private let runner: Runner
    private let owners: OwnerTable
    // Mod id -> its run whose lifecycles are up, and those lifecycles.
    private var up: [String: (run: Int, lifecycles: Set<Int>)] = [:]
    private var connections: [Connection] = []
    // The connections a service's page refused, by name and ends, never asked again while both are up.
    private var refused: [(name: String, ends: [Endpoint])] = []
    // The lifecycles told they wait for a mod that does not run, by name, while they still wait.
    private var waiting: [(name: String, client: Endpoint, service: String)] = []
    private var lastId = 0

    // MARK: - Initializer
    init(runner: Runner, owners: OwnerTable) {
        self.runner = runner
        self.owners = owners
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

    // The service's page refused the connection: it stays down while both its ends are up.
    public func refuse(_ id: Int) {
        guard let connection = connections.first(where: { connection in connection.id == id }) else { return }
        connections.removeAll { other in other.id == id }
        refused.append((connection.name, [connection.client, connection.service]))
    }

    // The other end of the connection, for a message from the `number`th run of `id` on it.
    public func route(from id: String, run number: Int, connection: Int) throws(ConnectionError) -> Endpoint {
        guard let connection = connections.first(where: { other in other.id == connection }) else { throw .ended }
        if connection.client.modId == id && connection.client.run == number {
            return connection.service
        }
        if connection.service.modId == id && connection.service.run == number {
            return connection.client
        }
        throw .notAnEnd(mod: id)
    }

    // The connections that ended since, then those that stand since and were not answered to a beginning lifecycle,
    // then the lifecycles that began to wait for a mod that does not run. A run that ended has no lifecycle up, and a
    // connection to an interface's owner ends as it has another.
    func changes() -> [Effect] {
        up = up.filter { id, up in
            runner.run(of: id).map { run in run.number == up.run && run.state != .notRunning } ?? false
        }
        let ended = connections.filter { connection in
            !isUp(connection.client)
                || !isUp(connection.service)
                || provider(of: connection.name, for: connection.client.modId) != connection.service.modId
        }
        connections.removeAll { connection in ended.contains(connection) }
        refused = refused.filter { refusal in
            refusal.ends.allSatisfy(isUp)
                && provider(of: refusal.name, for: refusal.ends[0].modId) == refusal.ends[1].modId
        }
        var effects = ended.map(Effect.disconnect)
        var waits: [(name: String, client: Endpoint, service: String)] = []
        for (id, up) in up.sorted(by: { one, other in one.key < other.key }) {
            for lifecycle in up.lifecycles.sorted() {
                let client = Endpoint(modId: id, run: up.run, lifecycle: lifecycle)
                guard isUp(client) else { continue }
                effects += open(for: client).map(Effect.connect)
                waits += self.waits(of: client)
            }
        }
        let told = waiting
        waiting = waits
        effects += waits.filter { wait in
            !told.contains { other in
                other.name == wait.name && other.client == wait.client && other.service == wait.service
            }
        }
        .map { wait in Effect.wait(name: wait.name, client: wait.client, service: wait.service) }

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
    // but for the mod itself. Nil for a name its job does not reach by.
    func provider(of name: String, for id: String) -> String? {
        guard let job = runner.job(of: id) else { return nil }
        if job.reaches.contains(name) {
            return name
        }
        guard job.uses[name] != nil, let owner = owners.owner(of: name), owner != id else { return nil }

        return owner
    }

    // MARK: - Private
    // The connections the client lifecycle has but did not have, now made: one for each name its job reaches by
    // whose mod takes it, runs, and opened its exports for the name at the lifecycle or under.
    private func open(for client: Endpoint) -> [Connection] {
        guard let job = runner.job(of: client.modId),
            let run = runner.run(of: client.modId),
            run.state == .launching || run.state == .running
        else { return [] }

        var opened: [Connection] = []
        for name in names(of: job) {
            guard let id = provider(of: name, for: job.modId),
                let other = runner.job(of: id),
                takes(other, by: name, for: job),
                let otherRun = runner.run(of: id),
                otherRun.state == .running,
                let lifecycle = otherRun.contributions?.exportedIn[name],
                lifecycle <= client.lifecycle
            else { continue }

            let exports = Endpoint(modId: id, run: otherRun.number, lifecycle: lifecycle)
            let standing = connections.contains { connection in
                connection.name == name
                    && connection.client == client
                    && connection.service == exports
            }
            let refusedBefore = refused.contains { refusal in
                refusal.name == name && refusal.ends == [client, exports]
            }
            guard isUp(exports), !standing, !refusedBefore else { continue }

            lastId += 1
            let connection = Connection(
                id: lastId,
                name: name,
                client: client,
                service: exports,
                credential: Credential(modId: job.modId, permissions: job.permissions)
            )
            connections.append(connection)
            opened.append(connection)
        }

        return opened
    }

    // The names the client lifecycle reaches by whose mod does not launch or run, each with that mod's id.
    private func waits(of client: Endpoint) -> [(name: String, client: Endpoint, service: String)] {
        guard let job = runner.job(of: client.modId) else { return [] }

        return names(of: job).compactMap { name in
            guard let id = provider(of: name, for: job.modId) else { return nil }
            let state = runner.run(of: id)?.state
            guard state != .launching && state != .running else { return nil }
            return (name, client, id)
        }
    }

    // Whether `client` takes `provider` by `name`: any mod it reaches by id, an owner that provides the major it
    // uses.
    private func takes(_ provider: Job, by name: String, for client: Job) -> Bool {
        guard let major = client.uses[name] else { return true }

        return provider.provides[name]?.contains(major) ?? false
    }

    private func names(of job: Job) -> [String] {
        (job.reaches + job.uses.keys).sorted()
    }

    private func isUp(_ endpoint: Endpoint) -> Bool {
        guard let up = up[endpoint.modId] else { return false }

        return up.run == endpoint.run && up.lifecycles.contains(endpoint.lifecycle)
    }
}
