//
//  URLSchemesField.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The schemes whose addresses a mod opens, held under `urlSchemes`: `url-schemes = ["https"]`, or ["*"] for every
// scheme.
struct URLSchemesField: ManifestField {
    // MARK: - Property
    let name = "url-schemes"
    let key = "urlSchemes"

    private let every = "*"
    // What a page runs or holds itself: nothing opens these.
    private let notPlaces: Set<String> = ["javascript", "data", "blob", "about"]

    // MARK: - Initializer
    // MARK: - Public
    func read(_ written: TOMLValue?) -> any Encodable & Sendable {
        guard case let .array(values) = written else { return [String]() }
        return schemes(in: values)
    }

    func problem(of written: TOMLValue) -> String? {
        let example = "url-schemes = [\"https\"], or [\"*\"] for every scheme"
        guard case let .array(values) = written, !values.isEmpty else {
            return "url-schemes must be a list of schemes, as \(example)"
        }

        let bad = values.filter { value in
            guard case let .string(scheme) = value else { return true }
            return !isScheme(scheme)
        }
        guard bad.isEmpty else {
            return "url-schemes: \(bad.map(\.description).joined(separator: ", ")) is not a scheme; a scheme is lower "
                + "case, as \"https\" or \"my-app\", with no \":\""
        }

        let schemes = schemes(in: values)
        let unplaced = schemes.filter(notPlaces.contains)
        guard unplaced.isEmpty else {
            let named = unplaced.map { scheme in "\"\(scheme)\"" }.joined(separator: ", ")
            return "url-schemes: \(named) is not a place; nothing opens it"
        }
        guard !schemes.contains(every) || schemes.count == 1 else {
            return "url-schemes: \"\(every)\" already takes every scheme, so it stands alone"
        }

        return nil
    }

    // MARK: - Private
    // Each once, in the order written.
    private func schemes(in values: [TOMLValue]) -> [String] {
        var seen: Set<String> = []
        return values.compactMap { value in
            guard case let .string(scheme) = value, seen.insert(scheme).inserted else { return nil }
            return scheme
        }
    }

    // RFC 3986, lower case as compared.
    private func isScheme(_ scheme: String) -> Bool {
        scheme == every || scheme.wholeMatch(of: #/[a-z][a-z0-9+.-]*/#) != nil
    }
}
