//
//  LaunchOrigin+Codable.swift
//  DeckitServer
//
//  Created by JSilver on 11/6/26.
//

import Foundation
import Deck

// As `kind`, `person`, `startup`, `required` with the dependent's id as `by`, or `work` with what the work is as
// `work` and the id of the mod that asked as `mod`, absent for none.
extension LaunchOrigin: Codable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case kind
        case by
        case work
        case mod
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let kind = try container.decode(String.self, forKey: .kind)
        switch kind {
        case "person":
            self = .person

        case "startup":
            self = .startup

        case "required":
            self = .required(by: try container.decode(String.self, forKey: .by))

        case "work":
            self = .work(
                try container.decode(JSONValue.self, forKey: .work),
                mod: try container.decodeIfPresent(String.self, forKey: .mod)
            )

        default:
            throw DecodingError.dataCorruptedError(forKey: .kind, in: container, debugDescription: "no origin \(kind)")
        }
    }

    // MARK: - Public
    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .person:
            try container.encode("person", forKey: .kind)

        case .startup:
            try container.encode("startup", forKey: .kind)

        case let .required(dependent):
            try container.encode("required", forKey: .kind)
            try container.encode(dependent, forKey: .by)

        case let .work(work, mod):
            try container.encode("work", forKey: .kind)
            try container.encode(work, forKey: .work)
            try container.encodeIfPresent(mod, forKey: .mod)
        }
    }

    // MARK: - Private
}
