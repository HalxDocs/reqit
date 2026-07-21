import type { models } from "../../../../wailsjs/go/models";
import type { HttpMethod } from "@/features/request/types/request";

export interface FolderNode {
  type: "folder";
  name: string;
  path: string;
  children: TreeNode[];
}

export interface RequestNode {
  type: "request";
  name: string;
  path: string;
  collID: string;
  req: models.SavedRequest;
  method: HttpMethod;
}

export type TreeNode = FolderNode | RequestNode;

export function buildFolderTree(requests: models.SavedRequest[], collID: string): TreeNode[] {
  const root: TreeNode[] = [];
  for (const req of requests) {
    const parts = req.name.split("/");
    let current = root;
    let path = "";
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      path = path ? `${path}/${folderName}` : folderName;
      let folder = current.find((n): n is FolderNode => n.type === "folder" && n.name === folderName);
      if (!folder) {
        folder = { type: "folder", name: folderName, path, children: [] };
        current.push(folder);
      }
      current = folder.children;
    }
    const leafName = parts[parts.length - 1] ?? req.name;
    const leafPath = path ? `${path}/${leafName}` : leafName;
    current.push({
      type: "request",
      name: leafName,
      path: leafPath,
      collID,
      req,
      method: (req.payload.method as HttpMethod) || "GET",
    });
  }
  return root;
}

export function countNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.type === "request") count++;
    else count += countNodes(n.children);
  }
  return count;
}
