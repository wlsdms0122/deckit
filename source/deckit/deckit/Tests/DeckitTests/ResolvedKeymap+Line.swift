//
//  ResolvedKeymap+Line.swift
//  DeckitTests
//
//  Created by JSilver on 10/20/26.
//

import Foundation
@testable import Deckit

extension ResolvedKeymap {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // The binding of `id` as a test compares it: `id active kind:other ...`.
    func line(of id: String) -> String? {
        guard let resolved = bindings.first(where: { resolved in resolved.binding.id == id }) else { return nil }
        let issues = resolved.issues.map { issue in issue.kind.rawValue + ":" + issue.other.id }

        return ([id, resolved.active ? "active" : "inactive"] + issues).joined(separator: " ")
    }

    // MARK: - Private
}
