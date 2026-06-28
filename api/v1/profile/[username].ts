export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { username } = req.query;
  if (!username || typeof username !== "string") {
    return res.status(400).json({
      error: "username required",
      usage: {
        profile: "GET /api/v1/profile/{username}",
        example: "https://reqit.pxxl.dev/api/v1/profile/johndoe",
      },
      fields: ["username", "displayName", "bio", "avatarUrl", "skills", "projects", "userProjects", "stats", "githubUsername", "socialLinks", "badges"],
      integrations: {
        react: "const { data } = await fetch('/api/v1/profile/yourname').then(r => r.json())",
        nextjs: "export async function getServerSideProps() { const res = await fetch('https://reqit.pxxl.dev/api/v1/profile/yourname'); return { props: { profile: await res.json() } } }",
      },
    });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(500).json({ error: "Upstash not configured" });

  try {
    const r = await fetch(`${url}/get/profile:${username}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.status(500).json({ error: "Failed to fetch profile" });

    const data = await r.json();
    if (!data.result) return res.status(404).json({ error: "Profile not found" });

    const profile = JSON.parse(data.result);

    // Optionally include GitHub activity
    let githubActivity: any[] = [];
    const ghToken = process.env.GITHUB_TOKEN;
    if (profile.githubUsername && ghToken) {
      try {
        const ghRes = await fetch(
          `https://api.github.com/users/${encodeURIComponent(profile.githubUsername)}/events/public?per_page=15`,
          { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${ghToken}`, "User-Agent": "reqit-api" } }
        );
        if (ghRes.ok) {
          const events = await ghRes.json();
          for (const event of (events || []).filter((e: any) => e.type === "PushEvent").slice(0, 5)) {
            const repo = event.repo?.name || "";
            for (const c of (event.payload?.commits || []).slice(0, 2)) {
              githubActivity.push({ sha: c.sha?.substring(0, 7) || "", message: c.message || "", date: event.created_at || "", repo });
            }
            if (githubActivity.length >= 5) break;
          }
        }
      } catch { /* ignore */ }
    }

    return res.status(200).json({
      ok: true,
      data: {
        ...profile,
        githubActivity: profile.githubUsername ? githubActivity : undefined,
      },
      meta: {
        username: profile.username,
        displayName: profile.displayName || profile.username,
        updatedAt: profile.updatedAt,
        apiVersion: "v1",
        githubIntegrated: !!profile.githubUsername,
        projectCount: (profile.userProjects?.length || 0) + (profile.projects?.length || 0),
      },
    });
  } catch {
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
