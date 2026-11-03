const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { readSecureConfig, writeSecureConfig } = require("./config-storage");

test("configuration writes are atomic and owner-only on POSIX", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-defender-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "config.json");
  fs.chmodSync(directory, 0o755);

  writeSecureConfig(configPath, '{"agentToken":"test"}');
  assert.equal(readSecureConfig(configPath), '{"agentToken":"test"}');
  assert.deepEqual(
    fs.readdirSync(directory),
    ["config.json"]
  );
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(directory).mode & 0o777, 0o700);
    assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
  }
});

test("reading an existing loose-permission config tightens its mode", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "desktop-defender-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, "config.json");
  fs.writeFileSync(configPath, "{}");

  assert.equal(readSecureConfig(configPath), "{}");
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(configPath).mode & 0o777, 0o600);
  }
});
