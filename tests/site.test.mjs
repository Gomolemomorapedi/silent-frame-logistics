import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { Script } from "node:vm";
import test from "node:test";

const pages = [
  "index.html",
  "business.html",
  "how-it-works.html",
  "vehicles.html",
  "terms.html",
  "privacy.html"
];

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const cleanMarkup = (html) => html.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (_all, attrs) => `<script${attrs}></script>`);

test("all public pages have a language, title and viewport", () => {
  for (const file of pages) {
    const html = read(file);
    assert.match(html, /<!doctype html>/i, file);
    assert.match(html, /<html[^>]+lang="en-ZA"/i, file);
    assert.match(html, /<title>[^<]+<\/title>/i, file);
    assert.match(html, /name="viewport"/i, file);
  }
});

test("local links, scripts and page anchors resolve", () => {
  for (const file of pages) {
    const html = read(file);
    const markup = cleanMarkup(html);
    const ids = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
    for (const match of markup.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const value = match[1];
      if (/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value)) continue;
      const [pathPart, hashPart] = value.split("#", 2);
      const localPath = pathPart.replace(/^\.\//, "");
      if (pathPart) assert.ok(existsSync(new URL(`../${localPath}`, import.meta.url)), `${file} links to missing ${localPath}`);
      if (hashPart) {
        const targetHtml = pathPart ? read(localPath) : html;
        const targetMarkup = cleanMarkup(targetHtml);
        const targetIds = new Set([...targetMarkup.matchAll(/\bid="([^"]+)"/g)].map((item) => item[1]));
        assert.ok(targetIds.has(hashPart), `${file} has missing #${hashPart} in ${localPath || file}`);
      }
    }
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc=/i.test(script[1]) || !script[2].trim()) continue;
      assert.doesNotThrow(() => new Script(script[2], { filename: file }), `${file} inline JavaScript parses`);
    }
  }
});

test("transport request explains preview behavior and gathers the core quote details", () => {
  const html = read("index.html");
  for (const phrase of [
    'id="startTransportRequest"',
    'id="requestDetails"',
    'name="requestQuantity"',
    'name="vehicleType"',
    'name="bookingDays"',
    'name="loadDimensions"',
    'name="collectionArea"',
    'name="destination"',
    'name="preferredDate"',
    'name="stops"',
    'id="contactEmail"',
    'href="./privacy.html"',
    'href="./terms.html"',
    "No booking or price is confirmed",
    "does not send or store it"
  ]) assert.ok(html.includes(phrase), `index.html includes ${phrase}`);
});

test("shared enquiry flow stays server-side and config contains no payment credentials", () => {
  const backend = read("backend.js");
  const config = read("config.js");
  assert.match(backend, /functions\.invoke\("submit-enquiry"/);
  assert.match(backend, /privacy_accepted/);
  assert.match(backend, /company_website/);
  assert.doesNotMatch(config, /sk_(?:live|test)_[A-Za-z0-9]+/);
  assert.doesNotMatch(config, /service_role_key\s*:/i);
});
