//
//  Server.swift
//  DeckitServer
//
//  Created by JSilver on 10/20/26.
//

import Foundation
import Deck
import Deckit

// What the core answers each message the driver sends, one at a time in the order they come: deckit exists from
// `initialize` on.
final class Server {
    // MARK: - Property
    private let decoder = JSONDecoder()
    private let encoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        return encoder
    }()
    private var deckit: Deckit?

    // MARK: - Initializer
    // MARK: - Public
    // The response to a message, or nil for a notification.
    func respond(to message: Data) -> Data? {
        let response: Response?
        do {
            response = answer(try decoder.decode(Request.self, from: message))
        } catch let DecodingError.dataCorrupted(context) where context.codingPath.isEmpty {
            let error = ResponseError(code: .parseError, message: "not JSON: \(context.debugDescription)")
            response = .error(id: nil, error)
        } catch {
            response = .error(id: nil, ResponseError(code: .invalidRequest, message: "not a request: \(error)"))
        }

        return response.flatMap { try? encoder.encode($0) }
    }

    // MARK: - Private
    // Where in the params what was not there, or not of its kind, is: ` at settings.2.label`, or nothing for the
    // params whole.
    private func place(of error: DecodingError) -> String {
        let path = switch error {
        case let .keyNotFound(key, context):
            context.codingPath + [key]

        case let .typeMismatch(_, context), let .valueNotFound(_, context), let .dataCorrupted(context):
            context.codingPath

        @unknown default:
            [any CodingKey]()
        }
        guard !path.isEmpty else { return "" }

        return " at " + path.map { key in key.intValue.map(String.init) ?? key.stringValue }.joined(separator: ".")
    }

    private func answer(_ request: Request) -> Response? {
        let outcome: Result<any Encodable & Sendable, ResponseError>
        do {
            outcome = .success(try result(of: request))
        } catch let error as ResponseError {
            outcome = .failure(error)
        } catch let error as any DeckError {
            outcome = .failure(ResponseError(code: .requestFailed, message: error.message, kind: error.kind))
        } catch let error as DecodingError {
            let message = "\(request.method) has no such params\(place(of: error))"
            outcome = .failure(ResponseError(code: .invalidParams, message: message))
        } catch {
            outcome = .failure(ResponseError(code: .internalError, message: error.localizedDescription))
        }

        guard let id = request.id else { return nil }
        switch outcome {
        case let .success(result):
            return .result(id: id, result)

        case let .failure(error):
            return .error(id: id, error)
        }
    }

    // What deckit answers `request` with. A method that answers nothing else answers true once it is done; one whose
    // answer may be none answers it as an optional value, never as nil.
    private func result(of request: Request) throws -> any Encodable & Sendable {
        if request.method == "initialize" {
            guard deckit == nil else {
                throw ResponseError(code: .invalidRequest, message: "the core is initialized once")
            }

            let params = try request.decodeParams(as: InitializeParams.self)
            deckit = try Deckit(
                home: URL(filePath: params.home, directoryHint: .isDirectory),
                ship: params.ship.map { folder in URL(filePath: folder) },
                sources: params.sources.map { folder in URL(filePath: folder) },
                api: params.api,
                name: params.name,
                schemeHandlers: params.schemeHandlers,
                permissions: params.permissions
            )
            return JSONValue.object([:])
        }

        guard let deckit else {
            throw ResponseError(code: .serverNotInitialized, message: "\(request.method) before initialize")
        }

        let deck = deckit.deck
        switch request.method {
        case "record/read":
            let params = try request.decodeParams(as: ModKeyParams.self)
            return try deck.readRecord(mod: params.mod, key: params.key) as any Encodable & Sendable

        case "record/write":
            let params = try request.decodeParams(as: WriteRecordParams.self)
            try deck.writeRecord(mod: params.mod, key: params.key, text: params.text)
            return true

        case "record/remove":
            let params = try request.decodeParams(as: ModKeyParams.self)
            try deck.removeRecord(mod: params.mod, key: params.key)
            return true

        case "record/keys":
            return try deck.recordKeys(mod: request.decodeParams(as: ModParams.self).mod)

        case "record/count":
            return try deck.countRecords(mod: request.decodeParams(as: ModParams.self).mod)

        case "state/all":
            return try deck.state.all()

        case "state/write":
            let params = try request.decodeParams(as: WriteStateParams.self)
            try deck.state.write(folder: params.folder, key: params.key, text: params.text)
            return true

        case "setting/read":
            return deck.settings(of: try request.decodeParams(as: ModParams.self).mod)

        case "setting/declare":
            let params = try request.decodeParams(as: DeclareSettingsParams.self)
            return deck.declareSettings(params.settings, mod: params.mod, run: params.run)

        case "setting/computed-choices":
            return deck.computedChoices(mod: try request.decodeParams(as: ComputedChoicesParams.self).mod)

        case "setting/list":
            return deck.listSettings(choices: try request.decodeParams(as: ListSettingsParams.self).choices)

        case "setting/set":
            let params = try request.decodeParams(as: SetSettingParams.self)
            return try deck.setSetting(mod: params.mod, key: params.key, value: params.value, options: params.options)

        case "setting/action":
            let params = try request.decodeParams(as: ModKeyParams.self)
            try deck.validateSettingAction(mod: params.mod, key: params.key)
            return true

        case "catalog/read":
            return deck.readCatalog()

        case "catalog/arrange":
            try deck.arrange(request.decodeParams(as: ArrangeCatalogParams.self).ids)
            return true

        case "catalog/install-shipped":
            return try deck.installShipped()

        case "catalog/would-install":
            return try deck.wouldInstall(from: URL(filePath: request.decodeParams(as: InstallModParams.self).from))

        case "catalog/install":
            return try deck.install(from: URL(filePath: request.decodeParams(as: InstallModParams.self).from))

        case "catalog/remove":
            return try deck.remove(request.decodeParams(as: RemoveModParams.self).id)

        case "data/count":
            return try deck.countData(mod: request.decodeParams(as: ModParams.self).mod)

        case "erasure/erase":
            try deck.erase(mod: request.decodeParams(as: ModParams.self).mod)
            return true

        case "erasure/uncleared":
            return deck.uncleared()

        case "erasure/cleared":
            try deck.cleared(mod: request.decodeParams(as: ModParams.self).mod)
            return true

        case "runner/reconcile":
            return try deck.reconcile()

        case "runner/relaunch":
            return try deck.relaunch(request.decodeParams(as: ModParams.self).mod)

        case "runner/relaunch-all":
            return try deck.relaunchAll()

        case "runner/quit":
            return try deck.quit()

        case "runner/load":
            return try deck.load(request.decodeParams(as: ModParams.self).mod)

        case "runner/started":
            let params = try request.decodeParams(as: StartedParams.self)
            return try deck.started(
                params.mod,
                run: params.run,
                summary: params.summary,
                contributions: params.contributions
            )

        case "runner/problem":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return try deck.recordProblem(params.mod, run: params.run, problem: params.problem)

        case "runner/not-started":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return try deck.notStarted(params.mod, run: params.run, problem: params.problem)

        case "runner/crash":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return try deck.crash(params.mod, run: params.run, problem: params.problem)

        case "runner/stopped":
            let params = try request.decodeParams(as: RunParams.self)
            return try deck.stopped(params.mod, run: params.run)

        case "export/dependencies":
            let params = try request.decodeParams(as: RunParams.self)
            return try deck.dependencies(mod: params.mod, run: params.run)

        case "export/call":
            let params = try request.decodeParams(as: CallExportParams.self)
            return try deck.callExport(from: params.caller, run: params.run, mod: params.mod, path: params.path)

        case "extension/call":
            let params = try request.decodeParams(as: CallExtensionParams.self)
            try deck.callExtension(
                from: params.caller,
                run: params.run,
                mod: params.mod,
                point: params.point,
                path: params.path
            )
            return true

        case "event/listen":
            let params = try request.decodeParams(as: ListenParams.self)
            deck.listen(mod: params.mod, run: params.run, names: params.names)
            return true

        case "event/emit":
            let params = try request.decodeParams(as: EmitParams.self)
            return deck.emit(mod: params.mod, run: params.run, name: params.name)

        case "keymap/register":
            return deckit.registerKey(try request.decodeParams(as: Key.self))

        case "keymap/bind":
            let params = try request.decodeParams(as: BindKeyParams.self)
            return try deckit.bindKey(params.id, spec: params.spec)

        case "keymap/reset":
            return try deckit.resetKey(request.decodeParams(as: ResetKeyParams.self).id)

        case "keymap/record":
            return deckit.recordKey(try request.decodeParams(as: RecordKeyParams.self).keystroke)

        case "keymap/keystrokes":
            return deckit.keystrokes(of: try request.decodeParams(as: KeystrokesParams.self).specs)

        case "command/sources":
            return deckit.commandSources()

        case "open/route":
            let params = try request.decodeParams(as: RouteParams.self)
            return deckit.route(params.url, userInitiated: params.userInitiated, usesDefaultApp: params.usesDefaultApp)

        case "open/handlerLists":
            return deckit.handlerLists()

        case "open/setHandlers":
            let params = try request.decodeParams(as: SetHandlersParams.self)
            try deckit.setHandlers(of: params.scheme, order: params.order, off: params.off)
            return true

        default:
            throw ResponseError(code: .methodNotFound, message: "no method \(request.method)")
        }
    }
}
