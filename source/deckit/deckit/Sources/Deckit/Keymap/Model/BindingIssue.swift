//
//  BindingIssue.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How a keystroke is actually resolved for a binding, against `other`: `held`, it is not applied, the chord is taken;
// `shadowed`, it never runs, another takes the chord first; `hides`, it hides `other` in its mod's page; `hidden`, it is
// not in `other`'s mod's page, where the chord is `other`'s.
public struct BindingIssue: Equatable, Sendable {
    // MARK: - Property
    public enum Kind: String, Encodable, Sendable {
        case held
        case shadowed
        case hides
        case hidden
    }

    public let kind: Kind
    public let other: Binding

    // An error for a binding that does not run, a warning for one that runs in fewer places.
    public var isError: Bool {
        kind == .held || kind == .shadowed
    }

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
