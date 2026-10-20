//
//  ComputedChoice+Decodable.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// Options its page answered that are not options read as none, so one mod's page never keeps another's settings from
// being listed.
extension ComputedChoice: Decodable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case mod
        case key
        case options
    }

    // MARK: - Initializer
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            mod: try container.decode(String.self, forKey: .mod),
            key: try container.decode(String.self, forKey: .key),
            options: (try? container.decode([SettingOption].self, forKey: .options)) ?? []
        )
    }

    // MARK: - Public
    // MARK: - Private
}
