//
//  InstallOutcome.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What became of a mod the app ships as what it ships was installed.
public enum InstallOutcome: String, Encodable, Sendable {
    case installed
    // Shipped before and removed by the person since, so it stays out.
    case leftOut = "left out"
    // Shipped before and no more, so its copy is taken away.
    case dropped
    case failed
    // A second folder shipped with an id.
    case ignored

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
