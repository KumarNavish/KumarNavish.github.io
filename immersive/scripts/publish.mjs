/** Publish the verified replacement through the repository's existing Pages target. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
const reportDirectory =
  process.env.QA_OUT || path.join(tmpdir(), "navish-publish-qa");
if (process.env.CI) {
  await run("npx", ["playwright", "install", "--with-deps", "chromium"]);
  const preview = spawn("npm", ["run", "preview"], {
    cwd: root,
    stdio: "inherit",
  });
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        ready = (await fetch("http://127.0.0.1:4187/release.json")).ok;
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (!ready) throw new Error("Production preview did not become ready.");
    await run("npm", ["run", "qa"], { QA_OUT: reportDirectory });
  } finally {
    preview.kill("SIGTERM");
  }
}
const release = JSON.parse(
  await fs.readFile(path.join(root, "dist/release.json"), "utf8"),
);
if (process.env.GITHUB_SHA && release.commit !== process.env.GITHUB_SHA)
  throw new Error("Build commit does not match the CI source.");
const destination = path.resolve(root, "../site/dist");
// Preserve existing auxiliary demonstrations without letting the former root overwrite the replacement.
for (const item of ["artifacts", "bis-continual-process-automation-demo"]) {
  try {
    await fs.cp(path.join(destination, item), path.join(root, "dist", item), {
      recursive: true,
      force: false,
      errorOnExist: false,
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
await fs.cp(path.join(root, "dist"), destination, {
  recursive: true,
  force: true,
});
console.log(
  `Published Three.js release ${release.commit} into the existing GitHub Pages artifact directory.`,
);
