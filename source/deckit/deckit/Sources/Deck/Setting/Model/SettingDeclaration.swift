//
//  SettingDeclaration.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// What a mod declares the person can choose under `key`, as its page tells it: the data, without functions. Options
// worked out as they are read are `computed`, and its page answers them.
struct SettingDeclaration: Decodable, Equatable, Sendable {
    // MARK: - Property
    private enum CodingKeys: String, CodingKey {
        case key
        case type
        case label
        case defaultValue = "default"
        case hint
        case options
        case computed
        case min
        case max
        case step
        case unit
        case placeholder
        case button
    }

    let key: String
    let type: SettingType
    let label: String?
    let defaultValue: SettingValue?
    let hint: String?
    let options: [SettingOption]
    let computed: Bool
    let min: Double?
    let max: Double?
    let step: Double?
    let unit: String?
    let placeholder: String?
    let button: String?

    // MARK: - Initializer
    init(
        key: String,
        type: SettingType,
        label: String? = nil,
        defaultValue: SettingValue? = nil,
        hint: String? = nil,
        options: [SettingOption] = [],
        computed: Bool = false,
        min: Double? = nil,
        max: Double? = nil,
        step: Double? = nil,
        unit: String? = nil,
        placeholder: String? = nil,
        button: String? = nil
    ) {
        self.key = key
        self.type = type
        self.label = label
        self.defaultValue = defaultValue
        self.hint = hint
        self.options = options
        self.computed = computed
        self.min = min
        self.max = max
        self.step = step
        self.unit = unit
        self.placeholder = placeholder
        self.button = button
    }

    // MARK: - Public
    // The options on offer now: for a choice whose options are computed, those its page worked out, or none.
    func options(workedOut: [SettingOption]?) -> [SettingOption] {
        computed ? workedOut ?? [] : options
    }

    // What the setting is set to for `value`, which is of the kind declared: a number is held within its bounds, and
    // a choice takes one of `options`, those on offer now.
    func value(for value: SettingValue?, among options: [SettingOption]) throws(SettingError) -> SettingValue {
        switch (type, value) {
        case let (.toggle, .bool(on)?):
            return .bool(on)

        case let (.text, .string(text)?):
            return .string(text)

        case let (.number, .number(number)?):
            return .number(Swift.min(max ?? .infinity, Swift.max(min ?? -.infinity, number)))

        case let (.choice, value?) where options.contains(where: { option in option.value == value }):
            return value

        case (.choice, _):
            throw .notAnOption(key: key, value: value)

        case (.action, _):
            throw .isAnAction(key)

        case (.toggle, _), (.number, _), (.text, _):
            throw .notOfType(key: key, type: type)
        }
    }

    // MARK: - Private
}
