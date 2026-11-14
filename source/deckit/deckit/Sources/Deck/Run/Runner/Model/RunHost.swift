//
//  RunHost.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// What hosts a job's runs, where their messages arrive: deck binds it to the principal as it opens the sandbox.
public enum RunHost: Equatable, Sendable {
    // A page the driver makes, which loads the file `entry`.
    case page(entry: URL)
    // A transport connection that arrived from outside, as the driver names it, its principal verified.
    case transport(String)

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
