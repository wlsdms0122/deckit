//
//  Int+Manifest.swift
//  Deckit
//
//  Created by JSilver on 11/7/26.
//

import Foundation
import Deck

extension Int {
    // MARK: - Property
    // 2^53 - 1, the bound on each side of 0 of every integer a manifest writes and of each number of a version: within
    // it each integer is a double-precision number that no other integer rounds to, so it is handed on as the same
    // number wherever it is read.
    static let largestInManifest = 9_007_199_254_740_991

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
