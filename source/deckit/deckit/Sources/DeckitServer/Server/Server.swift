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
    private func answer(_ request: Request) -> Response? {
        let outcome: Result<any Encodable & Sendable, ResponseError>
        do {
            outcome = .success(try result(of: Call(method: request.method, params: request.params ?? .null)))
        } catch let error as ResponseError {
            outcome = .failure(error)
        } catch let error as any CallError {
            outcome = .failure(ResponseError(code: .requestFailed, message: error.message, kind: error.kind))
        } catch is DecodingError {
            outcome = .failure(ResponseError(code: .invalidParams, message: "\(request.method) has no such params"))
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

    private func result(of call: Call) throws -> any Encodable & Sendable {
        if call.method == "initialize" {
            guard deckit == nil else {
                throw ResponseError(code: .invalidRequest, message: "the core is initialized once")
            }

            let params = try call.params.decode(as: InitializeParams.self)
            deckit = try Deckit(
                home: URL(filePath: params.home, directoryHint: .isDirectory),
                ship: params.ship.map { folder in URL(filePath: folder) },
                sources: params.sources.map { folder in URL(filePath: folder) },
                api: params.api,
                permissions: params.permissions
            )
            return JSONValue.object([:])
        }

        guard let deckit else {
            throw ResponseError(code: .serverNotInitialized, message: "\(call.method) before initialize")
        }
        guard let result = try deckit.answer(call) else {
            throw ResponseError(code: .methodNotFound, message: "no method \(call.method)")
        }

        return result
    }
}
