//
//  Seat.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// Where one user sits: its pointer, its keyboard and its view. `id` is `local` for the seat whose devices are this
// machine's hardware, and `s<n>` for one a transport connection opened.
public struct Seat: Equatable, Sendable {
    // MARK: - Property
    public let id: String
    public let user: User
    public let local: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
