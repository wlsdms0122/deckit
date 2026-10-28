//
//  DeckitServer.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// The core's process: it answers the driver until the driver lets go of it.
@main
struct DeckitServer {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    static func main() {
        let transport = Transport()
        transport.log("started, pid \(getpid())")
        let server = Server()
        while let message = transport.receive() {
            guard let response = server.respond(to: message) else { continue }
            transport.send(response)
        }
    }

    // MARK: - Private
}
