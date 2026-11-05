//
//  InterfaceDeclaration.swift
//  Deck
//
//  Created by JSilver on 11/6/26.
//

import Foundation

// What a mod's contributes declares under `interfaces`: entries for interfaces, by interface, each an object whose
// shape is the interface's to define. Deck holds them for each interface's owner and reads none of them.
public struct InterfaceDeclaration: Equatable, Sendable {
    // MARK: - Property
    static let key = "interfaces"
    public let entries: [String: [JSONValue]]
    // What cannot be used, left out of `entries`.
    public let problems: [String]

    // MARK: - Initializer
    init(contributes: [String: JSONValue]) {
        guard let declared = contributes[Self.key] else {
            self.init(entries: [:], problems: [])
            return
        }
        guard case let .object(interfaces) = declared else {
            let problem = "contributes \"\(Self.key)\" must be an object of entry lists by interface"
            self.init(entries: [:], problems: [problem])
            return
        }

        var entries: [String: [JSONValue]] = [:]
        var problems: [String] = []
        for (interface, value) in interfaces.sorted(by: { one, other in one.key < other.key }) {
            guard case let .array(list) = value,
                list.allSatisfy({ entry in if case .object = entry { true } else { false } })
            else {
                problems.append("contributes \"\(Self.key)\" \"\(interface)\" must be a list of objects")
                continue
            }
            entries[interface] = list
        }
        self.init(entries: entries, problems: problems)
    }

    private init(entries: [String: [JSONValue]], problems: [String]) {
        self.entries = entries
        self.problems = problems
    }

    // MARK: - Public
    // MARK: - Private
}
