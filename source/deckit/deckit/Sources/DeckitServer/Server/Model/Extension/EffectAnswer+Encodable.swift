//
//  EffectAnswer+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// Each as `effect`, its name, with the mod's id as `mod` and a run's number as `run`, as main names them in what it
// asks; the mod a sandbox opens for is `found`, as the catalog reads it. A run's `contributions` are deck's keys, and
// what it is refused with at launch is `refusal`, `{ stage, kind, message }`, `stage` "launch". An
// event delivered is `name` and `listeners`, as `event/emit` answers it. A lifecycle that waits is `wait`, with the
// mod it waits for as `mod`, the name it reaches it by as `name` and itself as `client`.
extension EffectAnswer: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case effect
        case mod
        case found
        case notification
        case run
        case state
        case failed
        case refusal
        case problem
        case contributions
        case connection
        case name
        case client
    }

    private enum RefusalKeys: String, CodingKey {
        case stage
        case kind
        case message
    }

    // MARK: - Initializer
    // MARK: - Public
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch effect {
        case let .open(job):
            try container.encode("open", forKey: .effect)
            try container.encode(job.modId, forKey: .mod)
            try container.encodeIfPresent(found, forKey: .found)

        case let .loadPage(modId):
            try container.encode("loadPage", forKey: .effect)
            try container.encode(modId, forKey: .mod)

        case let .tell(notification, run):
            try container.encode("tell", forKey: .effect)
            try container.encode(notification, forKey: .notification)
            try encode(run, in: &container)

        case let .keep(run):
            try container.encode("keep", forKey: .effect)
            try encode(run, in: &container)

        case let .stop(modId, number):
            try container.encode("stop", forKey: .effect)
            try container.encode(modId, forKey: .mod)
            try container.encode(number, forKey: .run)

        case let .kill(modId):
            try container.encode("kill", forKey: .effect)
            try container.encode(modId, forKey: .mod)

        case let .close(modId):
            try container.encode("close", forKey: .effect)
            try container.encode(modId, forKey: .mod)

        case let .connect(connection):
            try container.encode("connect", forKey: .effect)
            try container.encode(connection, forKey: .connection)

        case let .disconnect(connection):
            try container.encode("disconnect", forKey: .effect)
            try container.encode(connection, forKey: .connection)

        case let .deliver(delivery):
            try delivery.encode(to: encoder)
            try container.encode("deliver", forKey: .effect)

        case let .wait(name, client, service):
            try container.encode("wait", forKey: .effect)
            try container.encode(service, forKey: .mod)
            try container.encode(name, forKey: .name)
            try container.encode(client, forKey: .client)
        }
    }

    // MARK: - Private
    private func encode(_ run: Run, in container: inout KeyedEncodingContainer<CodingKeys>) throws {
        try container.encode(run.modId, forKey: .mod)
        try container.encode(run.number, forKey: .run)
        try container.encode(run.state, forKey: .state)
        try container.encode(run.failed, forKey: .failed)
        if let refusal {
            var refused = container.nestedContainer(keyedBy: RefusalKeys.self, forKey: .refusal)
            try refused.encode("launch", forKey: .stage)
            try refused.encodeIfPresent(refusal.kind, forKey: .kind)
            try refused.encode(refusal.message, forKey: .message)
        }
        try container.encodeIfPresent(run.problem, forKey: .problem)
        try container.encodeIfPresent(run.contributions, forKey: .contributions)
    }
}
