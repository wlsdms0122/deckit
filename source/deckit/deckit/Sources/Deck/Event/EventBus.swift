//
//  EventBus.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Mods say what happened to them through deck, never to each other: an event is named after the mod that sent it, so
// none speaks for another. It goes to the runs that listen to it, and only from a run that is running. A run that has
// ended hears nothing.
final class EventBus {
    // MARK: - Property
    private let runner: Runner
    // Mod id -> its run that listens, and every scoped event name it listens to.
    private var listening: [String: (run: Int, names: Set<String>)] = [:]

    // MARK: - Initializer
    init(runner: Runner) {
        self.runner = runner
    }

    // MARK: - Public
    func listen(mod id: String, run number: Int, names: [String]) {
        guard isLive(id, run: number) else { return }
        listening[id] = (number, Set(names))
    }

    // The event `name` of the `number`th run of `id`, and the mods to tell it, none while that run is not running.
    func emit(mod id: String, run number: Int, name: String) -> EventDelivery {
        let scoped = ScopedName(modId: id, name: name).description
        guard let run = runner.run(of: id), run.number == number, run.state == .running else {
            return EventDelivery(name: scoped, listeners: [])
        }
        let listeners = listening.filter { listener, listens in
            listens.names.contains(scoped) && isLive(listener, run: listens.run)
        }

        return EventDelivery(name: scoped, listeners: listeners.keys.sorted())
    }

    // MARK: - Private
    // While the mod's latest run is the `number`th and has not ended.
    private func isLive(_ id: String, run number: Int) -> Bool {
        guard let run = runner.run(of: id) else { return false }
        return run.number == number && run.state != .notRunning
    }
}
