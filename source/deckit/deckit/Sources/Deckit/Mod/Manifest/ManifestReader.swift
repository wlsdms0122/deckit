//
//  ManifestReader.swift
//  Deckit
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck

// How deck reads a manifest: what it says, and what is wrong with it, against the mod contract `api` this deck speaks,
// the permissions deckit and the layers on this host define, and the fields the layers on deck add, which it reads
// none of. An interface is named `<mod id>/<name>`, the name of the same characters as an id, and spoken at a major, a
// whole number from 0.
struct ManifestReader {
    // MARK: - Property
    let file = "manifest.toml"

    private let ownFields: Set<TOMLKey> = [
        "id", "name", "version", "api", "main", "background", "interfaces", "permissions", "contributes"
    ]
    private let parser = TOMLParser()
    private let store: Store
    private let api: Version
    // In the order defined, as deckit hands them: its own first.
    private let permissions: [Permission]
    private let fields: Set<TOMLKey>

    // MARK: - Initializer
    init(
        api: Version,
        permissions: [Permission],
        fields: [String],
        store: Store
    ) throws {
        var ids: Set<TOMLKey> = []
        for permission in permissions {
            guard ids.insert(TOMLKey(permission.id)).inserted else {
                throw ManifestError.permissionDefined(permission.id)
            }
        }
        var names = ownFields
        for field in fields {
            guard names.insert(TOMLKey(field)).inserted else { throw ManifestError.fieldDefined(field) }
        }

        self.api = api
        self.store = store
        self.permissions = permissions
        self.fields = Set(fields.map { field in TOMLKey(field) })
    }

    // MARK: - Public
    // `fallback` stands for the id a manifest does not give, and a text that is no manifest reads as one that says
    // nothing.
    func read(_ text: String, fallback: String) -> Manifest {
        let raw = (try? parser.parse(text)) ?? [:]
        let named: String? = if case let .string(id) = raw["id"], !id.isEmpty { id } else { nil }
        let id = named ?? fallback
        let name = if case let .string(name) = raw["name"], !isBlank(name) { name } else { id }
        let asked = if case let .table(asked) = raw["permissions"] { asked } else { [TOMLKey: TOMLValue]() }

        return Manifest(
            id: id,
            namesID: named != nil,
            name: name,
            version: string(of: raw["version"]),
            api: string(of: raw["api"]),
            main: string(of: raw["main"]),
            background: string(of: raw["background"]),
            provides: provided(of: raw["interfaces"]),
            uses: used(of: raw["interfaces"]),
            permissions: requests(of: asked),
            contributes: contributed(of: raw["contributes"]),
            fields: byText(raw.filter { key, _ in fields.contains(key) }.mapValues(JSONValue.init))
        )
    }

    // What is wrong with a manifest, or nil: of a mod that is not a `system` mod, asking for a privileged permission.
    func problem(of text: String, system: Bool) -> String? {
        let raw: [TOMLKey: TOMLValue]
        do {
            raw = try parser.parse(text)
        } catch {
            return "\(file): \(error.message)"
        }

        let unknown = raw.keys
            .filter { key in !ownFields.contains(key) && !fields.contains(key) }
            .sorted()
        guard unknown.isEmpty else {
            return "\(file) has \(quoted(unknown.map(\.text))), which is not a manifest field"
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
            ?? backgroundProblem(raw)
            ?? interfacesProblem(raw)
            ?? permissionsProblem(raw, system: system)
            ?? contributesProblem(raw)
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
    private func mainProblem(_ raw: [TOMLKey: TOMLValue]) -> String? {
        let example = "main = \"dist/main.js\""
        guard case let .string(main) = raw["main"] else {
            return "\(file) needs main, the file deck runs, as \(example)"
        }

        return pathProblem(main, of: "main", example: example)
    }

    // The reason it asks to run in the background, when it asks.
    private func backgroundProblem(_ raw: [TOMLKey: TOMLValue]) -> String? {
        guard let written = raw["background"] else { return nil }
        guard case let .string(reason) = written, !isBlank(reason) else {
            return "background must be the reason the mod asks to run in the background, as text, as "
                + "background = \"Shows notifications as they come\""
        }

        return nil
    }

    // Segments apart at "/", each holding a scalar value and no "\\", and none "..".
    private func pathProblem(_ path: String, of field: String, example: String) -> String? {
        let segments = path.unicodeScalars.split(separator: "/", omittingEmptySubsequences: false)
        guard !path.unicodeScalars.contains("\\"),
            segments.allSatisfy({ segment in !segment.isEmpty && !segment.elementsEqual("..".unicodeScalars) })
        else {
            return "\(field) must be a path inside the mod's folder, as \(example), not \(TOMLValue.string(path))"
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

    // The interfaces it provides, each at the majors it speaks of it, each greater than the one before it, and those it
    // uses, each at the major it speaks: `provides = { "other/name" = [1, 2] }` and `uses = { "other/name" = 1 }`.
    private func interfacesProblem(_ raw: [TOMLKey: TOMLValue]) -> String? {
        guard let written = raw["interfaces"] else { return nil }

        let provides = "provides = { \"other/name\" = [1] }"
        let uses = "uses = { \"other/name\" = 1 }"
        guard case let .table(table) = written else {
            return "interfaces must be an [interfaces] table, as \(provides) and \(uses)"
        }
        let unknown = table.keys.filter { key in key != "provides" && key != "uses" }.sorted()
        guard unknown.isEmpty else {
            return "interfaces has \(quoted(unknown.map(\.text))); it takes provides and uses"
        }

        if let written = table["provides"] {
            guard case let .table(provided) = written else {
                return "interfaces.provides must be written as \(provides)"
            }
            for interface in provided.keys.sorted() {
                if let problem = interfaceProblem(interface.text) {
                    return "interfaces.provides \(interface.text): \(problem)"
                }
                guard case let .array(written) = provided[interface]!,
                    case let majors = written.compactMap(major),
                    !majors.isEmpty,
                    majors.count == written.count,
                    zip(majors, majors.dropFirst()).allSatisfy(<)
                else {
                    return "interfaces.provides \(interface.text) must be a list of majors, each greater than the one "
                        + "before it, as [1, 2], not \(provided[interface]!)"
                }
            }
        }

        if let written = table["uses"] {
            guard case let .table(used) = written else { return "interfaces.uses must be written as \(uses)" }
            for interface in used.keys.sorted() {
                if let problem = interfaceProblem(interface.text) {
                    return "interfaces.uses \(interface.text): \(problem)"
                }
                guard isMajor(used[interface]!) else {
                    return "interfaces.uses \(interface.text) must be a major, as 1, not \(used[interface]!)"
                }
            }
        }

        return nil
    }

    private func permissionsProblem(_ raw: [TOMLKey: TOMLValue], system: Bool) -> String? {
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
            return "permission \(quoted(unexplained.map(\.text))) needs the reason it is asked for, as text"
        }
        let privileged = permissions.filter { permission in
            permission.privileged && asked[TOMLKey(permission.id)] != nil
        }
        guard system || privileged.isEmpty else {
            return "permission \(quoted(privileged.map(\.id))) is granted only to a system mod"
        }

        return nil
    }

    // Each interface by the entries declared to it, each a table whose shape is the interface's to define:
    // `[[contributes."other/name"]]`.
    private func contributesProblem(_ raw: [TOMLKey: TOMLValue]) -> String? {
        guard let written = raw["contributes"] else { return nil }

        let example = "[[contributes.\"other/name\"]] tables"
        guard case let .table(table) = written else {
            return "contributes must be a [contributes] table of entry lists by interface, as \(example)"
        }
        for interface in table.keys.sorted() {
            if let problem = interfaceProblem(interface.text) {
                return "contributes \(interface.text): \(problem)"
            }
            guard case let .array(entries) = table[interface]!,
                entries.allSatisfy({ entry in if case .table = entry { true } else { false } })
            else {
                return "contributes \(interface.text) must be a list of tables, as \(example)"
            }
        }

        return nil
    }

    // Those defined here first, in the order defined, then those not defined, by id as keys come one after another.
    private func requests(of asked: [TOMLKey: TOMLValue]) -> [PermissionRequest] {
        let requests = asked.sorted { one, other in one.key < other.key }.map { id, reason in
            PermissionRequest(
                id: id.text,
                reason: trimmed(written(reason)),
                permission: permissions.first { permission in TOMLKey(permission.id) == id }
            )
        }
        let defined = permissions.compactMap { permission in
            requests.first { request in TOMLKey(request.id) == TOMLKey(permission.id) }
        }

        return defined + requests.filter { request in !request.usable }
    }

    // Each interface by the majors written that are majors.
    private func provided(of written: TOMLValue?) -> [String: [Int]] {
        guard case let .table(table) = written, case let .table(provided)? = table["provides"] else { return [:] }
        return byText(provided.mapValues { value in
            guard case let .array(majors) = value else { return [] }
            return majors.compactMap(major)
        })
    }

    // Each interface by the major written, of those written as a major.
    private func used(of written: TOMLValue?) -> [String: Int] {
        guard case let .table(table) = written, case let .table(used)? = table["uses"] else { return [:] }
        return byText(used.compactMapValues(major))
    }

    // Each interface by the entries written as tables, each as JSON writes it.
    private func contributed(of written: TOMLValue?) -> [String: [JSONValue]] {
        guard case let .table(table) = written else { return [:] }
        return byText(table.mapValues { value in
            guard case let .array(entries) = value else { return [] }
            return entries.compactMap { entry in
                guard case .table = entry else { return nil }
                return JSONValue(entry)
            }
        })
    }

    private func major(_ value: TOMLValue) -> Int? {
        guard case let .integer(major) = value, major >= 0 else { return nil }
        return major
    }

    private func isMajor(_ value: TOMLValue) -> Bool {
        major(value) != nil
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

    // A table by its keys' text, which takes two keys of one canonical form as one: of those, the key that comes first
    // is kept.
    private func byText<Value>(_ table: [TOMLKey: Value]) -> [String: Value] {
        let pairs = table.sorted { one, other in one.key < other.key }.map { key, value in (key.text, value) }
        return Dictionary(pairs) { first, _ in first }
    }

    private func quoted(_ names: [String]) -> String {
        names.map { name in "\"\(name)\"" }.joined(separator: ", ")
    }

    // Without the scalar values of the property White_Space at its ends.
    private func trimmed(_ text: String) -> String {
        let scalars = text.unicodeScalars.drop(while: \.properties.isWhitespace)
        guard let last = scalars.lastIndex(where: { scalar in !scalar.properties.isWhitespace }) else { return "" }

        return String(Substring(scalars[...last]))
    }

    // Holding no scalar value but those of the property White_Space.
    private func isBlank(_ text: String) -> Bool {
        text.unicodeScalars.allSatisfy(\.properties.isWhitespace)
    }
}
