//
//  CallParams.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

public protocol CallParams: Sendable {
    func decode<Params: Decodable>(as type: Params.Type) throws -> Params
}
