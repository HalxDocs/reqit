import { describe, it, expect } from "vitest";
import { buildFolderTree, type TreeNode } from "./folderTree";

const req = (name: string, method = "GET") =>
  ({ id: name, name, payload: { method } }) as any;

function leaves(nodes: TreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "request") out.push(n.name);
    else leaves(n.children, out);
  }
  return out;
}

function folders(nodes: TreeNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "folder") {
      out.push(n.name);
      folders(n.children, out);
    }
  }
  return out;
}

describe("buildFolderTree", () => {
  it("splits slash-delimited names into folders", () => {
    const tree = buildFolderTree([req("auth/login"), req("auth/logout")], "c1");
    expect(folders(tree)).toEqual(["auth"]);
    expect(leaves(tree).sort()).toEqual(["login", "logout"]);
  });

  it("keeps URL-like names flat (no http: folders)", () => {
    const tree = buildFolderTree([req("http://localhost:8090/api/users")], "c1");
    expect(folders(tree)).toEqual([]);
    expect(leaves(tree)).toEqual(["http://localhost:8090/api/users"]);
  });

  it("keeps https names flat", () => {
    const tree = buildFolderTree([req("https://api.example.com/v1/pets/42")], "c1");
    expect(folders(tree)).toEqual([]);
  });

  it("skips empty segments instead of rendering blank folders", () => {
    const tree = buildFolderTree([req("a//b")], "c1");
    expect(folders(tree)).toEqual(["a"]);
    expect(leaves(tree)).toEqual(["b"]);
  });

  it("handles trailing slash without a blank leaf", () => {
    const tree = buildFolderTree([req("a/b/")], "c1");
    expect(folders(tree)).toEqual(["a"]);
    expect(leaves(tree)).toEqual(["b"]);
  });
});
