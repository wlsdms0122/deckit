//
//  EventBus.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Mods say what happened to them through deck, never to each other: an event is named after the mod that sent it, so
// none speaks for another, and deck's own after the interface it tells of. The owner of an interface sends its
// signals, `<interface>:<name>`, named after the interface. It goes to the runs that listen to it, and
// only from a run that is running. A run hears only the names its manifest names, its own id, the ids in
// [dependencies] and the interfaces it uses or provides, and listening to another name is ignored. A run that has
// ended hears nothing.
public final class EventBus {
    // MARK: - Property
    private let runner: Runner
    // Mod id -> its run that listens, and every scoped event name it listens to.
    private var listening: [String: (run: Int, names: Set<String>)] = [:]

    // MARK: - Initializer
    init(runner: Runner) {
        self.runner = runner
    }

    // MARK: - Public
    public func listen(mod id: String, run number: Int, names: [String]) {
        guard isLive(id, run: number), let manifest = runner.mod(of: id)?.manifest else { return }
        let named = Set([id] + manifest.dependencies.keys + manifest.uses.keys + manifest.provides.keys)
        let heard = names.filter { name in
            guard let scoped = ScopedName(name) else { return false }
            return named.contains(scoped.modId)
        }
        listening[id] = (number, Set(heard))
    }

    // The event `name` of the `number`th run of `id`, and the mods to tell it, none while that run is not running.
    public func emit(mod id: String, run number: Int, name: String) -> EventDelivery {
        let interface = ScopedName(name)?.modId
        let scoped = interface.flatMap(runner.owner(of:)) == id ? name : ScopedName(modId: id, name: name).description
        guard let run = runner.run(of: id), run.number == number, run.state == .running else {
            return EventDelivery(name: scoped, listeners: [])
        }
        let listeners = listening.filter { _, listens in listens.names.contains(scoped) }

        return EventDelivery(name: scoped, listeners: listeners.keys.sorted())
    }

    // Deck's own event `name`, of no run, and the mods to tell it.
    func announce(_ name: String) -> EventDelivery {
        let listeners = listening.filter { _, listens in listens.names.contains(name) }
        return EventDelivery(name: name, listeners: listeners.keys.sorted())
    }

    // The runs that ended listen no more.
    func dropEnded() {
        listening = listening.filter { id, listens in isLive(id, run: listens.run) }
    }

    // MARK: - Private
    // While the mod's latest run is the `number`th and has not ended.
    private func isLive(_ id: String, run number: Int) -> Bool {
        guard let run = runner.run(of: id) else { return false }
        return run.number == number && run.state != .notRunning
    }
}
