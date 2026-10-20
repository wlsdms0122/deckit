//
//  BindingIssue+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// `{ level, kind, other }`: `level` is `error` or `warn`, and `other` what a reader needs of the binding the issue is
// about.
extension BindingIssue: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case level
        case kind
        case other
    }

    private enum OtherKeys: String, CodingKey {
        case id
        case chord
        case label
        case owner
        case ownerName
        case scope
        case app
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(isError ? "error" : "warn", forKey: .level)
        try container.encode(kind, forKey: .kind)
        var facts = container.nestedContainer(keyedBy: OtherKeys.self, forKey: .other)
        try facts.encode(other.id, forKey: .id)
        try facts.encode(other.keystroke?.label ?? "", forKey: .chord)
        try facts.encode(other.label, forKey: .label)
        try facts.encode(other.owner.id, forKey: .owner)
        try facts.encode(other.owner.name, forKey: .ownerName)
        try facts.encode(other.scope, forKey: .scope)
        try facts.encode(other.owner.isApp, forKey: .app)
    }

    // MARK: - Private
}
