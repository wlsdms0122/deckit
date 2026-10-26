//
//  BindingIssue.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// Why a binding never runs, against `other`, which works where it does: `held`, it is not applied, the chord is taken;
// `shadowed`, `other` takes the chord first.
public struct BindingIssue: Equatable, Sendable {
    // MARK: - Property
    public enum Kind: String, Encodable, Sendable {
        case held
        case shadowed
    }

    public let kind: Kind
    public let other: Binding

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
