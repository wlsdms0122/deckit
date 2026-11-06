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
                permissions: params.permissions
            )
            self.deckit = deckit

            return InitializeResult(mods: deckit.catalog.folder, data: deckit.deck.dataFolder.folder)
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
            return try deckit.state.all()

        case "state/write":
            let params = try request.decodeParams(as: WriteStateParams.self)
            try deckit.state.write(folder: params.folder, key: params.key, text: params.text)
            return true

        case "catalog/read":
            return deckit.readCatalog()

        case "catalog/interfaces":
            return deckit.catalog.interfaces

        case "catalog/pin":
            let params = try request.decodeParams(as: PinCatalogParams.self)
            try deckit.catalog.pin(params.interface, to: params.mod)
            return true

        case "catalog/approve-startup":
            let params = try request.decodeParams(as: ApproveStartupParams.self)
            try deckit.catalog.approveStartup(params.mod, params.approved)
            return true

        case "catalog/read-file":
            let params = try request.decodeParams(as: ReadFileParams.self)
            return deckit.catalog.text(of: params.path, in: params.mod) as any Encodable & Sendable

        case "catalog/install-shipped":
            return try deckit.catalog.installShipped()

        case "catalog/plan-install":
            let folder = URL(filePath: try request.decodeParams(as: InstallModParams.self).from)
            return try deckit.catalog.planInstall(from: folder)

        case "catalog/install":
            let folder = URL(filePath: try request.decodeParams(as: InstallModParams.self).from)
            return try deckit.catalog.install(from: folder)

        case "catalog/remove":
            return try deckit.catalog.remove(request.decodeParams(as: RemoveModParams.self).id)

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

        case "runner/reconnect":
            return answered(deckit.reconnect(), by: deckit)

        case "runner/load":
            return answered(try deckit.load(request.decodeParams(as: LoadParams.self).requests), by: deckit)

        case "runner/reset-limit":
            deckit.resetLimit(try request.decodeParams(as: ModsParams.self).mods)
            return true

        case "runner/unload":
            return answered(try deckit.unload(request.decodeParams(as: ModsParams.self).mods), by: deckit)

        case "runner/described":
            let params = try request.decodeParams(as: DescribedParams.self)
            return answered(deckit.described(params.mod, run: params.run, summary: params.summary), by: deckit)

        case "runner/started":
            let params = try request.decodeParams(as: StartedParams.self)
            let effects = try deckit.started(
                params.mod,
                run: params.run,
                summary: params.summary,
                contributions: params.contributions,
                layers: params.layers
            )
            return answered(effects, by: deckit)

        case "runner/joined":
            let params = try request.decodeParams(as: StartedParams.self)
            let effects = try deckit.joined(
                params.mod,
                run: params.run,
                summary: params.summary,
                contributions: params.contributions,
                layers: params.layers
            )
            return answered(effects, by: deckit)

        case "runner/problem":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return answered(try deckit.report(params.mod, run: params.run, problem: params.problem), by: deckit)

        case "runner/not-started":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return answered(try deckit.notStarted(params.mod, run: params.run, problem: params.problem), by: deckit)

        case "runner/crash":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return answered(try deckit.crashed(params.mod, run: params.run, problem: params.problem), by: deckit)

        case "runner/stopped":
            let params = try request.decodeParams(as: RunParams.self)
            return answered(try deckit.stopped(params.mod, run: params.run), by: deckit)

        case "connection/begin":
            let params = try request.decodeParams(as: LifecycleParams.self)
            return try deck.connections.begin(mod: params.mod, run: params.run, lifecycle: params.lifecycle)

        case "connection/end":
            let params = try request.decodeParams(as: LifecycleParams.self)
            return answered(deck.ended(params.mod, run: params.run, lifecycle: params.lifecycle), by: deckit)

        case "connection/refuse":
            deck.connections.refuse(try request.decodeParams(as: ConnectionParams.self).connection)
            return true

        case "connection/route":
            let params = try request.decodeParams(as: MessageParams.self)
            return try deck.connections.route(from: params.mod, run: params.run, connection: params.connection)

        case "event/listen":
            let params = try request.decodeParams(as: ListenParams.self)
            deck.events.listen(mod: params.mod, run: params.run, names: params.names)
            return true

        case "event/emit":
            let params = try request.decodeParams(as: EmitParams.self)
            return try deck.events.emit(mod: params.mod, run: params.run, name: params.name)

        case "interface/contributions":
            let params = try request.decodeParams(as: ContributionsParams.self)
            return try deckit.catalog.declarations(to: params.interface, for: params.mod)

        default:
            throw ResponseError(code: .methodNotFound, message: "no method \(request.method)")
        }
    }

    // `effects` as the driver reads them.
    private func answered(_ effects: [Effect], by deckit: Deckit) -> [EffectAnswer] {
        effects.map { effect in EffectAnswer(effect, of: deckit) }
    }
}
