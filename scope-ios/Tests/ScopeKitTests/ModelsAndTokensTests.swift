import XCTest
@testable import ScopeKit

final class ModelsAndTokensTests: XCTestCase {
    func testAuthPayloadAcceptsMultipleKeyStyles() throws {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        let camelCase = #"""
        {
          "id": "u-1",
          "username": "louisdo",
          "email": "louis@example.com",
          "displayName": "Louis Do",
          "accessToken": "access",
          "refreshToken": "refresh"
        }
        """#.data(using: .utf8)!
        let decoded = try decoder.decode(AuthPayload.self, from: camelCase)
        XCTAssertEqual(decoded.id, "u-1")
        XCTAssertEqual(decoded.accessToken, "access")

        let snakeCase = #"""
        {
          "user_id": "u-2",
          "username": "v",
          "email": "v@example.com",
          "access": "a2",
          "refresh": "r2"
        }
        """#.data(using: .utf8)!
        let decodedSnake = try decoder.decode(AuthPayload.self, from: snakeCase)
        XCTAssertEqual(decodedSnake.id, "u-2")
        XCTAssertEqual(decodedSnake.accessToken, "a2")
        XCTAssertEqual(decodedSnake.refreshToken, "r2")
    }

    func testSpotCategoryRoundTrip() throws {
        for category in SpotCategory.allCases {
            let json = "\"\(category.rawValue)\"".data(using: .utf8)!
            let decoded = try JSONDecoder().decode(SpotCategory.self, from: json)
            XCTAssertEqual(decoded, category)
        }
    }

    func testTokensExpiryLogic() {
        let past = ScopeTokens(accessToken: "a", refreshToken: "r", expiresAt: Date().addingTimeInterval(-60))
        XCTAssertTrue(past.isExpired)

        let future = ScopeTokens(accessToken: "a", refreshToken: "r", expiresAt: Date().addingTimeInterval(3600))
        XCTAssertFalse(future.isExpired)

        let none = ScopeTokens(accessToken: "a", refreshToken: "r")
        XCTAssertFalse(none.isExpired)
    }

    func testInMemoryTokenStoreRoundTrip() async {
        let store = InMemoryTokenStore()
        let sample = ScopeTokens(accessToken: "x", refreshToken: "y")
        await store.save(sample)
        let loaded = await store.load()
        XCTAssertEqual(loaded, sample)
        await store.clear()
        let cleared = await store.load()
        XCTAssertNil(cleared)
    }

    func testEnvironmentResolvesEnvVars() {
        setenv("SCOPE_CORE_BASE_URL", "https://core.test", 1)
        setenv("SCOPE_CONTENT_BASE_URL", "https://content.test", 1)
        setenv("SCOPE_INTEL_BASE_URL", "https://intel.test", 1)
        defer {
            unsetenv("SCOPE_CORE_BASE_URL")
            unsetenv("SCOPE_CONTENT_BASE_URL")
            unsetenv("SCOPE_INTEL_BASE_URL")
        }
        let env = ScopeEnvironment.resolve()
        XCTAssertEqual(env.coreBaseURL.absoluteString, "https://core.test")
        XCTAssertEqual(env.contentBaseURL.absoluteString, "https://content.test")
        XCTAssertEqual(env.intelBaseURL.absoluteString, "https://intel.test")
    }
}
