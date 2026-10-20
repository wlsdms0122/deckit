//
//  Connection.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The driver's end of the core: a message a line, in on stdin and out on stdout. Nothing else writes to stdout; what
// the core logs goes to stderr.
struct Connection {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // The next message, or nil once stdin has ended: the driver closed it, or its process ended.
    func receive() -> Data? {
        readLine(strippingNewline: true).map { Data($0.utf8) }
    }

    func send(_ message: Data) {
        FileHandle.standardOutput.write(message + Data("\n".utf8))
    }

    // MARK: - Private
}
