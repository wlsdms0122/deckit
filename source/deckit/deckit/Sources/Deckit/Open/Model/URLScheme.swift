//
//  URLScheme.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// A URL's scheme, lower case as compared (RFC 3986).
struct URLScheme: Equatable, Sendable {
    // MARK: - Property
    // What a list of schemes names for every scheme, in a manifest and among the handler lists.
    static let every = "*"

    // What a page runs or holds itself: nothing opens these.
    private static let notPlaces: Set<String> = ["javascript", "data", "blob", "about"]

    let name: String

    // Whether an address of the scheme is a place something opens.
    var isPlace: Bool {
        !Self.notPlaces.contains(name)
    }

    // MARK: - Initializer
    init?(name: String) {
        guard name.wholeMatch(of: #/[a-z][a-z0-9+.-]*/#) != nil else { return nil }
        self.name = name
    }

    // The scheme an address is written with.
    init?(address: String) {
        guard let colon = address.firstIndex(of: ":"), colon != address.startIndex else { return nil }
        self.init(name: address[..<colon].lowercased())
    }

    // MARK: - Public
    // MARK: - Private
}
