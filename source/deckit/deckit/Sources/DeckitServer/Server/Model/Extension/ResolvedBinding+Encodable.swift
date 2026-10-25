//
//  ResolvedBinding+Encodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// One object: the binding, with `key` and `spec` as written, `chord` and `defaultChord` as a person reads them, `host`
// for a host's own, the `command` it runs with `args`, and what the driver resolves a keystroke with, `keystroke` and
// `takenByFields` (a field with focus may take it).
extension ResolvedBinding: Encodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case id
        case owner
        case ownerName
        case host
        case scope
        case name
        case command
        case args
        case label
        case key
        case spec
        case chord
        case defaultChord
        case changed
        case active
        case issues
        case keystroke
        case takenByFields
    }

    // MARK: - Initializer
    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(binding.id, forKey: .id)
        try container.encode(binding.owner.id, forKey: .owner)
        try container.encode(binding.owner.name, forKey: .ownerName)
        try container.encode(binding.owner.isHost, forKey: .host)
        try container.encode(binding.scope, forKey: .scope)
        try container.encode(binding.name, forKey: .name)
        try container.encode(binding.command, forKey: .command)
        try container.encode(binding.args, forKey: .args)
        try container.encode(binding.label, forKey: .label)
        try container.encode(binding.defaultKeystroke?.spec, forKey: .key)
        try container.encode(binding.keystroke?.spec, forKey: .spec)
        try container.encode(binding.keystroke?.label ?? "", forKey: .chord)
        try container.encode(binding.defaultKeystroke?.label ?? "", forKey: .defaultChord)
        try container.encode(binding.changed, forKey: .changed)
        try container.encode(active, forKey: .active)
        try container.encode(issues, forKey: .issues)
        try container.encode(binding.keystroke, forKey: .keystroke)
        try container.encode(binding.keystroke?.takenByFields ?? false, forKey: .takenByFields)
    }

    // MARK: - Private
}
