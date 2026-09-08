import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const catalog = JSON.parse(await readFile(join(root, 'docs/tools/catalog.json'), 'utf8'));
const registry = JSON.parse(await readFile(join(root, 'public_html/types/registry.json'), 'utf8'));
const out = join(root, 'docs/tools/versions');

const list = (items) => items.map((item) => `- ${item}`).join('\n');
const config = (schema) => Object.entries(schema.properties ?? {}).map(([name, definition]) => {
  const required = (schema.required ?? []).includes(name) ? 'verplicht' : 'optioneel';
  const title = definition.title ? ` — ${definition.title}` : '';
  const description = definition.description ? `: ${definition.description}` : '';
  return `- \`${name}\` (${required})${title}${description}`;
}).join('\n');

await rm(out, { recursive: true, force: true });
const index = [];
for (const tool of registry.types) {
  const key = `${tool.id}/${tool.version}`;
  const entry = catalog.tools[key];
  if (!entry) throw new Error(`Catalogus mist ${key}`);
  const schemaPath = join(root, 'public_html/types', tool.id.replace(/-v2$/, ''), tool.version, 'schema.json');
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const file = join(out, tool.id, `${tool.version}.md`);
  await mkdir(dirname(file), { recursive: true });
  const typePath = tool.launchUrl.replace(/^\//, '');
  const markdown = `# ${tool.name} (${tool.version})\n\n> Agentkaart. Bron: [catalog.json](../../catalog.json); gegenereerd met \`node scripts/build-tool-docs.mjs\`. Werk bij inhoudelijke wijzigingen eerst de catalogus, het schema en de runtime bij.\n\n## Toepassingen\n\n${list(entry.toepassingen)}\n\n## Features\n\n${list(entry.features)}\n\n## Implementatie\n\n${entry.implementatie}\n\n- Runtime: [${typePath}](/${typePath})\n- Configuratieschema: [schema.json](/${typePath}schema.json)\n- Voorbeeld: [example.json](/${typePath}example.json)\n\n## Configuratie\n\nGebruik de JSON die via \`?data=<publieke-json-url>\` wordt geladen. De schema-URL uit de registry is de norm; de lijst hieronder is er voor snel agent-overzicht.\n\n${config(schema)}\n\n## API\n\n${entry.api}\n\nAlgemene iframe-contracten:\n\n- Launch: \`${tool.launchUrl}?data=<url-encoded JSON-URL>\`.\n- \`unique_id\` kan als queryparameter worden meegegeven wanneer de tool instantiecontext of lokale opslag gebruikt; de schema-eis blijft leidend.\n- De registry levert \`launchUrl\`, \`schemaUrl\` en \`exampleDataUrl\`; gebruik nooit een onversieerde tool-URL.\n- Standalone tools zenden geen \`postMessage\` en geen Canvas-score terug. Zie [LTI-inzendingen](../../lti-submission.md) voor de grens van die integratie.\n`;
  await writeFile(file, markdown);
  index.push({ id: tool.id, version: tool.version, name: tool.name, type: tool.type, toepassingen: entry.toepassingen, documentatie: `versions/${tool.id}/${tool.version}.md` });
}
await writeFile(join(out, 'index.json'), `${JSON.stringify({ version: 1, generatedFrom: '../catalog.json', tools: index }, null, 2)}\n`);
const applications = new Map();
for (const tool of index) for (const application of tool.toepassingen) {
  applications.set(application, [...(applications.get(application) ?? []), `${tool.name} (${tool.version})`]);
}
const overview = `# Tooldocumentatie\n\nDeze map bevat de gegenereerde, agentvriendelijke documentatie per toolversie. De bewerkbare bron is [catalog.json](catalog.json); genereer na een wijziging opnieuw met:\n\n\`node scripts/build-tool-docs.mjs\`\n\n\`versions/index.json\` is de machineleesbare, geaggregeerde index.\n\n## Toepassingen\n\n${[...applications].sort(([a], [b]) => a.localeCompare(b, 'nl')).map(([application, tools]) => `- **${application}**: ${tools.join(', ')}`).join('\n')}\n\n## Onderhoudsafspraak\n\nBij een featurewijziging: pas runtime, \`schema.json\`, \`example.json\` en \`catalog.json\` aan; draai daarna de generator. Nieuwe toolversies vragen daarnaast om registry- en README-updates.\n`;
await writeFile(join(root, 'docs/tools/README.md'), overview);
