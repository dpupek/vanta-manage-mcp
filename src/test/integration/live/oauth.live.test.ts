import assert from "node:assert/strict";
import test from "node:test";
import { getTokenManager } from "../../../auth.js";
import { VantaApiClient } from "../../../client/vanta-client.js";
import { guardLiveTest, readLiveIntegrationEnv } from "../shared/env.js";

const liveEnv = readLiveIntegrationEnv();

test(
  "oauth token cache is stable for repeated and concurrent reads",
  { timeout: liveEnv.timeoutMs },
  async t => {
    // Arrange
    if (!guardLiveTest(t, liveEnv, false)) {
      return;
    }
    const tokenManager = getTokenManager();

    // Initial Assert
    const tokenOne = await tokenManager.getValidToken();
    assert.ok(tokenOne.length > 0);

    // Act
    const tokenTwo = await tokenManager.getValidToken();
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () => tokenManager.getValidToken()),
    );

    // Assert
    assert.equal(tokenTwo, tokenOne);
    assert.ok(concurrent.every(token => token === tokenOne));
  },
);

test(
  "oauth forced refresh keeps API reads stable",
  { timeout: liveEnv.timeoutMs },
  async t => {
    // Arrange
    if (!guardLiveTest(t, liveEnv, false)) {
      return;
    }
    const tokenManager = getTokenManager();
    const client = new VantaApiClient();

    // Initial Assert
    const baselineToken = await tokenManager.getValidToken();
    assert.ok(baselineToken.length > 0);

    // Act
    const refreshedToken = await tokenManager.refreshToken();
    const response = await client.request({
      method: "get",
      path: "/controls",
      query: { pageSize: 1 },
    });

    // Assert
    assert.ok(refreshedToken.length > 0);
    assert.equal(response.ok, true);
    assert.equal(response.status, 200);
  },
);
