export default async function handler(req: any, res: any) {
  const { username } = req.query;
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "reqit-agent-lens",
  };

  // Use GITHUB_TOKEN if set (5000 req/hour vs 60 unauthenticated)
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const r = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`,
      { headers }
    );

    if (r.status === 403 || r.status === 429) {
      // Rate limited — return empty array so UI shows "no recent activity" instead of spinner
      return res.status(200).json([]);
    }

    if (!r.ok) {
      return res.status(r.status).json({ error: `GitHub API ${r.status}` });
    }

    const events = await r.json();

    // Extract PushEvents into a flat commit list
    const pushEvents = (events || [])
      .filter((e: any) => e.type === "PushEvent")
      .slice(0, 5);

    const commits: any[] = [];
    for (const event of pushEvents) {
      const repo = event.repo?.name || "";
      for (const c of (event.payload?.commits || []).slice(0, 2)) {
        commits.push({
          sha: c.sha?.substring(0, 7) || "",
          message: c.message || "",
          date: event.created_at || "",
          repo,
        });
      }
      if (commits.length >= 5) break;
    }

    return res.status(200).json(commits);
  } catch {
    return res.status(200).json([]);
  }
}
