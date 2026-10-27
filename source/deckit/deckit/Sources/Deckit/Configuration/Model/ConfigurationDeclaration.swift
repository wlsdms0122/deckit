//
//  ConfigurationDeclaration.swift
//  Deckit
//
//  Created by JSilver on 10/27/26.
//

import Foundation

// What a mod declares can be configured under `key`, as a subset of JSON Schema: its `type`, a `title` and a
// `description` as a person reads them, its `default`, and what bounds the values it takes: `oneOf` the choices, or
// `minimum` and `maximum` for a number. Deckit never reads what a value means.
public struct ConfigurationDeclaration: Decodable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case key
        case type
        case title
        case description
        case defaultValue = "default"
        case oneOf
        case minimum
        case maximum
    }

    public let key: String
    public let type: ConfigurationType
    public let title: String?
    public let description: String?
    public let defaultValue: ConfigurationValue?
    public let oneOf: [ConfigurationChoice]
    public let minimum: Double?
    public let maximum: Double?

    // MARK: - Initializer
    public init(
        key: String,
        type: ConfigurationType,
        title: String? = nil,
        description: String? = nil,
        defaultValue: ConfigurationValue? = nil,
        oneOf: [ConfigurationChoice] = [],
        minimum: Double? = nil,
        maximum: Double? = nil
    ) {
        self.key = key
        self.type = type
        self.title = title
        self.description = description
        self.defaultValue = defaultValue
        self.oneOf = oneOf
        self.minimum = minimum
        self.maximum = maximum
    }

    // A choice of another type, or a default it does not take, is not read.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            key: try container.decode(String.self, forKey: .key),
            type: try container.decode(ConfigurationType.self, forKey: .type),
            title: try container.decodeIfPresent(String.self, forKey: .title),
            description: try container.decodeIfPresent(String.self, forKey: .description),
            defaultValue: try container.decodeIfPresent(ConfigurationValue.self, forKey: .defaultValue),
            oneOf: try container.decodeIfPresent([ConfigurationChoice].self, forKey: .oneOf) ?? [],
            minimum: try container.decodeIfPresent(Double.self, forKey: .minimum),
            maximum: try container.decodeIfPresent(Double.self, forKey: .maximum)
        )
        guard oneOf.allSatisfy({ choice in isOfType(choice.value) }) else {
            throw DecodingError.dataCorruptedError(forKey: .oneOf, in: container, debugDescription: "not its type")
        }
        if let defaultValue, !takes(defaultValue) {
            throw DecodingError.dataCorruptedError(forKey: .defaultValue, in: container, debugDescription: "not taken")
        }
    }

    // MARK: - Public
    // Whether it takes `value` as it is: of its type, within its bounds, and one of its choices when it has any.
    public func takes(_ value: ConfigurationValue) -> Bool {
        guard isOfType(value) else { return false }
        guard oneOf.isEmpty || oneOf.contains(where: { choice in choice.value == value }) else { return false }
        guard case let .number(number) = value else { return true }

        return number >= minimum ?? -.infinity && number <= maximum ?? .infinity
    }

    // What it is set to for `value`: a number is held within its bounds.
    func value(for value: ConfigurationValue?) throws(ConfigurationError) -> ConfigurationValue {
        guard let value, isOfType(value) else { throw .notOfType(key: key, type: type) }

        let held = if case let .number(number) = value {
            ConfigurationValue.number(Swift.min(maximum ?? .infinity, Swift.max(minimum ?? -.infinity, number)))
        } else {
            value
        }
        guard takes(held) else { throw .notAChoice(key: key, value: value) }

        return held
    }

    // MARK: - Private
    private func isOfType(_ value: ConfigurationValue) -> Bool {
        switch (type, value) {
        case (.boolean, .bool), (.number, .number), (.string, .string):
            true

        case (.boolean, _), (.number, _), (.string, _):
            false
        }
    }
}
