import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const input = argument("--input");
const output = argument("--output");
const stylesheet = argument("--css");
const nodeModules = process.env.MARKDOWN_PDF_NODE_MODULES;
const browserPath = process.env.MARKDOWN_PDF_BROWSER;

if (!input || !output || !stylesheet || !nodeModules || !browserPath) {
  throw new Error(
    "Required: --input, --output, --css, MARKDOWN_PDF_NODE_MODULES, and MARKDOWN_PDF_BROWSER",
  );
}

const markedUrl = pathToFileURL(
  path.join(nodeModules, "marked", "lib", "marked.esm.js"),
).href;
const { marked } = await import(markedUrl);
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(nodeModules, "playwright"));

const sourcePath = path.resolve(input);
const outputPath = path.resolve(output);
const css = fs.readFileSync(path.resolve(stylesheet), "utf8");
const markdown = fs.readFileSync(sourcePath, "utf8");
const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
const title = firstHeading || path.basename(sourcePath, path.extname(sourcePath));

marked.setOptions({
  gfm: true,
  breaks: false,
});

let body = await marked.parse(markdown);

// Use the parsed HTML for both freshness checks and rendering, so Markdown
// images, reference-style images and inline <img> tags have the same inputs.
const localImages = [];
for (const match of body.matchAll(/<img\b[^>]*?\bsrc=(['"])([^'"]+)\1/gi)) {
  const source = match[2];
  if (/^(?:data:|https?:|\/\/)/i.test(source)) continue;
  localImages.push(source.startsWith("file:")
    ? fileURLToPath(source) : path.resolve(path.dirname(sourcePath), source));
}
if (process.argv.includes("--check-stale")) {
  const dependencies = [sourcePath, fileURLToPath(import.meta.url), path.resolve(stylesheet), ...localImages];
  // A missing referenced image is an error, not grounds for using an old PDF.
  const modified = dependencies.map(file => fs.statSync(file).mtimeMs);
  const stale = !fs.existsSync(outputPath) || modified.some(time => time > fs.statSync(outputPath).mtimeMs);
  console.log(stale ? "stale" : "current");
  process.exit(0);
}

// setContent starts on about:blank: Chromium can reject file:// images even
// with a local <base>. Embed only referenced local image bytes, preserving
// remote/data URLs and keeping the Markdown/source image files untouched.
// This also makes nested photo-bearing SVG annotations printable.
body = body.replace(/(<img\b[^>]*?\bsrc=)(['"])([^'"]+)\2/gi,
  (match, prefix, quote, source) => {
    if (/^(?:data:|https?:|\/\/)/i.test(source)) return match;
    const imagePath = source.startsWith("file:")
      ? fileURLToPath(source)
      : path.resolve(path.dirname(sourcePath), source);
    const mime = {".svg":"image/svg+xml", ".png":"image/png", ".jpg":"image/jpeg",
      ".jpeg":"image/jpeg", ".webp":"image/webp", ".gif":"image/gif"}[path.extname(imagePath).toLowerCase()];
    if (!mime) throw new Error(`Unsupported local image type: ${source}`);
    const bytes = fs.readFileSync(imagePath);
    return `${prefix}${quote}data:${mime};base64,${bytes.toString("base64")}${quote}`;
  });

// Each generated PDF mirrors the Markdown directory tree. Resolve links from
// the output document's directory so the PDF annotations point to generated
// PDFs rather than to nonexistent PDFs beside the Markdown sources.
body = body.replace(
  /href=(['"])([^'"?#]+)\.md(#[^'"]*)?\1/gi,
  (_match, quote, target, anchor = "") => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
      return `href=${quote}${target}.pdf${anchor}${quote}`;
    }
    const targetMarkdown = path.resolve(path.dirname(sourcePath), `${target}.md`);
    let owner = path.dirname(targetMarkdown);
    while (path.dirname(owner) !== owner &&
           !(fs.existsSync(path.join(owner, 'AGENTS.md')) &&
             fs.existsSync(path.join(owner, 'tools/build-docs.ps1')))) {
      owner = path.dirname(owner);
    }
    const targetPdf = fs.existsSync(path.join(owner, 'tools/build-docs.ps1'))
      ? path.join(owner, 'output/pdf', path.relative(owner, targetMarkdown).replace(/\.md$/, '.pdf'))
      : path.resolve(path.dirname(outputPath), `${target}.pdf`);
    const relativeMarkdown = path.relative(owner, targetMarkdown).replaceAll('\\', '/');
    const canonical = relativeMarkdown === 'README.md' || relativeMarkdown.startsWith('docs/');
    const resolvedTarget = canonical || fs.existsSync(targetPdf) ? targetPdf : targetMarkdown;
    return `href=${quote}${pathToFileURL(resolvedTarget).href}${anchor}${quote}`;
  },
);

const baseUrl = `${pathToFileURL(path.dirname(sourcePath)).href.replace(/\/$/, "")}/`;
const sourceLabel = path.relative(process.cwd(), sourcePath).replaceAll("\\", "/");
const generated = new Date().toISOString().replace("T", " ").replace(/:\d\d\.\d\d\dZ$/, " UTC");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${baseUrl}">
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <header class="document-banner">
    <span class="document-source">${escapeHtml(sourceLabel)}</span>
    <span class="document-generated">Generated ${escapeHtml(generated)}</span>
  </header>
  <main>${body}</main>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }
    }
  });

  const missingImages = await page.evaluate(() =>
    Array.from(document.images)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute("src")),
  );
  if (missingImages.length) {
    throw new Error(`Images failed to load: ${missingImages.join(", ")}`);
  }

  await page.pdf({
    path: outputPath,
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `
      <div style="box-sizing:border-box;width:100%;padding:0 0.62in;color:#667085;font:8px 'Segoe UI',Arial,sans-serif;display:flex;justify-content:space-between;">
        <span>${escapeHtml(title)}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`,
    margin: {
      top: "0.62in",
      right: "0.62in",
      bottom: "0.72in",
      left: "0.62in",
    },
  });
} finally {
  await browser.close();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
