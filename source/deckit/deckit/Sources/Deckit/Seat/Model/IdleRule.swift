//
//  IdleRule.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

// When a seat is idle: its devices gave no input for `time` seconds. The driver keeps each seat's clock and tells
// deckit the seconds, and deckit judges. The time is a setting, `idleTime` of the state's key `seats`, which deckit
// reserves and reads once, as it starts.
public struct IdleRule: Equatable, Sendable {
    // MARK: - Property
    static let key = "seats"
    static let standard: TimeInterval = 300
    public let time: TimeInterval

    // MARK: - Initializer
    public init(time: TimeInterval) {
        self.time = time
    }

    // `text` is what the state keeps under the key: the standard time where it keeps none, or names no time.
    init(kept text: String?) {
        guard let text,
            case let .object(fields)? = try? JSONValue(data: Data(text.utf8)),
            case let .number(time)? = fields["idleTime"],
            time >= 0
        else {
            self.init(time: Self.standard)
            return
        }

        self.init(time: time)
    }

    // MARK: - Public
    // Whether a seat whose devices gave no input for `seconds` is idle.
    public func isIdle(after seconds: TimeInterval) -> Bool {
        seconds >= time
    }

    // MARK: - Private
}
