//
//  URLPattern.swift
//  Deckit
//
//  Created by JSilver on 10/28/26.
//

import Foundation

// Which addresses a mod asks to be offered, as its manifest writes it: `*` every address, `<scheme>:*` every one of a
// scheme, and `<scheme>://<host>/<path>*` those of a host whose path starts so. Scheme and host are lower case as
// compared; a `*` stands only at the end, after the scheme's `:` or a `/` of the path.
public struct URLPattern: Equatable, Sendable {
    public enum Match: Equatable, Sendable {
        case every
        case scheme(String)
        case host(scheme: String, host: String, path: String)
    }

    // MARK: - Property
    public let written: String
    public let match: Match

    // The scheme whose handler list it is in.
    var scheme: String {
        switch match {
        case .every:
            URLScheme.every

        case let .scheme(scheme), let .host(scheme, _, _):
            scheme
        }
    }

    // How narrow it is: a pattern that matches less is asked about first among those no person placed.
    var specificity: Int {
        switch match {
        case .every:
            0

        case .scheme:
            1

        case let .host(_, _, path):
            2 + path.count
        }
    }

    // MARK: - Initializer
    init?(_ written: String) {
        self.written = written
        if written == URLScheme.every {
            self.match = .every
            return
        }
        guard written.hasSuffix("*"), let colon = written.firstIndex(of: ":") else { return nil }
        guard let scheme = URLScheme(name: written[..<colon].lowercased()) else { return nil }

        let rest = written[written.index(after: colon)...].dropLast()
        if rest.isEmpty {
            self.match = .scheme(scheme.name)
            return
        }
        guard rest.hasPrefix("//"), !rest.contains("*") else { return nil }

        let place = rest.dropFirst(2)
        guard let slash = place.firstIndex(of: "/"), slash != place.startIndex else { return nil }
        self.match = .host(scheme: scheme.name, host: place[..<slash].lowercased(), path: String(place[slash...]))
    }

    // MARK: - Public
    // Whether the address is one it asks for: its scheme, and its host and the start of its path where it names them.
    func matches(_ address: String) -> Bool {
        guard let scheme = URLScheme(address: address) else { return false }

        switch match {
        case .every:
            return true

        case let .scheme(name):
            return scheme.name == name

        case let .host(name, host, path):
            let afterScheme = address.dropFirst(name.count + 1)
            guard scheme.name == name, afterScheme.hasPrefix("//") else { return false }
            let place = afterScheme.dropFirst(2)
            let end = place.firstIndex { character in character == "/" || character == "?" || character == "#" }
                ?? place.endIndex
            guard place[..<end].lowercased() == host else { return false }

            let located = place[end...]
            return located.hasPrefix(path) || path == "/" && located.isEmpty
        }
    }

    // MARK: - Private
}
