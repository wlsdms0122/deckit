//
//  AuthorizedKeyStore.swift
//  Deck
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// The authorized keys: for each principal the public keys that may authenticate as it, one file a principal, written
// whole. Deck reads them to decide who a transport connection is, holds no private key, and erases them with the
// principal, so one made again under the same id inherits none.
public final class AuthorizedKeyStore {
    // MARK: - Property
    private let fileExtension = "json"
    private let folder: URL
    private let store: Store

    // MARK: - Initializer
    init(folder: URL, store: Store) {
        self.folder = folder
        self.store = store
    }

    // MARK: - Public
    // The key may authenticate as the principal from now on, under its name: one registered already takes the name.
    public func authorize(principal: String, key: AuthorizedKey) throws {
        guard key.key.count == key.scheme.keyLength else { throw AuthenticationError.notAKey(key.scheme) }

        let others = try keys(of: principal).filter { other in !isSame(other, key) }
        try write(others + [key], principal: principal)
    }

    // The key authenticates as the principal no more.
    public func revoke(principal: String, scheme: SignatureScheme, key: Data) throws {
        let revoked = AuthorizedKey(scheme: scheme, key: key, name: "")
        try write(try keys(of: principal).filter { other in !isSame(other, revoked) }, principal: principal)
    }

    // In the order they were registered. Any id may be asked, so one that is no name is refused.
    public func keys(of principal: String) throws -> [AuthorizedKey] {
        guard store.isName(principal) else { throw AuthenticationError.notAPrincipal(principal) }
        guard let text = store.read(file(of: principal)) else { return [] }
        guard let keys = try? JSONValue(data: Data(text.utf8)).decode(as: [AuthorizedKey].self) else {
            throw AuthenticationError.unreadable(principal)
        }

        return keys
    }

    func count(principal: String) -> Int {
        ((try? keys(of: principal)) ?? []).count
    }

    func erase(principal: String) throws {
        try store.remove(file(of: principal))
    }

    // MARK: - Private
    private func isSame(_ key: AuthorizedKey, _ other: AuthorizedKey) -> Bool {
        key.scheme == other.scheme && key.key == other.key
    }

    // A principal with no key keeps no file.
    private func write(_ keys: [AuthorizedKey], principal: String) throws {
        guard !keys.isEmpty else { return try store.remove(file(of: principal)) }
        let text = String(decoding: try JSONWriter(options: [.sortedKeys]).write(keys), as: UTF8.self)
        try store.write(text, to: file(of: principal))
    }

    // The caller hands a principal that is a name, so it is a file name.
    private func file(of principal: String) -> URL {
        folder.appending(path: principal).appendingPathExtension(fileExtension)
    }
}
