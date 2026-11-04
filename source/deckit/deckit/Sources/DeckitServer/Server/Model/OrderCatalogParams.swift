//
//  OrderCatalogParams.swift
//  DeckitServer
//
//  Created by JSilver on 11/4/26.
//

import Foundation

struct OrderCatalogParams: Decodable {
    // MARK: - Property
    let interface: String
    // The implementations placed, in the order they take among themselves.
    let order: [String]
    let off: [String]

    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
