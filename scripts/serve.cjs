const { spawn } = require("node:child_process");

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") throw new Error("Expected dev or start");
let hostname = "127.0.0.1";
let hostSpecified = false;
const forwarded = [];
const args = process.argv.slice(3);
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--hostname" || arg === "-H") {
    if (hostSpecified) throw new Error("Specify hostname only once");
    hostSpecified = true;
    hostname = args[++i];
    if (!hostname || hostname.startsWith("-")) throw new Error("Hostname is required");
  } else if (arg.startsWith("--hostname=")) {
    if (hostSpecified) throw new Error("Specify hostname only once");
    hostSpecified = true;
    hostname = arg.slice("--hostname=".length);
    if (!hostname) throw new Error("Hostname is required");
  } else if (arg === "--port" || arg === "-p") {
    const port = args[++i];
    if (!port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Port must be from 1 to 65535");
    forwarded.push("--port", port);
  } else if (arg.startsWith("--port=")) {
    const port = arg.slice("--port=".length);
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error("Port must be from 1 to 65535");
    forwarded.push("--port", port);
  } else if (mode === "dev" && ["--turbopack", "--turbo", "--webpack"].includes(arg)) {
    forwarded.push(arg);
  } else {
    throw new Error(`Unsupported server option: ${arg}`);
  }
}
// Explicit IP binding prevents remote clients from spoofing localhost headers.
const local = hostname === "127.0.0.1" || hostname === "::1";
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, ...forwarded, "--hostname", hostname], {
  stdio: "inherit",
  env: { ...process.env, __BOUNTYMESH_LOOPBACK_BOUND: local ? "1" : "0" },
});
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
