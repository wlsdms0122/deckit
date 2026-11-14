//
//  EventBus.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Principals say what happened to them through deck, never to each other: an event is named after the principal that
// sent it, so none speaks for another, and one deck or the driver tells after the interface it tells of. The owner of
// an interface sends its signals, `<interface>:<name>`, named after the interface, and none of the names deck or the
// driver tells of the interface with. It goes to the runs that listen to it, and only from a run that is launching or
// running, whose code runs. A run hears only what its job names: the events of its own principal and of the principals
// it may reach by id, and those named after the interfaces it uses or provides; listening to another name is ignored.
// A run that has ended hears nothing.
public final class EventBus {
    // MARK: - Property
    private let runner: Runner
    private let owners: OwnerTable
    // The signals deck and the driver tell of an interface, which its owner does not send.
    private let reserved: Set<String>
    // Principal -> its run that listens, and every scoped event name it listens to.
    private var listening: [String: (run: Int, names: Set<String>)] = [:]

    // MARK: - Initializer
    // `signals` are those the driver tells of an interface.
    init(runner: Runner, owners: OwnerTable, signals: Set<String>) {
        self.runner = runner
        self.owners = owners
        self.reserved = signals.union(InterfaceChange.allCases.map(\.rawValue))
    }

    // MARK: - Public
    public func listen(principal id: String, run number: Int, names: [String]) {
        guard isLive(id, run: number) else { return }
        listening[id] = (number, Set(names.filter { name in ScopedName(name) != nil }))
    }

    // The event `name` of the `number`th run of `id`, and the principals to tell it, none while that run is neither
    // launching nor running. Refused for a signal of an interface `id` owns named as deck or the driver tells of it.
    public func emit(principal id: String, run number: Int, name: String) throws -> EventDelivery {
        let signal = ScopedName(name).flatMap { signal in owners.owner(of: signal.principal) == id ? signal : nil }
        if let signal, reserved.contains(signal.name) {
            throw EventError.reserved(name)
        }
        let scoped = signal ?? ScopedName(principal: id, name: name)
        guard let run = runner.run(of: id), run.number == number, [.launching, .running].contains(run.state) else {
            return EventDelivery(name: scoped.description, listeners: [])
        }
        let hearing = signal == nil ? hearsPrincipal : hearsInterface

        return EventDelivery(name: scoped.description, listeners: listeners(of: scoped, hearing: hearing))
    }

    // The `signal` deck or the driver tells of `interface`, of no run, and the principals to tell it.
    func announce(_ signal: String, of interface: String) -> EventDelivery {
        let name = ScopedName(principal: interface, name: signal)
        return EventDelivery(name: name.description, listeners: listeners(of: name, hearing: hearsInterface))
    }

    // The runs that ended listen no more.
    func dropEnded() {
        listening = listening.filter { id, listens in isLive(id, run: listens.run) }
    }

    // MARK: - Private
    // The principals whose runs listen to `name` and whose jobs hear the principal or the interface it is named after.
    private func listeners(of name: ScopedName, hearing: (Job, String) -> Bool) -> [String] {
        listening
            .filter { id, listens in
                guard listens.names.contains(name.description), let job = runner.job(of: id) else { return false }
                return hearing(job, name.principal)
            }
            .keys
            .sorted()
    }

    private func hearsPrincipal(_ job: Job, _ id: String) -> Bool {
        id == job.principal || job.reaches.contains(id)
    }

    private func hearsInterface(_ job: Job, _ interface: String) -> Bool {
        job.uses[interface] != nil || job.provides[interface] != nil
    }

    // While the principal's latest run is the `number`th and has not ended.
    private func isLive(_ id: String, run number: Int) -> Bool {
        guard let run = runner.run(of: id) else { return false }
        return run.number == number && run.state != .notRunning
    }
}
