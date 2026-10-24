//
//  ResolvedBinding+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// One object: the binding, with `key` and `spec` as written, `chord` and `defaultChord` as a person reads them, `app`
// for the app's own, and what the driver resolves a keystroke with, `keystroke` and `editsText` (a text field owns it).
extension ResolvedBinding: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case owner
        case ownerName
        case app
        case reach
        case action
        case label
        case key
        case spec
        case chord
        case defaultChord
        case changed
        case active
        case issues
        case keystroke
        case editsText
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(binding.id, forKey: .id)
        try container.encode(binding.owner.id, forKey: .owner)
        try container.encode(binding.owner.name, forKey: .ownerName)
        try container.encode(binding.owner.isApp, forKey: .app)
        try container.encode(binding.reach, forKey: .reach)
        try container.encode(binding.action, forKey: .action)
        try container.encode(binding.label, forKey: .label)
        try container.encode(binding.defaultKeystroke?.spec, forKey: .key)
        try container.encode(binding.keystroke?.spec, forKey: .spec)
        try container.encode(binding.keystroke?.label ?? "", forKey: .chord)
        try container.encode(binding.defaultKeystroke?.label ?? "", forKey: .defaultChord)
        try container.encode(binding.changed, forKey: .changed)
        try container.encode(active, forKey: .active)
        try container.encode(issues, forKey: .issues)
        try container.encode(binding.keystroke, forKey: .keystroke)
        try container.encode(binding.keystroke?.editsText ?? false, forKey: .editsText)
    }

    // MARK: - Private
}
