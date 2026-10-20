//
//  BindingOverride.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A chord a person gave a binding in place of its default: `spec` is empty for none.
struct BindingOverride: Codable, Equatable, Sendable {
    // MARK: - Property
    let id: String
    let spec: String

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
