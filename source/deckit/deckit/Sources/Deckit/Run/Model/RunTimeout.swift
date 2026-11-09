//
//  RunTimeout.swift
//  Deckit
//
//  Created by JSilver on 11/9/26.
//

import Foundation
import Deck

// How long a run is given, in seconds: its code `launch` to start once it launched, before it times out, and each of
// its lifecycles `end` to end once its end is asked, before it ends anyway. The driver keeps the time and tells deckit
// a run that timed out.
public struct RunTimeout: Sendable {
    // MARK: - Property
    public let launch: TimeInterval
    public let end: TimeInterval

    // MARK: - Initializer
    public init(launch: TimeInterval, end: TimeInterval) {
        self.launch = launch
        self.end = end
    }

    // MARK: - Public
    // MARK: - Private
}
