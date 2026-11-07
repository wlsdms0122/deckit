//
//  JSONIndex.swift
//  Deck
//
//  Created by JSilver on 11/7/26.
//

import Foundation

// The place of a value in a JSON array, as a key of a coding path.
struct JSONIndex: CodingKey {
    // MARK: - Property
    let index: Int

    var intValue: Int? {
        index
    }

    var stringValue: String {
        String(index)
    }

    // MARK: - Initializer
    init(_ index: Int) {
        self.index = index
    }

    init?(stringValue: String) {
        nil
    }

    init?(intValue: Int) {
        self.init(intValue)
    }

    // MARK: - Public
    // MARK: - Private
}
