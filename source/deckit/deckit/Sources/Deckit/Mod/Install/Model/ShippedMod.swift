//
//  ShippedMod.swift
//  Deckit
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck

// A mod the app ships: the folder it ships it in, and whether the host names it a system mod.
public struct ShippedMod: Equatable, Sendable {
    // MARK: - Property
    public let folder: URL
    public let system: Bool

    // MARK: - Initializer
    public init(folder: URL, system: Bool) {
        self.folder = folder
        self.system = system
    }

    // MARK: - Public
    // MARK: - Private
}
