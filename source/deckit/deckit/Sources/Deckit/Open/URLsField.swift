//
//  URLsField.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// The addresses a mod asks to be offered, held under `urls`: `urls = ["https://github.com/*", "board:*"]`, or ["*"] for
// every address.
public struct URLsField: ManifestField {
    // MARK: - Property
    public let name = "urls"
    public let key = "urls"

    // MARK: - Initializer
    public init() {}

    // MARK: - Public
    public func read(_ written: TOMLValue?) -> [String] {
        guard case let .array(values) = written else { return [] }
        return patterns(in: values).map(\.written)
    }

    public func problem(of written: TOMLValue) -> String? {
        let example = "urls = [\"https://github.com/*\", \"board:*\"], or [\"*\"] for every address"
        guard case let .array(values) = written, !values.isEmpty else {
            return "urls must be a list of address patterns, as \(example)"
        }

        let bad = values.filter { value in
            guard case let .string(pattern) = value else { return true }
            return URLPattern(pattern) == nil
        }
        guard bad.isEmpty else {
            return "urls: \(bad.map(\.description).joined(separator: ", ")) is not an address pattern; one is "
                + "\"<scheme>:*\" or \"<scheme>://<host>/<path>*\", its * only at the end"
        }

        let patterns = patterns(in: values)
        let unplaced = patterns.filter { pattern in URLScheme(name: pattern.scheme)?.isPlace == false }
        guard unplaced.isEmpty else {
            let named = unplaced.map { pattern in "\"\(pattern.written)\"" }.joined(separator: ", ")
            return "urls: \(named) is not a place; nothing opens it"
        }
        guard !patterns.contains(where: { pattern in pattern.match == .every }) || patterns.count == 1 else {
            return "urls: \"\(URLScheme.every)\" already takes every address, so it stands alone"
        }

        return nil
    }

    // MARK: - Private
    // Each once, in the order written.
    private func patterns(in values: [TOMLValue]) -> [URLPattern] {
        var seen: Set<String> = []
        return values.compactMap { value in
            guard case let .string(written) = value, seen.insert(written).inserted else { return nil }
            return URLPattern(written)
        }
    }
}
