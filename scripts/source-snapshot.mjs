import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ownedPath } from "./canonical-input.mjs";

export function gitBytes(repository, arguments_) {
  return execFileSync("git", ["-C", repository, ...arguments_], {
    maxBuffer: 8 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "pipe"],
  });
}

export async function snapshotFixture(repositoryRoot, selection, directory, destination) {
  if (typeof selection?.revision !== "string" || !/^[a-f0-9]{40}$/u.test(selection.revision)) {
    throw new Error("Fixture input requires a complete immutable Git revision");
  }
  const repository = resolve(repositoryRoot, selection.root);
  ownedPath(repository, directory);
  const tree = gitBytes(repository, ["ls-tree", "-r", "-z", `${selection.revision}:${directory}`]);
  const entries = tree.toString("utf8").split("\0").filter(Boolean);
  if (entries.length === 0) throw new Error("Selected fixture contains no files");
  for (const entry of entries) {
    const separator = entry.indexOf("\t");
    const [mode, kind, object] = entry.slice(0, separator).split(" ");
    if (kind !== "blob" || !["100644", "100755"].includes(mode)) {
      throw new Error("Fixture snapshots accept regular Git blobs only");
    }
    const path = ownedPath(destination, entry.slice(separator + 1));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, gitBytes(repository, ["cat-file", "blob", object]), { flag: "wx" });
  }
  return { repository, revision: selection.revision, directory, fileCount: entries.length };
}
