//
//  SeatSettingsParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// Those of the seats' settings that are set: the idle time in seconds, and whether a user that attaches is asked of
// the local seat. One left out stays as it is kept.
struct SeatSettingsParams: Decodable {
    // MARK: - Property
    let idleTime: TimeInterval?
    let asking: Bool?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
