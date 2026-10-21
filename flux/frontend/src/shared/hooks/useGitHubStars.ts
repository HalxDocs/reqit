import { useEffect, useRef, useState } from "react";

/**
 * Poll a GitHub repository's star count.
 *
 * Shared by the desktop home screen and the web landing page, which each had
 * their own copy.
 */
export function useGitHubStars(repo: string): number | null {
  const [stars, setStars] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchStars = async () => {
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { stargazers_count: number };
        if (!cancelled) setStars(data.stargazers_count);
      } catch {
        // Network unavailable — keep showing whatever we have.
      }
    };

    void fetchStars();
    timerRef.current = setInterval(() => void fetchStars(), 60_000);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [repo]);

  return stars;
}

/** Format a star count for display, e.g. 1200 -> "1.2k". */
export function fmtStars(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
