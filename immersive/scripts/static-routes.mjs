import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
const origin = "https://kumarnavish.github.io";
await build({
  entryPoints: ["src/ssr.tsx"],
  outfile: ".ssr/render.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  loader: { ".css": "empty" },
});
const { render, metadata, cleanPath, ALIASES, EXHIBITS } = await import(
  "../.ssr/render.mjs"
);
const template = await fs.readFile("dist/index.html", "utf8");
const routes = [
  ...new Set([
    "/",
    "/trajectory",
    "/work",
    "/research",
    "/systems",
    "/frontier",
    "/about",
    ...EXHIBITS.map((e) => e.work.route),
    ...Object.keys(ALIASES),
  ]),
];
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
let sha = process.env.GITHUB_SHA;
try {
  sha ||= execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
} catch {
  sha = "local-preview";
}
const records = [];
for (const route of routes) {
  const canonical = cleanPath(route),
    info = metadata(canonical),
    url = origin + (canonical === "/" ? "/" : canonical + "/");
  const entity = EXHIBITS.find((e) => e.work.route === canonical);
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: info.title,
    description: info.description,
    url,
    about: {
      "@type": "Person",
      name: "Navish Kumar",
      url: origin + "/",
      sameAs: [
        "https://github.com/KumarNavish",
        "https://dmi.unibas.ch/de/personen/navish-kumar/",
      ],
    },
  };
  const head = `<title>${escape(info.title)}</title><meta name="description" content="${escape(info.description)}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:title" content="${escape(info.title)}"><meta property="og:description" content="${escape(info.description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${origin}/social-card.png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(info.title)}"><meta name="twitter:description" content="${escape(info.description)}"><meta name="twitter:image" content="${origin}/social-card.png"><meta name="release-commit" content="${sha}"><script type="application/ld+json">${JSON.stringify(structured).replaceAll("<", "\u003c")}</script>`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(
      /<meta\b[^>]*(?:name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g,
      "",
    )
    .replace(/<link rel="canonical"[^>]*>/g, "");
  html = html
    .replace("</head>", head + "</head>")
    .replace(
      '<div id="root"></div>',
      `<div id="root">${await render(canonical)}</div>`,
    );
  const directory = route === "/" ? "dist" : path.join("dist", route);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "index.html"), html);
  records.push({
    route,
    canonical,
    url,
    title: info.title,
    workId: entity?.work.id ?? null,
  });
}
await fs.writeFile(
  "dist/404.html",
  template.replace(
    '<div id="root"></div>',
    `<div id="root">${await render("/missing-page")}</div>`,
  ),
);
await fs.writeFile("dist/.nojekyll", "");
await fs.writeFile(
  "dist/robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
await fs.writeFile(
  "dist/sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${records
    .filter((r) => r.route === r.canonical)
    .map((r) => `<url><loc>${r.url}</loc></url>`)
    .join("")}</urlset>`,
);
await fs.writeFile(
  "dist/release.json",
  JSON.stringify(
    {
      release: "immersive-webgl-20260909",
      commit: sha,
      builtAt: new Date().toISOString(),
      renderer: "Three.js WebGL2",
      routes: records,
    },
    null,
    2,
  ),
);
console.log(
  `Materialized ${records.length} route documents at ${origin}; release ${sha}.`,
);
await fs.rm(".ssr", { recursive: true, force: true });
