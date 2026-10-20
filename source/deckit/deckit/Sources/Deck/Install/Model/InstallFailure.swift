//
//  InstallFailure.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A mod the app ships that did not install, from where it is shipped, and why.
struct InstallFailure: Equatable {
    // MARK: - Property
    let folder: URL
    let problem: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
