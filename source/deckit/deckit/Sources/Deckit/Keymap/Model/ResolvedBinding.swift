//
//  ResolvedBinding.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A binding as a keystroke is resolved: `active` while its chord is applied, and its issues.
public struct ResolvedBinding: Equatable, Sendable {
    // MARK: - Property
    public let binding: Binding
    public let active: Bool
    public let issues: [BindingIssue]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
