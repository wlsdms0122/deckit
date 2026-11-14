//
//  SeatTable.swift
//  Deckit
//
//  Created by JSilver on 11/15/26.
//

import Foundation

// The seats open, one a user, and the users that wait for the local seat's answer before they sit, by the transport
// connection each arrived on. In memory only.
public final class SeatTable {
    // MARK: - Property
    static let local = "local"
    // In the order they opened.
    public private(set) var all: [Seat] = []
    // How many seats transport connections opened: a seat's number is never another's in a start.
    private var opened = 0
    // Transport connection -> the user that waits on it.
    private var asking: [String: User] = [:]

    // MARK: - Initializer
    init() {}

    // MARK: - Public
    public var local: Seat? {
        all.first(where: \.local)
    }

    // The seat the user sits at.
    public func seat(of user: String) -> Seat? {
        all.first { seat in seat.user.id == user }
    }

    // The caller hands a user that sits at no seat, and a local one only while no local seat is open.
    func open(_ user: User, local: Bool) -> Seat {
        if !local {
            opened += 1
        }
        let seat = Seat(id: local ? Self.local : "s\(opened)", user: user, local: local)
        all.append(seat)

        return seat
    }

    // The seat a transport connection opened for the user closes. The local seat stays: no run of its user holds it.
    func close(of user: String) -> Seat? {
        guard let index = all.firstIndex(where: { seat in seat.user.id == user && !seat.local }) else { return nil }
        return all.remove(at: index)
    }

    func ask(_ user: User, transport: String) {
        asking[transport] = user
    }

    // The user that waited on the transport connection, which waits no more.
    @discardableResult
    func answer(transport: String) -> User? {
        asking.removeValue(forKey: transport)
    }

    // MARK: - Private
}
