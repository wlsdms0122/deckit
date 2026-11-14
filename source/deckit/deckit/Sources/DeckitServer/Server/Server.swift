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
    private let writer = JSONWriter()
    private var deckit: Deckit?

    // MARK: - Initializer
    // MARK: - Public
    // The response to a message, or nil for a notification.
    func respond(to message: Data) -> Data? {
        let response: Response?
        do {
            response = answer(try Request(JSONValue(data: message)))
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
            return try writer.write(response)
        } catch {
            let failure = ResponseError(code: .internalError, message: "the answer could not be written: \(error)")
            return (try? writer.write(Response.error(id: response.id, failure))) ?? Data()
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
                ship: params.ship,
                sources: params.sources.map { folder in URL(filePath: folder) },
                api: params.api,
                permissions: params.permissions,
                fields: params.fields
            )
            self.deckit = deckit

            return InitializeResult(
                mods: deckit.catalog.folder,
                data: deckit.deck.dataFolder.folder,
                timeout: deckit.timeout
            )
        }

        guard let deckit else {
            throw ResponseError(code: .serverNotInitialized, message: "\(request.method) before initialize")
        }

        let deck = deckit.deck
        switch request.method {
        case "record/read":
            let params = try request.decodeParams(as: ModKeyParams.self)
            return try deck.records.read(principal: params.mod, key: params.key) as any Encodable & Sendable

        case "record/write":
            let params = try request.decodeParams(as: WriteRecordParams.self)
            try deck.records.write(principal: params.mod, key: params.key, text: params.text)
            return true

        case "record/remove":
            let params = try request.decodeParams(as: ModKeyParams.self)
            try deck.records.remove(principal: params.mod, key: params.key)
            return true

        case "record/keys":
            return try deck.records.keys(principal: request.decodeParams(as: ModParams.self).mod)

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

        case "catalog/read-file":
            let params = try request.decodeParams(as: ReadFileParams.self)
            return deckit.catalog.text(of: params.path, in: params.mod) as any Encodable & Sendable

        case "catalog/install-shipped":
            return try deckit.catalog.installShipped()

        case "catalog/install":
            let params = try request.decodeParams(as: InstallModParams.self)
            return try deckit.catalog.install(from: folder(params.from), dryRun: params.dryRun)

        case "catalog/remove":
            return try deckit.catalog.remove(request.decodeParams(as: RemoveModParams.self).id)

        case "storage/usage":
            return try deckit.usage(request.decodeParams(as: ModParams.self).mod)

        case "erasure/erase":
            try deck.erasure.erase(principal: request.decodeParams(as: ModParams.self).mod)
            return true

        case "erasure/uncleared":
            return deck.erasure.uncleared()

        case "erasure/cleared":
            try deck.erasure.cleared(principal: request.decodeParams(as: ModParams.self).mod)
            return true

        case "key/add":
            let principal = try request.decodeParams(as: PrincipalParams.self).principal
            try deck.keys.authorize(principal: principal, key: request.decodeParams(as: AuthorizedKey.self))
            return true

        case "key/remove":
            let params = try request.decodeParams(as: KeyParams.self)
            try deck.keys.revoke(principal: params.principal, scheme: params.scheme, key: data(params.key))
            return true

        case "key/list":
            return try deck.keys.keys(of: request.decodeParams(as: PrincipalParams.self).principal)

        case "user/add":
            let user = try request.decodeParams(as: User.self)
            try deckit.addUser(user.id, name: user.name)
            return true

        case "user/remove":
            return answered(try deckit.removeUser(request.decodeParams(as: UserParams.self).id), by: deckit)

        case "user/list":
            return try deckit.users.all()

        case "authentication/challenge":
            let params = try request.decodeParams(as: ChallengeParams.self)
            let challenge = try deck.authentication.challenge(
                transport: params.transport,
                nonce: data(params.nonce),
                binding: data(params.binding ?? "")
            )
            return ChallengeResult(
                challenge: challenge.base64EncodedString(),
                schemes: deck.authentication.schemes.map(\.rawValue)
            )

        case "authentication/verify":
            let params = try request.decodeParams(as: VerifyParams.self)
            let effects = try deckit.admit(
                transport: params.transport,
                principal: params.principal,
                scheme: params.scheme,
                key: data(params.key),
                signature: data(params.signature)
            )
            return answered(effects, by: deckit)

        case "authentication/close":
            deck.authentication.close(transport: try request.decodeParams(as: TransportParams.self).transport)
            return true

        case "runner/reconnect":
            return answered(try deckit.reconnect(), by: deckit)

        case "runner/start":
            return answered(try deckit.start(), by: deckit)

        case "runner/load":
            return answered(try deckit.load(request.decodeParams(as: ModsParams.self).mods), by: deckit)

        case "runner/launch":
            let params = try request.decodeParams(as: LaunchParams.self)
            return answered(try deckit.launch(params.mod, by: params.by), by: deckit)

        case "runner/unload":
            return answered(try deckit.unload(request.decodeParams(as: ModsParams.self).mods), by: deckit)

        case "runner/quit":
            let params = try request.decodeParams(as: LaunchParams.self)
            return answered(try deckit.quit(params.mod, by: params.by), by: deckit)

        case "runner/started":
            let params = try request.decodeParams(as: StartedParams.self)
            let effects = try deckit.started(params.mod, run: params.run, contributions: params.contributions)
            return answered(effects, by: deckit)

        case "runner/problem":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return answered(try deckit.report(params.mod, run: params.run, problem: params.problem), by: deckit)

        case "runner/not-started":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return answered(try deckit.notStarted(params.mod, run: params.run, problem: params.problem), by: deckit)

        case "runner/timed-out":
            let params = try request.decodeParams(as: RunParams.self)
            return answered(try deckit.timedOut(params.mod, run: params.run), by: deckit)

        case "runner/crash":
            let params = try request.decodeParams(as: RunProblemParams.self)
            return answered(try deckit.crashed(params.mod, run: params.run, problem: params.problem), by: deckit)

        case "runner/stopped":
            let params = try request.decodeParams(as: RunParams.self)
            return answered(try deckit.stopped(params.mod, run: params.run), by: deckit)

        case "connection/begin":
            let params = try request.decodeParams(as: LifecycleParams.self)
            return try deck.connections.begin(principal: params.mod, run: params.run, lifecycle: params.lifecycle)

        case "connection/end":
            let params = try request.decodeParams(as: LifecycleParams.self)
            return answered(try deckit.ended(params.mod, run: params.run, lifecycle: params.lifecycle), by: deckit)

        case "connection/reach":
            let params = try request.decodeParams(as: ReachParams.self)
            let effects = try deckit.reach(
                params.target,
                from: params.mod,
                run: params.run,
                lifecycle: params.lifecycle
            )
            return answered(effects, by: deckit)

        case "connection/release":
            let params = try request.decodeParams(as: ReachParams.self)
            let effects = try deckit.release(
                params.target,
                from: params.mod,
                run: params.run,
                lifecycle: params.lifecycle
            )
            return answered(effects, by: deckit)

        case "connection/refuse":
            deck.connections.refuse(try request.decodeParams(as: ConnectionParams.self).connection)
            return true

        case "connection/route":
            let params = try request.decodeParams(as: MessageParams.self)
            return try deck.connections.route(from: params.mod, run: params.run, connection: params.connection)

        case "event/listen":
            let params = try request.decodeParams(as: ListenParams.self)
            deck.events.listen(principal: params.mod, run: params.run, names: params.names)
            return true

        case "event/emit":
            let params = try request.decodeParams(as: EmitParams.self)
            return try deck.events.emit(principal: params.mod, run: params.run, name: params.name)

        case "interface/contributions":
            let params = try request.decodeParams(as: ContributionsParams.self)
            return try deckit.catalog.declarations(to: params.interface, for: params.mod)

        default:
            throw ResponseError(code: .methodNotFound, message: "no method \(request.method)")
        }
    }

    // The folder `path` names, refused as no mod where it is not an absolute path.
    private func folder(_ path: String) throws -> URL {
        guard path.hasPrefix("/") else { throw ModFolderError.notLoadable("\(path) is no absolute path") }

        return URL(filePath: path)
    }

    // The bytes `text` is in base64: none for text that is not, which is no nonce, no key and no signature.
    private func data(_ text: String) -> Data {
        Data(base64Encoded: text) ?? Data()
    }

    // `effects` as the driver reads them.
    private func answered(_ effects: [Effect], by deckit: Deckit) -> [EffectAnswer] {
        effects.map { effect in EffectAnswer(effect, of: deckit) }
    }
}
