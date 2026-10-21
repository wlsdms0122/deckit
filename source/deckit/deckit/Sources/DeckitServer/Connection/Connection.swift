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
    // Once the driver has ended, what it sent before is still read and kept: an answer to no one is dropped, rather
    // than ending the core with SIGPIPE.
    init() {
        signal(SIGPIPE, SIG_IGN)
    }

    // MARK: - Public
    // The next message, or nil once stdin has ended: the driver closed it, or its process ended.
    func receive() -> Data? {
        readLine(strippingNewline: true).map { Data($0.utf8) }
    }

    func send(_ message: Data) {
        try? FileHandle.standardOutput.write(contentsOf: message + Data("\n".utf8))
    }

    // A line of the core's log, which the driver keeps in deckit's log.
    func log(_ line: String) {
        try? FileHandle.standardError.write(contentsOf: Data((line + "\n").utf8))
    }

    // MARK: - Private
}
