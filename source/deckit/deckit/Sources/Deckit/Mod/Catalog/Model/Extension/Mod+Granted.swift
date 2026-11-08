//
//  Mod+Granted.swift
//  Deckit
//
//  Created by JSilver on 11/8/26.
//

import Foundation
import Deck

extension Mod {
    // MARK: - Property
    // The permissions its manifest asks for that this host defines, granted as installing it consented to them.
    var granted: [String] {
        manifest.permissions.filter(\.usable).map(\.id)
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
