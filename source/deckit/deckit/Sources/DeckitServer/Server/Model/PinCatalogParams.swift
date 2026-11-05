//
//  PinCatalogParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation

struct PinCatalogParams: Decodable {
    // MARK: - Property
    let interface: String
    // The provider pinned as its owner, or nil to clear its pin.
    let mod: String?

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
