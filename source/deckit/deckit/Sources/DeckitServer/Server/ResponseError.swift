//
//  ResponseError.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation

struct ResponseError: Error {
    // MARK: - Property
    let code: ErrorCode
    let message: String
    // The kind of a call's refusal and the stage it is refused at, which the driver puts back on the error it throws.
    let kind: String?
    let stage: String?

    // MARK: - Initializer
    init(code: ErrorCode, message: String, kind: String? = nil, stage: String? = nil) {
        self.code = code
        self.message = message
        self.kind = kind
        self.stage = stage
    }

    // MARK: - Public
    // MARK: - Private
}
