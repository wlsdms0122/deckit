//
//  InstallFailure.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// A mod the app ships that did not install, as it ships it, and why.
struct InstallFailure {
    // MARK: - Property
    let shipped: ShippedMod
    let problem: any Error

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
