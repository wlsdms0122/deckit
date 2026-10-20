//
//  ManifestReader.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How deck reads a manifest: what it says, and what is wrong with it, against the mod contract `api` this deck speaks,
// the permissions there are and the fields the layers on deck add.
struct ManifestReader {
    // MARK: - Property
    let file = "manifest.toml"

    private let ownFields: Set<String> = ["id", "name", "version", "api", "main", "requires", "optional", "permissions"]
    private let parser = TOMLParser()
    private let store: Store
    private let api: Version
    // The widest first: those that reach past the app, then those inside it, each in the order defined.
    private let permissions: [Permission]
    private let fields: [any ManifestField]

    // MARK: - Initializer
    init(api: Version, permissions: [Permission], fields: [any ManifestField], store: Store) throws {
        var ids: Set<String> = []
        for permission in permissions {
            guard ids.insert(permission.id).inserted else { throw ManifestError.permissionDefined(permission.id) }
        }
        var names = ownFields
        for field in fields {
            guard names.insert(field.name).inserted else { throw ManifestError.fieldDefined(field.name) }
        }

        self.api = api
        self.store = store
        self.permissions = PermissionReach.allCases.flatMap { reach in
            permissions.filter { permission in permission.reach == reach }
        }
        self.fields = fields
    }

    // MARK: - Public
    // `fallback` stands for the id a manifest does not give, and a text that is no manifest reads as one that says
    // nothing.
    func read(_ text: String, fallback: String) -> Manifest {
        let raw = (try? parser.parse(text)) ?? [:]
        let id = if case let .string(id) = raw["id"], !id.isEmpty { id } else { fallback }
        let name = if case let .string(name) = raw["name"], !isBlank(name) { name } else { id }
        let asked = if case let .table(asked) = raw["permissions"] { asked } else { [String: TOMLValue]() }

        return Manifest(
            id: id,
            name: name,
            version: string(of: raw["version"]),
            api: string(of: raw["api"]),
            main: string(of: raw["main"]),
            requires: dependencies(of: raw["requires"]),
            optional: dependencies(of: raw["optional"]),
            permissions: permissions.compactMap { permission in
                asked[permission.id].map { reason in
                    PermissionRequest(
                        permission: permission,
                        reason: written(reason).trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                }
            },
            fields: Dictionary(uniqueKeysWithValues: fields.map { field in (field.key, field.read(raw[field.name])) })
        )
    }

    // What is wrong with a manifest, or nil.
    func problem(of text: String) -> String? {
        let raw: [String: TOMLValue]
        do {
            raw = try parser.parse(text)
        } catch {
            return "\(file): \(error.message)"
        }

        let unknown = raw.keys
            .filter { key in !ownFields.contains(key) && !fields.contains { field in field.name == key } }
            .sorted()
        guard unknown.isEmpty else {
            return "\(file) has \(quoted(unknown)), which is not a manifest field"
        }
        guard case let .string(id) = raw["id"], !id.isEmpty else {
            return "\(file) needs an id, as id = \"my-mod\""
        }
        if let problem = idProblem(id) {
            return problem
        }
        if let name = raw["name"] {
            guard case let .string(name) = name, !isBlank(name) else { return "name must be text" }
        }
        guard case let .string(version) = raw["version"], Version(version) != nil else {
            return raw["version"].map { version in "version must be written as \"MAJOR.MINOR.PATCH\", not \(version)" }
                ?? "\(file) needs a version, as version = \"1.0.0\""
        }
        guard case let .string(wanted) = raw["api"], let wantedAPI = Version(wanted) else {
            return raw["api"].map { wanted in
                "api must be written as \"MAJOR.MINOR.PATCH\" (this deck speaks \(api)), not \(wanted)"
            } ?? "\(file) needs an api, as api = \"\(api)\""
        }
        guard api.satisfies(wantedAPI) else {
            return "needs api \(wanted), this deck speaks \(api)"
        }

        return mainProblem(raw)
            ?? dependencyProblem(raw, field: "requires")
            ?? dependencyProblem(raw, field: "optional")
            ?? optionalProblem(raw, id: id)
            ?? permissionsProblem(raw)
            ?? fieldsProblem(raw)
    }

    // MARK: - Private
    // Each mod keeps what it stores under its id, and a Mac's disk is blind to case: "Note" and "note" would be one
    // folder while comparing as two ids.
    private func idProblem(_ id: String) -> String? {
        guard id == id.lowercased() else {
            return "mod ids are lower case: \"\(id.lowercased())\", not \"\(id)\""
        }
        guard store.isName(id) else {
            return "\"\(id)\" is not a usable mod id: lower case letters, digits, . _ - and at most 64 of them"
        }

        return nil
    }

    // A path inside the mod's folder, "/" separated; whether a file is there is the folder's to say.
    private func mainProblem(_ raw: [String: TOMLValue]) -> String? {
        let example = "main = \"dist/main.js\""
        guard case let .string(main) = raw["main"], !isBlank(main) else {
            return "\(file) needs main, the file deck runs, as \(example)"
        }
        guard !main.hasPrefix("/"),
            !main.contains("\\"),
            !main.split(separator: "/", omittingEmptySubsequences: false).contains("..")
        else {
            return "main must be a path inside the mod's folder, as \(example), not \(TOMLValue.string(main))"
        }

        return nil
    }

    private func dependencyProblem(_ raw: [String: TOMLValue], field: String) -> String? {
        guard let written = raw[field] else { return nil }
        guard case let .table(table) = written else {
            return "\(field) must be a [\(field)] table of mod id = version"
        }

        for other in table.keys.sorted() {
            if let problem = idProblem(other) {
                return "\(field) \(other): \(problem)"
            }
            guard case let .string(wanted) = table[other], Version(wanted) != nil else {
                return "\(field) \(other) must be written as \"MAJOR.MINOR.PATCH\", not \(table[other]!)"
            }
        }

        return nil
    }

    // An optional dependency is neither the mod itself nor one it requires.
    private func optionalProblem(_ raw: [String: TOMLValue], id: String) -> String? {
        guard case let .table(optional) = raw["optional"] else { return nil }
        guard optional[id] == nil else { return "\(id) names itself in [optional]" }
        guard case let .table(requires) = raw["requires"] else { return nil }

        let both = optional.keys.filter { other in requires[other] != nil }.sorted()
        guard !both.isEmpty else { return nil }

        return "\(quoted(both)) \(both.count > 1 ? "are" : "is") in both [requires] and [optional]"
    }

    private func permissionsProblem(_ raw: [String: TOMLValue]) -> String? {
        guard let written = raw["permissions"] else { return nil }

        let example = "[permissions] table of name = \"why it is needed\", such as \"deckit.mods\" = \"…\""
        guard case let .table(asked) = written else { return "permissions must be a \(example)" }

        let unknown = asked.keys.filter { id in !permissions.contains { permission in permission.id == id } }.sorted()
        guard unknown.isEmpty else {
            return "unknown permission \(quoted(unknown)); there are \(quoted(permissions.map(\.id)))"
        }

        let unexplained = asked
            .filter { _, reason in
                guard case let .string(reason) = reason else { return true }
                return isBlank(reason)
            }
            .keys
            .sorted()
        guard unexplained.isEmpty else {
            return "permission \(quoted(unexplained)) needs the reason it is asked for, as text"
        }

        return nil
    }

    private func fieldsProblem(_ raw: [String: TOMLValue]) -> String? {
        for field in fields {
            if let written = raw[field.name], let problem = field.problem(of: written) {
                return problem
            }
        }

        return nil
    }

    private func dependencies(of written: TOMLValue?) -> [String: String] {
        guard case let .table(table) = written else { return [:] }
        return table.mapValues(self.written)
    }

    private func string(of written: TOMLValue?) -> String? {
        guard case let .string(text) = written else { return nil }
        return text
    }

    // A text as it is, anything else as TOML writes it.
    private func written(_ value: TOMLValue) -> String {
        guard case let .string(text) = value else { return value.description }
        return text
    }

    private func quoted(_ names: [String]) -> String {
        names.map { name in "\"\(name)\"" }.joined(separator: ", ")
    }

    private func isBlank(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
