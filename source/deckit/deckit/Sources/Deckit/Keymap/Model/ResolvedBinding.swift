//
//  ResolvedBinding.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A binding as a keystroke is resolved: `active` while its chord is applied, and its issues.
struct ResolvedBinding: Equatable, Sendable {
    // MARK: - Property
    let binding: Binding
    let active: Bool
    let issues: [BindingIssue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
