//
//  UserRegistry.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation
import Deck

// The users: the principals deckit keeps a user record for. The record is what makes a principal one that sits at a
// seat, which a key alone does not. It is kept as principal state under `user`, so deck erases it with the principal.
public final class UserRegistry {
    // MARK: - Property
    static let name = "user"
    private let principalState: PrincipalState
    private let store: Store
    private let writer = JSONWriter(options: [.sortedKeys])

    // MARK: - Initializer
    init(principalState: PrincipalState, store: Store) throws {
        try principalState.reserve(Self.name)
        self.principalState = principalState
        self.store = store
    }

    // MARK: - Public
    // The user kept under the id, or nil for a principal that is none.
    public func user(of id: String) -> User? {
        guard store.isName(id),
            let text = principalState.read(Self.name, principal: id),
            let record = try? JSONDecoder().decode(UserRecord.self, from: Data(text.utf8))
        else {
            return nil
        }

        return User(id: id, name: record.name)
    }

    // By id.
    public func all() throws -> [User] {
        try principalState.principals(Self.name).compactMap(user(of:))
    }

    // One kept already takes the name.
    func add(_ user: User) throws {
        guard store.isName(user.id) else { throw UserError.notAPrincipal(user.id) }

        let text = String(decoding: try writer.write(UserRecord(name: user.name)), as: UTF8.self)
        try principalState.write(Self.name, principal: user.id, text: text)
    }

    // MARK: - Private
}
