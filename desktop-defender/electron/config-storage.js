const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const isPosix = process.platform !== "win32";

function secureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (isPosix) fs.chmodSync(directory, 0o700);
}

function readSecureConfig(filePath) {
  secureDirectory(path.dirname(filePath));
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Configuration file must be a regular file.");
  }
  if (isPosix) fs.chmodSync(filePath, 0o600);
  return fs.readFileSync(filePath, "utf8");
}

function writeSecureConfig(filePath, content) {
  const directory = path.dirname(filePath);
  secureDirectory(directory);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${crypto.randomBytes(8).toString("hex")}.tmp`
  );
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporaryPath, filePath);
    if (isPosix) fs.chmodSync(filePath, 0o600);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch {}
    throw error;
  }
}

module.exports = { readSecureConfig, writeSecureConfig };
