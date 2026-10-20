//
//  ErrorCode.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// JSON-RPC's codes, with the Language Server Protocol's for a server not yet initialized and a request that failed.
enum ErrorCode: Int {
    case parseError = -32700
    case invalidRequest = -32600
    case methodNotFound = -32601
    case invalidParams = -32602
    case internalError = -32603
    case serverNotInitialized = -32002
    case requestFailed = -32803

    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // MARK: - Private
}
