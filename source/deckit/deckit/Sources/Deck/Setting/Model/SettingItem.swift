//
//  SettingItem.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A setting as Settings lists it: its declaration, its value, and the options on offer.
public struct SettingItem: Sendable {
    // MARK: - Property
    public let declaration: SettingDeclaration
    // What was saved, over what was declared by default; none for an action.
    public let value: SettingValue?
    public let options: [SettingOption]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
