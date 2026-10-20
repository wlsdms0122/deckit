//
//  Keystroke+Codable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deckit

// As the driver hears a key pressed: its code, and each modifier held.
extension Keystroke: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case code
        case meta
        case control
        case shift
        case alt
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            code: try container.decode(String.self, forKey: .code),
            meta: try container.decode(Bool.self, forKey: .meta),
            control: try container.decode(Bool.self, forKey: .control),
            shift: try container.decode(Bool.self, forKey: .shift),
            alt: try container.decode(Bool.self, forKey: .alt)
        )
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(code, forKey: .code)
        try container.encode(meta, forKey: .meta)
        try container.encode(control, forKey: .control)
        try container.encode(shift, forKey: .shift)
        try container.encode(alt, forKey: .alt)
    }

    // MARK: - Private
}
