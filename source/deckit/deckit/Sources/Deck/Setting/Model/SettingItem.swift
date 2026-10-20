//
//  SettingItem.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A setting as Settings lists it: its declaration, its value, and the options on offer.
struct SettingItem: Sendable {
    // MARK: - Property
    let declaration: SettingDeclaration
    // What was saved, over what was declared by default; none for an action.
    let value: SettingValue?
    let options: [SettingOption]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
