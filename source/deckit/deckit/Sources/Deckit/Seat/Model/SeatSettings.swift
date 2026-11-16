//
//  SeatSettings.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

// The seats' settings, `{ idleTime, asking }` under the state's key `seats`, which deckit reserves. `idleTime` is the
// seconds a seat's devices give no input for before the seat is idle, which the driver judges by as it keeps each
// seat's clock. `asking` is whether a user that attaches waits until the local seat lets it sit.
public struct SeatSettings: Equatable, Sendable {
    // MARK: - Property
    static let key = "seats"
    public static let standard = SeatSettings(idleTime: 300, asking: false)
    public let idleTime: TimeInterval
    public let asking: Bool

    // What the state keeps of them.
    var text: String {
        get throws {
            let kept = JSONValue.object(["idleTime": .number(idleTime), "asking": .bool(asking)])
            return String(decoding: try JSONWriter().write(kept), as: UTF8.self)
        }
    }

    // MARK: - Initializer
    public init(idleTime: TimeInterval, asking: Bool) {
        self.idleTime = idleTime
        self.asking = asking
    }

    // `text` is what the state keeps under the key: a setting it does not keep, or keeps as no value of its kind, is
    // the standard one.
    init(kept text: String?) {
        let fields: [JSONName: JSONValue]
        if let text, case let .object(kept)? = try? JSONValue(data: Data(text.utf8)) {
            fields = kept
        } else {
            fields = [:]
        }

        if case let .number(time)? = fields["idleTime"], Self.isTime(time) {
            idleTime = time
        } else {
            idleTime = Self.standard.idleTime
        }
        if case let .bool(asking)? = fields["asking"] {
            self.asking = asking
        } else {
            asking = Self.standard.asking
        }
    }

    // MARK: - Public
    // Whether `seconds` is an idle time: one from 0 on.
    static func isTime(_ seconds: TimeInterval) -> Bool {
        seconds.isFinite && seconds >= 0
    }

    // MARK: - Private
}
