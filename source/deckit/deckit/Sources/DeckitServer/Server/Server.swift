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

        return response.map(written)
    }

    // The response as a line, or, for a result that cannot be written, the error that says so: a request is always
    // answered.
    func written(_ response: Response) -> Data {
        do {
            return try encoder.encode(response)
        } catch {
            let failure = ResponseError(code: .internalError, message: "the answer could not be written: \(error)")
            return (try? encoder.encode(Response.error(id: response.id, failure))) ?? Data()
        }
    }

    // MARK: - Private
    private func answer(_ request: Request) -> Response? {
        let outcome: Result<any Encodable & Sendable, ResponseError>
        do {
            outcome = .success(try result(of: request))
        } catch let error as ResponseError {
            outcome = .failure(error)
        } catch let error as any Refusal {
            outcome = .failure(ResponseError(refusing: error))
        } catch let error as DecodingError {
            let message = "\(request.method) has no such params" + (error.place.map { place in " at \(place)" } ?? "")
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
            let deckit = try Deckit(
                home: URL(filePath: params.home, directoryHint: .isDirectory),
                ship: params.ship.map { folder in URL(filePath: folder) },
                sources: params.sources.map { folder in URL(filePath: folder) },
                api: params.api,
                name: params.name,
                schemeHandlers: params.schemeHandlers,
                permissions: params.permissions,
                given: Set(params.given)
            )
            self.deckit = deckit

            return InitializeResult(mods: deckit.deck.catalog.folder, data: deckit.deck.dataFolder.folder)
        }

        guard let deckit else {
            throw ResponseError(code: .serverNotInitialized, message: "\(request.method) before initialize")
        }

        let deck = deckit.deck
        switch request.method {
        case "record/read":
            let params = try request.decodeParams(as: ModKeyParams.self)
            return try deck.records.read(mod: params.mod, key: params.key) as any Encodable & Sendable

        case "record/write":
            let params = try request.decodeParams(as: WriteRecordParams.self)
            try deck.records.write(mod: params.mod, key: params.key, text: params.text)
            return true

        case "record/remove":
            let params = try request.decodeParams(as: ModKeyParams.self)
            try deck.records.remove(mod: params.mod, key: params.key)
            return true

        case "record/keys":
            return try deck.records.keys(mod: request.decodeParams(as: ModParams.self).mod)

        case "state/all":
            return try deck.state.all()

        case "state/write":
            let params = try request.decodeParams(as: WriteStateParams.self)
            try deck.state.write(folder: params.folder, key: params.key, text: params.text)
            return true

        case "configuration/declare":
            let params = try request.decodeParams(as: DeclareConfigurationParams.self)
            return try deckit.configuration.declare(params.configuration, mod: params.mod, run: params.run)

        case "configuration/values":
            return deckit.configuration.values(of: try request.decodeParams(as: ModParams.self).mod)

        case "configuration/list":
            return deckit.configuration.list()

        case "configuration/set":
            let params = try request.decodeParams(as: SetConfigurationParams.self)
            return try deckit.configuration.set(mod: params.mod, key: params.key, value: params.value)

        case "catalog/read":
            return deck.readCatalog()

        case "catalog/arrange":
            try deck.catalog.arrange(request.decodeParams(as: ArrangeCatalogParams.self).ids)
            return true

        case "catalog/install-shipped":
            return try deck.catalog.installShipped()

        case "catalog/plan-install":
            let folder = URL(filePath: try request.decodeParams(as: InstallModParams.self).from)
            return try deck.catalog.planInstall(from: folder)

        case "catalog/install":
            let folder = URL(filePath: try request.decodeParams(as: InstallModParams.self).from)
            return try deck.catalog.install(from: folder)

        case "catalog/remove":
            return try deck.catalog.remove(request.decodeParams(as: RemoveModParams.self).id)

        case "storage/usage":
            return try deck.storage.usage(mod: request.decodeParams(as: ModParams.self).mod)

        case "erasure/erase":
            try deck.erasure.erase(mod: request.decodeParams(as: ModParams.self).mod)
            return true

        case "erasure/uncleared":
            return deck.erasure.uncleared()

        case "erasure/cleared":
            try deck.erasure.cleared(mod: request.decodeParams(as: ModParams.self).mod)
            return true

        case "runner/load":
            return try deck.load(request.decodeParams(as: ModsParams.self).mods)

        case "runner/unload":
            return try deck.unload(request.decodeParams(as: ModsParams.self).mods)

        case "runner/described":
            let params = try request.decodeParams(as: DescribedParams.self)
            return try deck.described(params.mod, run: params.run, summary: params.summary)

        case "runner/started":
            let params = try request.decodeParams(as: StartedParams.self)
            return try deck.started(
                params.mod,
                run: params.run,
                summary: params.summary,
                contributions: params.contributions
            )

        case "runner/joined":
            let params = try request.decodeParams(as: StartedParams.self)
            return try deck.joined(
                params.mod,
                run: params.run,
                summary: params.summary,
                contributions: params.contributions
            )

        case "runner/problem":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return try deck.report(params.mod, run: params.run, problem: params.problem)

        case "runner/not-started":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return try deck.notStarted(params.mod, run: params.run, problem: params.problem)

        case "runner/crash":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return try deck.crashed(params.mod, run: params.run, problem: params.problem)

        case "runner/stopped":
            let params = try request.decodeParams(as: RunParams.self)
            return try deck.stopped(params.mod, run: params.run)

        case "export/requires":
            let params = try request.decodeParams(as: RunParams.self)
            return try deck.exports.requires(mod: params.mod, run: params.run)

        case "export/call":
            let params = try request.decodeParams(as: CallExportParams.self)
            try deck.exports.call(from: params.caller, run: params.run, mod: params.mod, path: params.path)
            return true

        case "extension/call":
            let params = try request.decodeParams(as: CallExtensionParams.self)
            try deck.extensions.call(
                from: params.caller,
                run: params.run,
                mod: params.mod,
                point: params.point,
                path: params.path
            )
            return true

        case "event/listen":
            let params = try request.decodeParams(as: ListenParams.self)
            deck.events.listen(mod: params.mod, run: params.run, names: params.names)
            return true

        case "event/emit":
            let params = try request.decodeParams(as: EmitParams.self)
            return deck.events.emit(mod: params.mod, run: params.run, name: params.name)

        case "keymap/register":
            let params = try request.decodeParams(as: RegisterKeyParams.self)
            return try deckit.keymap.register(params.key, provider: params.provider)

        case "keymap/bind":
            let params = try request.decodeParams(as: BindKeyParams.self)
            return try deckit.keymap.bind(params.id, spec: params.spec)

        case "keymap/reset":
            return try deckit.keymap.reset(request.decodeParams(as: ResetKeyParams.self).id)

        case "keymap/record":
            return RecordedKey(try request.decodeParams(as: RecordKeyParams.self).keystroke)

        case "keymap/keystrokes":
            return try request.decodeParams(as: KeystrokesParams.self).specs.map(Keystroke.init(spec:))

        case "command/define":
            let params = try request.decodeParams(as: DefineCommandsParams.self)
            try deckit.commands.define(params.commands, provider: params.provider)
            return true

        case "command/list":
            return deckit.commands.list()

        case "command/find":
            let params = try request.decodeParams(as: CheckCommandParams.self)
            return try deckit.commands.find(params.command, of: params.provider)

        case "command/check":
            let params = try request.decodeParams(as: CheckCommandParams.self)
            return try deckit.commands.check(params.command, of: params.provider, args: params.args)

        case "provider":
            return deckit.provider(of: try request.decodeParams(as: ProviderParams.self).id)

        case "open/route":
            let params = try request.decodeParams(as: RouteParams.self)
            return deckit.urlRouter.route(
                params.url,
                opensFiles: params.opensFiles,
                usesDefaultApp: params.usesDefaultApp
            )

        case "open/handlerLists":
            return deckit.urlRouter.handlerLists()

        case "open/setHandlers":
            let params = try request.decodeParams(as: SetHandlersParams.self)
            try deckit.urlRouter.setHandlers(of: params.scheme, order: params.order, off: params.off)
            return true

        default:
            throw ResponseError(code: .methodNotFound, message: "no method \(request.method)")
        }
    }
}
