//
//  Key.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A key as its owner declares it: the action it runs, its default chord as written, what a person reads it as, and
// where it works.
public struct Key: Decodable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case action
        case spec = "key"
        case label
        case scope
    }

    public let action: String
    public let spec: String
    public let label: String
    public let scope: KeyScope

    // MARK: - Initializer
    public init(action: String, spec: String, label: String, scope: KeyScope) {
        self.action = action
        self.spec = spec
        self.label = label
        self.scope = scope
    }

    // MARK: - Public
    // MARK: - Private
}
