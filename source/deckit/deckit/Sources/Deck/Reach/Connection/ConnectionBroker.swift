//
//  ConnectionBroker.swift
//  Deck
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// A principal reaches another only through a connection, by a name its job reaches by: a lifecycle of its run and the
// exports another principal opened for that name. By a principal its `reaches` holds, as the lifecycle asks for it and
// until it releases it, the exports that principal opened for those that reach it by id; a principal reaches no one by
// its own id. By an interface in its `uses`, from as the lifecycle begins, the exports the interface's owner opened for
// it, while the owner provides the major it uses; a principal that owns an interface it uses reaches no one by it.
// Exports opened in lifecycle g reach the lifecycles stacked at g and above. A connection stands from when both
// lifecycles are up, the client's run launching or running and the service's running, until either lifecycle ends, the
// client releases the id or the interface has another owner. A lifecycle is up from when its page begins it until its
// page says it ended, or its run has ended. A lifecycle that reaches a principal with no run, or whose run has ended,
// waits for it, and deck tells so once; one that reaches a principal that runs with no exports for the name that reach the lifecycle is
// refused and told once.
public final class ConnectionBroker {
    // MARK: - Property
    private let runner: Runner
    private let owners: OwnerTable
    // Principal -> its run whose lifecycles are up, and those lifecycles.
    private var up: [String: (run: Int, lifecycles: Set<Int>)] = [:]
    // Lifecycle -> the principals it asked to reach and has not released, while it is up.
    private var asked: [Endpoint: Set<String>] = [:]
    private var connections: [Connection] = []
    // The connections a service's page refused, by name and ends, never asked again while both are up and the client
    // still reaches by the name: a client that releases an id and asks for it again is asked for anew.
    private var refused: [(name: String, ends: [Endpoint])] = []
    // The lifecycles told they wait for a principal that does not run, by name, while they still wait.
    private var waiting: [(name: String, client: Endpoint, service: String)] = []
    // The lifecycles told a principal that runs has no exports for them, by name, while it still has none.
    private var unexported: [(name: String, client: Endpoint, service: String)] = []
    private var lastId = 0

    // MARK: - Initializer
    init(runner: Runner, owners: OwnerTable) {
        self.runner = runner
        self.owners = owners
    }

    // MARK: - Public
    // The `lifecycle`th lifecycle of the run begins: answers the connections it has from now on.
    public func begin(principal id: String, run number: Int, lifecycle: Int) throws(ConnectionError) -> [Connection] {
        guard let run = runner.run(of: id), run.number == number, run.state == .launching || run.state == .running
        else { throw .notRunning(id) }

        let lifecycles = up[id].flatMap { up in up.run == number ? up.lifecycles : nil } ?? []
        up[id] = (number, lifecycles.union([lifecycle]))

        return open(for: Endpoint(principal: id, run: number, lifecycle: lifecycle))
    }

    // The `lifecycle`th lifecycle of the run has ended.
    func end(principal id: String, run number: Int, lifecycle: Int) {
        guard let up = up[id], up.run == number else { return }
        self.up[id] = (number, up.lifecycles.subtracting([lifecycle]))
        asked[Endpoint(principal: id, run: number, lifecycle: lifecycle)] = nil
    }

    // The client lifecycle, up, asks to reach `id` by its id, until it releases it or ends.
    func reach(_ id: String, from client: Endpoint) throws(ConnectionError) {
        guard let run = runner.run(of: client.principal),
            run.number == client.run,
            run.state == .launching || run.state == .running
        else { throw .notRunning(client.principal) }
        guard isUp(client) else { throw .notUp(client) }
        guard let job = runner.job(of: client.principal), mayReach(id, for: job) else {
            throw .outOfReach(principal: id, client: client.principal)
        }

        asked[client, default: []].insert(id)
    }

    // The client lifecycle lets `id` go: its connection by the id ends.
    func release(_ id: String, from client: Endpoint) {
        asked[client]?.remove(id)
    }

    // The service's page refused the connection: it stays down while both its ends are up and its client reaches by
    // its name.
    public func refuse(_ id: Int) {
        guard let connection = connections.first(where: { connection in connection.id == id }) else { return }
        connections.removeAll { other in other.id == id }
        refused.append((connection.name, [connection.client, connection.service]))
    }

    // The other end of the connection, for a message from the `number`th run of `id` on it.
    public func route(from id: String, run number: Int, connection: Int) throws(ConnectionError) -> Endpoint {
        guard let connection = connections.first(where: { other in other.id == connection }) else { throw .ended }
        if connection.client.principal == id && connection.client.run == number {
            return connection.service
        }
        if connection.service.principal == id && connection.service.run == number {
            return connection.client
        }
        throw .notAnEnd(principal: id)
    }

    // The connections that ended since, then those that stand since and were not answered to a beginning lifecycle,
    // then the lifecycles that began to wait for a principal that does not run, then those refused since by one that
    // runs with no exports for them. A run that ended has no lifecycle up, a connection by an id ends as its client
    // releases it, and one to an interface's owner as it has another.
    func changes() -> [Effect] {
        up = up.filter { id, up in
            runner.run(of: id).map { run in run.number == up.run && run.state != .notRunning } ?? false
        }
        asked = asked.filter { client, _ in isUp(client) }
        let ended = connections.filter { connection in
            !isUp(connection.client)
                || !isUp(connection.service)
                || !names(of: connection.client).contains(connection.name)
                || provider(of: connection.name, for: connection.client.principal) != connection.service.principal
        }
        connections.removeAll { connection in ended.contains(connection) }
        refused = refused.filter { refusal in
            refusal.ends.allSatisfy(isUp)
                && names(of: refusal.ends[0]).contains(refusal.name)
                && provider(of: refusal.name, for: refusal.ends[0].principal) == refusal.ends[1].principal
        }
        var effects = ended.map(Effect.disconnect)
        var waits: [(name: String, client: Endpoint, service: String)] = []
        var unexported: [(name: String, client: Endpoint, service: String)] = []
        for (id, up) in up.sorted(by: { one, other in one.key < other.key }) {
            for lifecycle in up.lifecycles.sorted() {
                let client = Endpoint(principal: id, run: up.run, lifecycle: lifecycle)
                guard isUp(client) else { continue }
                effects += open(for: client).map(Effect.connect)
                waits += self.waits(of: client)
                unexported += refusals(of: client)
            }
        }
        let waited = waiting
        waiting = waits
        effects += waits.filter { wait in !Self.told(wait, in: waited) }
            .map { wait in Effect.wait(name: wait.name, client: wait.client, service: wait.service) }
        let toldUnexported = self.unexported
        self.unexported = unexported
        effects += unexported.filter { refusal in !Self.told(refusal, in: toldUnexported) }
            .map { refusal in
                Effect.refuse(
                    name: refusal.name,
                    client: refusal.client,
                    refusal: .notExported(name: refusal.name, principal: refusal.service)
                )
            }

        return effects
    }

    // What the run waits for in a lifecycle the exports it waits for do not reach: `awaits` names the lowest lifecycle
    // that waits for each name, whose exports are those of the principal it reaches by it.
    func problems(of run: Run) -> [String] {
        guard let awaits = run.contributions?.awaits else { return [] }

        return awaits.keys.sorted().compactMap { name in
            guard let id = provider(of: name, for: run.principal),
                let opened = runner.run(of: id)?.contributions?.exportedIn[name],
                let lifecycle = awaits[name],
                opened > lifecycle
            else { return nil }
            return "it waits for \(name) in a lifecycle its exports do not reach: they are opened in one stacked above"
        }
    }

    // The principal `id` reaches by `name`, or nil: the owner of an interface it uses, the principal an id it may reach
    // names, but for the principal itself. Nil for a name its job does not reach by.
    func provider(of name: String, for id: String) -> String? {
        guard let job = runner.job(of: id) else { return nil }
        guard job.uses[name] == nil else {
            return owners.owner(of: name).flatMap { owner in owner == id ? nil : owner }
        }

        return mayReach(name, for: job) ? name : nil
    }

    // MARK: - Private
    // The connections the client lifecycle has but did not have, now made: one for each name it reaches by whose
    // principal takes it, runs, and opened its exports for the name at the lifecycle or under.
    private func open(for client: Endpoint) -> [Connection] {
        guard let job = runner.job(of: client.principal),
            let run = runner.run(of: client.principal),
            run.state == .launching || run.state == .running
        else { return [] }

        var opened: [Connection] = []
        for name in names(of: client) {
            guard let id = provider(of: name, for: job.principal),
                let other = runner.job(of: id),
                takes(other, by: name, for: job),
                let otherRun = runner.run(of: id),
                otherRun.state == .running,
                let lifecycle = otherRun.contributions?.exportedIn[name],
                lifecycle <= client.lifecycle
            else { continue }

            let exports = Endpoint(principal: id, run: otherRun.number, lifecycle: lifecycle)
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
                credential: Credential(principal: job.principal, permissions: job.permissions)
            )
            connections.append(connection)
            opened.append(connection)
        }

        return opened
    }

    // The names the client lifecycle reaches by whose principal has no run or one that has ended, each with that
    // principal: one that terminates is waited for once its run has ended, when it can launch again.
    private func waits(of client: Endpoint) -> [(name: String, client: Endpoint, service: String)] {
        names(of: client).compactMap { name in
            guard let id = provider(of: name, for: client.principal) else { return nil }
            let state = runner.run(of: id)?.state ?? .notRunning
            guard state == .notRunning else { return nil }
            return (name, client, id)
        }
    }

    // The names the client lifecycle reaches by whose principal it takes runs and has no exports for the name that
    // reach the lifecycle, each with that principal.
    private func refusals(of client: Endpoint) -> [(name: String, client: Endpoint, service: String)] {
        guard let job = runner.job(of: client.principal) else { return [] }

        return names(of: client).compactMap { name in
            guard let id = provider(of: name, for: client.principal),
                let other = runner.job(of: id),
                takes(other, by: name, for: job),
                let run = runner.run(of: id),
                run.state == .running,
                !(run.contributions?.exportedIn[name].map { lifecycle in lifecycle <= client.lifecycle } ?? false)
            else { return nil }
            return (name, client, id)
        }
    }

    // Whether `one` is among those told before.
    private static func told(
        _ one: (name: String, client: Endpoint, service: String),
        in told: [(name: String, client: Endpoint, service: String)]
    ) -> Bool {
        told.contains { other in other.name == one.name && other.client == one.client && other.service == one.service }
    }

    // Whether `client` takes `provider` by `name`: any principal it reaches by id, an owner that provides the major it
    // uses.
    private func takes(_ provider: Job, by name: String, for client: Job) -> Bool {
        guard let major = client.uses[name] else { return true }

        return provider.provides[name]?.contains(major) ?? false
    }

    private func mayReach(_ id: String, for job: Job) -> Bool {
        job.reaches.contains(id) && id != job.principal
    }

    // The ids the client lifecycle asked to reach, and the interfaces its job uses.
    private func names(of client: Endpoint) -> [String] {
        guard let job = runner.job(of: client.principal) else { return [] }

        return asked[client, default: []].union(job.uses.keys).sorted()
    }

    private func isUp(_ endpoint: Endpoint) -> Bool {
        guard let up = up[endpoint.principal] else { return false }

        return up.run == endpoint.run && up.lifecycles.contains(endpoint.lifecycle)
    }
}
