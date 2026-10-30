//
//  CookieKeeper.swift
//  DeckitWeb
//
//  Created by JSilver on 10/30/26.
//

import WebKit

// A data store's cookies a site set to last the session, given `lifetime` instead: deckit's pages live as long as the
// app, so a session would end only as it quits.
@MainActor
final class CookieKeeper: NSObject, WKHTTPCookieStoreObserver {
    // MARK: - Property
    private let store: WKHTTPCookieStore
    private let lifetime: TimeInterval

    // MARK: - Initializer
    init(store: WKHTTPCookieStore, lifetime: TimeInterval) {
        self.store = store
        self.lifetime = lifetime
        super.init()
        store.add(self)
    }

    // MARK: - Lifecycle
    nonisolated func cookiesDidChange(in cookieStore: WKHTTPCookieStore) {
        MainActor.assumeIsolated {
            keep()
        }
    }

    // MARK: - Public
    // MARK: - Private
    // A cookie set again with an end is no longer one of the session's, so this ends.
    private func keep() {
        let lifetime = lifetime
        let store = store
        store.getAllCookies { cookies in
            MainActor.assumeIsolated {
                for cookie in cookies where cookie.isSessionOnly {
                    var properties = cookie.properties ?? [:]
                    properties[.expires] = Date(timeIntervalSinceNow: lifetime)
                    properties[.discard] = nil
                    guard let kept = HTTPCookie(properties: properties) else { continue }
                    store.setCookie(kept)
                }
            }
        }
    }
}
