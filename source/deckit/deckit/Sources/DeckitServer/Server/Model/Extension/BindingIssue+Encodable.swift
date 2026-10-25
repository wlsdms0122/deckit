//
//  BindingIssue+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// `{ kind, other }`: `other` is what a reader needs of the binding the issue is about.
extension BindingIssue: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case kind
        case other
    }

    private enum OtherKeys: String, CodingKey {
        case id
        case chord
        case label
        case provider
        case scope
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(kind, forKey: .kind)
        var facts = container.nestedContainer(keyedBy: OtherKeys.self, forKey: .other)
        try facts.encode(other.id, forKey: .id)
        try facts.encode(other.keystroke?.label ?? "", forKey: .chord)
        try facts.encode(other.label, forKey: .label)
        try facts.encode(other.provider.id, forKey: .provider)
        try facts.encode(other.scope, forKey: .scope)
    }

    // MARK: - Private
}
