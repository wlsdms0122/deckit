//
//  ResponseError.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct ResponseError: Error, Equatable {
    // MARK: - Property
    let code: ErrorCode
    let message: String
    // The kind of a call's refusal, which the driver puts back on the error it throws.
    let kind: String?

    // MARK: - Initializer
    init(code: ErrorCode, message: String, kind: String? = nil) {
        self.code = code
        self.message = message
        self.kind = kind
    }

    // MARK: - Public
    // MARK: - Private
}
