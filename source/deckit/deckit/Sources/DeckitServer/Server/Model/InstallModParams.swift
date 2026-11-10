//
//  InstallModParams.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct InstallModParams: Decodable {
    // MARK: - Property
    // The folder the mod is installed from.
    let from: String
    // Whether nothing changes, the install answered as it would be.
    let dryRun: Bool

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
