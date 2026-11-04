//
//  ManifestReader.swift
//  Deck
//
//  Created by JSilver on 10/20/26.
//

import Foundation

// How deck reads a manifest: what it says, and what is wrong with it, against the mod contract `api` this deck speaks,
// the permissions the layers on this host define, and the fields the layers on deck add. An interface is named
// `<mod id>/<name>`, the name of the same characters as an id.
struct ManifestReader {
    // MARK: - Property
    let file = "manifest.toml"

    private let ownFields: Set<String> = [
        "id", "name", "version", "api", "main", "implements", "dependencies", "permissions"
    ]
    private let parser = TOMLParser()
    private let store: Store
    private let api: Version
    // The widest first: those that reach past the app, then those inside it, each in the order defined.
    private let permissions: [Permission]
    private let fields: [any ManifestField]

    // MARK: - Initializer
    init(
        api: Version,
        permissions: [Permission],
        fields: [any ManifestField],
        store: Store
    ) throws {
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
            implements: implemented(of: raw["implements"]),
            dependencies: dependencies(of: raw["dependencies"]),
            permissions: requests(of: asked),
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
            ?? implementsProblem(raw)
            ?? dependenciesProblem(raw, id: id)
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

    // `<mod id>/<name>`: the id of the mod that defines it, and a name of the same characters.
    private func interfaceProblem(_ name: String) -> String? {
        let parts = name.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, parts.allSatisfy({ part in store.isName(String(part)) }) else {
            return "\"\(name)\" is not an interface: <mod id>/<name>, each lower case letters, digits, . _ - and at "
                + "most 64 of them"
        }

        return nil
    }

    // Each interface at the version the mod implements it at, as `"other/name" = "1.0.0"`.
    private func implementsProblem(_ raw: [String: TOMLValue]) -> String? {
        guard let written = raw["implements"] else { return nil }

        let example = "\"other/name\" = \"1.0.0\""
        guard case let .table(table) = written else {
            return "implements must be an [implements] table of interface = version, as \(example)"
        }

        for interface in table.keys.sorted() {
            if let problem = interfaceProblem(interface) {
                return "implements \(interface): \(problem)"
            }
            guard case let .string(version) = table[interface]!, Version(version) != nil else {
                return "implements \(interface) must be written as \"MAJOR.MINOR.PATCH\", not \(table[interface]!)"
            }
        }

        return nil
    }

    // Each interface at a version: a required one as `"other/name" = "1.0.0"`, an optional one as
    // `"other/name" = { version = "1.0.0", optional = true }`. A mod does not require an interface it implements: once
    // it is picked for it, it would never load.
    private func dependenciesProblem(_ raw: [String: TOMLValue], id: String) -> String? {
        guard let written = raw["dependencies"] else { return nil }

        let example = "\"other/name\" = \"1.0.0\", or \"other/name\" = { version = \"1.0.0\", optional = true }"
        guard case let .table(table) = written else {
            return "dependencies must be a [dependencies] table of interface = version, as \(example)"
        }

        let implemented = implemented(of: raw["implements"])
        for other in table.keys.sorted() {
            if let problem = interfaceProblem(other) {
                return "dependencies \(other): \(problem)"
            }

            switch table[other]! {
            case let .string(wanted) where Version(wanted) != nil:
                guard implemented[other] == nil else {
                    return "\(id) requires \(other), which it implements: it may name it as optional"
                }

            case let .table(fields):
                let unknown = fields.keys.filter { key in key != "version" && key != "optional" }.sorted()
                guard unknown.isEmpty else {
                    return "dependencies \(other) has \(quoted(unknown)); it takes version and optional"
                }
                guard case let .string(wanted) = fields["version"], Version(wanted) != nil else {
                    return "dependencies \(other) needs a version written as \"MAJOR.MINOR.PATCH\", as \(example)"
                }
                if let optional = fields["optional"] {
                    guard case .boolean = optional else {
                        return "dependencies \(other): optional must be true or false"
                    }
                }
                guard fields["optional"] == .boolean(true) || implemented[other] == nil else {
                    return "\(id) requires \(other), which it implements: it may name it as optional"
                }

            case let value:
                return "dependencies \(other) must be written as \(example), not \(value)"
            }
        }

        return nil
    }

    private func permissionsProblem(_ raw: [String: TOMLValue]) -> String? {
        guard let written = raw["permissions"] else { return nil }

        let example = "[permissions] table of name = \"why it is needed\", such as \"deckit.mods\" = \"…\""
        guard case let .table(asked) = written else { return "permissions must be a \(example)" }

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

    // The widest first, those a layer defines in the order defined, then those none does.
    private func requests(of asked: [String: TOMLValue]) -> [PermissionRequest] {
        let requests = asked.sorted { one, other in one.key < other.key }.map { id, reason in
            PermissionRequest(
                id: id,
                reason: written(reason).trimmingCharacters(in: .whitespacesAndNewlines),
                permission: permissions.first { permission in permission.id == id }
            )
        }
        let defined = permissions.compactMap { permission in requests.first { request in request.id == permission.id } }
        let undefined = requests.filter { request in !request.usable }

        return PermissionReach.allCases.flatMap { reach in
            (defined + undefined).filter { request in request.reach == reach }
        }
    }

    // Each interface by the version written, as it is.
    private func implemented(of written: TOMLValue?) -> [String: String] {
        guard case let .table(table) = written else { return [:] }
        return table.mapValues(self.written)
    }

    // A required one by its version, an optional one as its table says.
    private func dependencies(of written: TOMLValue?) -> [String: Dependency] {
        guard case let .table(table) = written else { return [:] }
        return table.mapValues { value in
            guard case let .table(fields) = value else {
                return Dependency(version: self.written(value), optional: false)
            }
            let version = fields["version"].map(self.written) ?? ""
            return Dependency(version: version, optional: fields["optional"] == .boolean(true))
        }
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
