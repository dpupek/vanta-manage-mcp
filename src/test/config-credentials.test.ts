import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadCredentials } from "../config.js";

const CREDENTIAL_ENV_KEYS = [
  "VANTA_ENV_FILE",
  "VANTA_CLIENT_ID",
  "VANTA_CLIENT_SECRET",
] as const;

const withCredentialEnv = async (
  env: Partial<Record<(typeof CREDENTIAL_ENV_KEYS)[number], string | undefined>>,
  run: () => Promise<void> | void,
): Promise<void> => {
  const previous: Partial<Record<(typeof CREDENTIAL_ENV_KEYS)[number], string | undefined>> =
    {};
  for (const key of CREDENTIAL_ENV_KEYS) {
    previous[key] = process.env[key];
  }

  try {
    for (const key of CREDENTIAL_ENV_KEYS) {
      const nextValue = env[key];
      if (nextValue === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = nextValue;
      }
    }
    await run();
  } finally {
    for (const key of CREDENTIAL_ENV_KEYS) {
      const restoreValue = previous[key];
      if (restoreValue === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = restoreValue;
      }
    }
  }
};

test("credentials prefer direct env vars over VANTA_ENV_FILE", async () => {
  // Arrange
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-cred-"));
  const jsonPath = path.join(tempRoot, "credentials.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({
      client_id: "file-client-id",
      client_secret: "file-client-secret",
    }),
    "utf8",
  );

  // Initial Assert
  assert.ok(fs.existsSync(jsonPath));

  // Act
  await withCredentialEnv(
    {
      VANTA_ENV_FILE: jsonPath,
      VANTA_CLIENT_ID: "env-client-id",
      VANTA_CLIENT_SECRET: "env-client-secret",
    },
    () => {
      const credentials = loadCredentials();

      // Assert
      assert.equal(credentials.client_id, "env-client-id");
      assert.equal(credentials.client_secret, "env-client-secret");
    },
  );
});

test("credentials load from dotenv VANTA_ENV_FILE", async () => {
  // Arrange
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-cred-"));
  const dotenvPath = path.join(tempRoot, "credentials.env");
  fs.writeFileSync(
    dotenvPath,
    [
      "# integration credentials",
      "VANTA_CLIENT_ID=dotenv-client-id",
      "VANTA_CLIENT_SECRET=dotenv-client-secret",
    ].join("\n"),
    "utf8",
  );

  // Initial Assert
  assert.ok(fs.existsSync(dotenvPath));

  // Act
  await withCredentialEnv(
    {
      VANTA_ENV_FILE: dotenvPath,
      VANTA_CLIENT_ID: undefined,
      VANTA_CLIENT_SECRET: undefined,
    },
    () => {
      const credentials = loadCredentials();

      // Assert
      assert.equal(credentials.client_id, "dotenv-client-id");
      assert.equal(credentials.client_secret, "dotenv-client-secret");
    },
  );
});

test("partial env vars fail fast with a clear credential error", async () => {
  // Arrange + Initial Assert + Act + Assert
  await withCredentialEnv(
    {
      VANTA_ENV_FILE: undefined,
      VANTA_CLIENT_ID: "partial-only-id",
      VANTA_CLIENT_SECRET: undefined,
    },
    () => {
      assert.throws(
        () => loadCredentials(),
        /VANTA_CLIENT_ID is set but VANTA_CLIENT_SECRET is missing/u,
      );
    },
  );
});

test("invalid JSON credential file reports supported formats", async () => {
  // Arrange
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vanta-cred-"));
  const malformedJsonPath = path.join(tempRoot, "credentials.json");
  fs.writeFileSync(malformedJsonPath, "{ invalid-json", "utf8");

  // Initial Assert
  assert.ok(fs.existsSync(malformedJsonPath));

  // Act + Assert
  await withCredentialEnv(
    {
      VANTA_ENV_FILE: malformedJsonPath,
      VANTA_CLIENT_ID: undefined,
      VANTA_CLIENT_SECRET: undefined,
    },
    () => {
      assert.throws(
        () => loadCredentials(),
        /Expected JSON with client_id\/client_secret or dotenv key\/value format/u,
      );
    },
  );
});
