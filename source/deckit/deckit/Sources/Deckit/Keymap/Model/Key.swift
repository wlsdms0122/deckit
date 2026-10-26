//
//  Key.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key as its provider declares it: its name among the provider's, what a person reads it as, the chord it is bound to
// by default and where it works.
public struct Key: Decodable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case name
        case label
        case spec = "key"
        case scope
    }

    public let name: String
    public let label: String
    public let spec: String
    public let scope: KeyScope

    // MARK: - Initializer
    public init(name: String, label: String, spec: String, scope: KeyScope) {
        self.name = name
        self.label = label
        self.spec = spec
        self.scope = scope
    }

    // MARK: - Public
    // MARK: - Private
}
