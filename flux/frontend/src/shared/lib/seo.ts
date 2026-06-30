const SITE = "https://reqit.dev";
const NAME = "reqit";
const DEFAULT_IMAGE = `${SITE}/reqiticon.jpeg`;

interface SEOData {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: string;
  keywords?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
}

const PAGES: Record<string, SEOData> = {
  home: {
    title: "reqit — Local-First API Client | No Account, No Cloud, No Electron",
    description: "Free, open-source API client. HTTP, WebSocket, GraphQL, gRPC, Socket.IO, MQTT, SOAP — all in one <20MB binary. Collections as plain JSON files you commit to Git. No account required. No telemetry. Starts in under 400ms.",
    path: "/",
    keywords: "API client, REST client, Postman alternative, GraphQL client, gRPC client, WebSocket client, Socket.IO, MQTT, SOAP, open source, local-first, Git-native, API testing, mock server, collection runner, OpenAPI, no account, free API tool",
  },
  docs: {
    title: "Documentation — reqit API Client",
    description: "Official documentation for reqit. Learn how to import collections, configure environments, write assertions, generate CI/CD pipelines, and use every protocol — HTTP, WebSocket, GraphQL, gRPC, SOAP, MQTT, Socket.IO.",
    path: "/documentation",
    keywords: "reqit documentation, API client guide, REST client tutorial, GraphQL client setup, gRPC client docs",
  },
  blog: {
    title: "Blog — reqit API Client",
    description: "Articles, tutorials, and deep dives on API testing, collection management, Git workflows, protocol support, and developer productivity with reqit.",
    path: "/blog",
    type: "website",
    keywords: "API testing blog, REST client articles, developer productivity, API development",
  },
};

export function getSEO(page: string, slug?: string): SEOData {
  if (page === "blog" && slug) {
    return {
      title: `${slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — reqit Blog`,
      description: `Read about ${slug.replace(/-/g, " ")} on the reqit blog. Practical guides for API testing, collection management, and developer workflows.`,
      path: `/blog/${slug}`,
      type: "article",
    };
  }
  if (page === "profile" && slug) {
    return {
      title: `${slug} — reqit Dev Profile`,
      description: `${slug}'s developer profile on reqit. Skills, projects, API stats, and GitHub activity.`,
      path: `/${slug}`,
      type: "profile",
    };
  }
  return PAGES[page] || PAGES.home;
}

export function applySEO(data: SEOData): void {
  document.title = data.title;

  const url = `${SITE}${data.path}`;
  const image = data.image || DEFAULT_IMAGE;

  setMeta("name", "description", data.description);
  setMeta("name", "keywords", data.keywords || "");
  setMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  setMeta("name", "theme-color", "#0a0a0f");

  setMeta("property", "og:type", data.type || "website");
  setMeta("property", "og:url", url);
  setMeta("property", "og:title", data.title);
  setMeta("property", "og:description", data.description);
  setMeta("property", "og:image", image);
  setMeta("property", "og:image:alt", `${NAME} — Local-first API client`);
  setMeta("property", "og:site_name", NAME);
  setMeta("property", "og:locale", "en_US");

  setMeta("name", "twitter:card", "summary_large_image");
  setMeta("name", "twitter:url", url);
  setMeta("name", "twitter:title", data.title);
  setMeta("name", "twitter:description", data.description);
  setMeta("name", "twitter:image", image);

  setLink("canonical", url);

  if (data.publishedTime) setMeta("property", "article:published_time", data.publishedTime);
  if (data.modifiedTime) setMeta("property", "article:modified_time", data.modifiedTime);
  if (data.author) setMeta("name", "author", data.author);
}

function setMeta(attr: string, key: string, content: string): void {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string): void {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}
