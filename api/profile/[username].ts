export default async function handler(req: any, res: any) {
  const { username } = req.query;
  if (!username || typeof username !== "string") {
    return res.status(400).json({ error: "username required" });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return res.status(500).json({ error: "Upstash not configured" });
  }

  try {
    const r = await fetch(`${url}/get/profile:${username}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) return res.status(500).json({ error: "Failed to fetch profile" });

    const data = await r.json();
    if (!data.result) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.status(200).json(JSON.parse(data.result));
  } catch {
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
