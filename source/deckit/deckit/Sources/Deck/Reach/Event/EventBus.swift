//
//  EventBus.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Mods say what happened to them through deck, never to each other: an event is named after the mod that sent it, so
// none speaks for another, and deck's own after the interface it tells of. The owner of an interface sends its signals,
// `<interface>:<name>`, named after the interface, and none of the names deck tells of the interface with. It goes to
// the runs that listen to it, and only from a run that is running. A run hears only what its job names: the events of
// its own mod and of the mods it may reach by id, and those named after the interfaces it uses or provides; listening
// to another name is ignored. A run that has ended hears nothing.
public final class EventBus {
    // MARK: - Property
    private let runner: Runner
    private let owners: OwnerTable
    // Mod id -> its run that listens, and every scoped event name it listens to.
    private var listening: [String: (run: Int, names: Set<String>)] = [:]

    // MARK: - Initializer
    init(runner: Runner, owners: OwnerTable) {
        self.runner = runner
        self.owners = owners
    }

    // MARK: - Public
    public func listen(mod id: String, run number: Int, names: [String]) {
        guard isLive(id, run: number) else { return }
        listening[id] = (number, Set(names.filter { name in ScopedName(name) != nil }))
    }

    // The event `name` of the `number`th run of `id`, and the mods to tell it, none while that run is not running.
    // Refused for a signal of an interface `id` owns named as deck tells of the interface.
    public func emit(mod id: String, run number: Int, name: String) throws -> EventDelivery {
        let signal = ScopedName(name).flatMap { signal in owners.owner(of: signal.modId) == id ? signal : nil }
        if let signal, InterfaceChange(rawValue: signal.name) != nil {
            throw EventError.reserved(name)
        }
        let scoped = signal ?? ScopedName(modId: id, name: name)
        guard let run = runner.run(of: id), run.number == number, run.state == .running else {
            return EventDelivery(name: scoped.description, listeners: [])
        }
        let hearing = signal == nil ? hearsMod : hearsInterface

        return EventDelivery(name: scoped.description, listeners: listeners(of: scoped, hearing: hearing))
    }

    // Deck's own event, `change` of `interface`, of no run, and the mods to tell it.
    func announce(_ change: InterfaceChange, of interface: String) -> EventDelivery {
        let name = ScopedName(modId: interface, name: change.rawValue)
        return EventDelivery(name: name.description, listeners: listeners(of: name, hearing: hearsInterface))
    }

    // The runs that ended listen no more.
    func dropEnded() {
        listening = listening.filter { id, listens in isLive(id, run: listens.run) }
    }

    // MARK: - Private
    // The mods whose runs listen to `name` and whose jobs hear the mod or the interface it is named after.
    private func listeners(of name: ScopedName, hearing: (Job, String) -> Bool) -> [String] {
        listening
            .filter { id, listens in
                guard listens.names.contains(name.description), let job = runner.job(of: id) else { return false }
                return hearing(job, name.modId)
            }
            .keys
            .sorted()
    }

    private func hearsMod(_ job: Job, _ id: String) -> Bool {
        id == job.modId || job.reaches.contains(id)
    }

    private func hearsInterface(_ job: Job, _ interface: String) -> Bool {
        job.uses[interface] != nil || job.provides[interface] != nil
    }

    // While the mod's latest run is the `number`th and has not ended.
    private func isLive(_ id: String, run number: Int) -> Bool {
        guard let run = runner.run(of: id) else { return false }
        return run.number == number && run.state != .notRunning
    }
}
