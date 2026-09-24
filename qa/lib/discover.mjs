/**
 * Code discovery for the self-updating regression suite.
 *
 * Reads the site's source files and content and returns a "manifest" of every
 * testable feature. The runner generates one or more test cases per entry, so
 * when the code gains a section, slot, nav link, editor tab, editor field,
 * product, role or arena, the regression suite grows automatically.
 */
import fs from 'node:fs';
import path from 'node:path';

const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');
const uniq = (a) => [...new Set(a)];

export function discover(root) {
  const index = read(root, 'index.html');
  const script = read(root, 'script.js');
  const adminHtml = read(root, 'admin/index.html');
  const adminJs = read(root, 'admin/admin.js');
  const profile = JSON.parse(read(root, 'content/profile.json'));
  const products = JSON.parse(read(root, 'content/products.json'));

  const main = index.slice(index.indexOf('<main'), index.indexOf('</main>'));
  const sections = [...main.matchAll(/<(section|header)\b[^>]*\bid="([^"]+)"/g)].map((m) => m[2]);
  const slots = uniq([...index.matchAll(/data-slot="([^"]+)"/g)].map((m) => m[1]));
  const navLinks = [...index.matchAll(/<a href="#([^"]+)"(?: class="nav-cta")?>[^<]+<\/a>/g)].map((m) => m[1]);
  const jsSlots = uniq([...script.matchAll(/(?:set|slot)\('([a-z0-9-]+)'/g)].map((m) => m[1]));
  const icons = uniq([...index.matchAll(/<symbol id="g-([a-z0-9-]+)"/g)].map((m) => m[1]));

  const adminTabs = [...adminHtml.matchAll(/role="tab" id="(tab-[^"]+)" aria-controls="([^"]+)"/g)].map((m) => ({ tab: m[1], panel: m[2] }));
  const schemaFields = [...adminJs.matchAll(/S\('([A-Za-z_]+)', '([^']+)', '([a-z]+)'/g)].map((m) => ({ key: m[1], label: m[2], type: m[3] }));
  const uploads = [...adminHtml.matchAll(/data-upload="([^"]+)"/g)].map((m) => m[1]);

  return {
    site: { sections, slots, navLinks, jsSlots, icons },
    admin: { tabs: adminTabs, fields: schemaFields, uploads },
    content: {
      products: products.products.map((p) => ({ id: p.id, name: p.name, arena: p.arena })),
      arenas: products.arenas.map((a) => a.id),
      roles: profile.experience.roles.map((r) => ({ tab: r.tab, title: r.title })),
      skillGroups: profile.skills.groups.map((g) => g.name),
      stats: profile.stats.length,
      education: profile.education.length,
    },
  };
}

/** Flatten a manifest into stable "feature keys" so two manifests can be diffed. */
export function featureKeys(m) {
  return [
    ...m.site.sections.map((x) => `section:${x}`),
    ...m.site.slots.map((x) => `slot:${x}`),
    ...m.site.navLinks.map((x) => `nav:${x}`),
    ...m.site.icons.map((x) => `icon:${x}`),
    ...m.admin.tabs.map((x) => `admin-tab:${x.tab}`),
    ...m.admin.fields.map((x) => `admin-field:${x.key}:${x.type}`),
    ...m.admin.uploads.map((x) => `admin-upload:${x}`),
    ...m.content.products.map((x) => `product:${x.id}`),
    ...m.content.arenas.map((x) => `arena:${x}`),
    ...m.content.roles.map((x) => `role:${x.tab}`),
    ...m.content.skillGroups.map((x) => `skill-group:${x}`),
  ];
}

export function diffManifests(prev, next) {
  const a = new Set(prev ? featureKeys(prev) : []), b = new Set(featureKeys(next));
  return { added: [...b].filter((k) => !a.has(k)), removed: [...a].filter((k) => !b.has(k)), total: b.size };
}
