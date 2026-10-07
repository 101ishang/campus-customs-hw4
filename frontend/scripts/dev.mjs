import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const workspace = fileURLToPath(new URL("../../", import.meta.url));
const localPython = join(
  workspace,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const python = process.env.PYTHON ?? (existsSync(localPython) ? localPython : "python3");
const children = [];
let stopping = false;
let exitCode = 0;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
}

function launch(command, args, env = process.env, cwd = root) {
  const child = spawn(command, args, { cwd, env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error("Could not start a Campus Customs development service:", error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code ?? 1);
    if (children.every((runningChild) => runningChild.exitCode !== null)) process.exit(exitCode);
  });
  return child;
}

function withoutPortkeyConfig(source) {
  const env = { ...source };
  for (const name of Object.keys(env)) {
    if (name.startsWith("PORTKEY_")) delete env[name];
  }
  return env;
}

const authServer = launch(python, ["backend/auth_server.py"], withoutPortkeyConfig(process.env), workspace);
const chatServer = launch(python, [
  "-m",
  "uvicorn",
  "main:app",
  "--host",
  "127.0.0.1",
  "--port",
  process.env.CHAT_API_PORT ?? "8000",
], process.env, join(workspace, "backend"));

function startViteWhenApiIsReady() {
  if (stopping || authServer.exitCode !== null || chatServer.exitCode !== null) return;
  const socket = createConnection({ host: "127.0.0.1", port: Number(process.env.AUTH_PORT ?? 8001) });
  socket.once("connect", () => {
    socket.destroy();
    if (!stopping) {
      launch(
        process.execPath,
        ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
        withoutPortkeyConfig(process.env),
      );
    }
  });
  socket.once("error", () => {
    socket.destroy();
    if (stopping || authServer.exitCode !== null || chatServer.exitCode !== null) return;
    const retry = setTimeout(startViteWhenApiIsReady, 75);
    retry.unref();
  });
}

startViteWhenApiIsReady();
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
