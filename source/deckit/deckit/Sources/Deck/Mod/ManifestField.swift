//
//  ManifestField.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A field a layer on deck adds to the manifest: `name` as a manifest writes it, `key` as a manifest holds it.
public protocol ManifestField: Sendable {
    var name: String { get }
    var key: String { get }

    // What a manifest holds of the field as a mod wrote it, or of none written.
    func read(_ written: TOMLValue?) -> any Encodable & Sendable
    // What is wrong with the field as a mod wrote it, or nil.
    func problem(of written: TOMLValue) -> String?
}
