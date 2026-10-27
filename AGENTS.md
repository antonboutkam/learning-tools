# AGENTS.md

This repository contains a set of versioned, standalone learning tools (mostly quiz-style) that are loaded via iframes.

## Instructions
- [Deploying code](docs/deploying-code.md)
- [Environments](docs/environments.md)

## About the tools
- [Tools](docs/tool-instructions.md)


## JSON Schema conventions (form generation)
Objective: Schemas must be both validatable and form-friendly (for the Courses tool).

- Use JSON Schema draft 2020-12 (`$schema`) and define a stable `$id`.
- Always include a clear `title` and `description` at the root of the schema (explaining what the tool does).
- For each property, preferably include a `title` (field label) and a `description` (helper text).
- For arrays/objects: provide a `title` for both the container and the individual items to ensure that repeatable sections remain readable.
- Keep schemas strict whenever possible: use `additionalProperties: false` (unless there is an explicit reason to allow arbitrary fields).
- Use Dutch for all text within the schemas (to align with the language used by students and in course materials).
- Use 2-space indentation for JSON and maintain a consistent key order (metadata → type → required → additionalProperties → properties).

## Modifying tools
- If you rename properties or change their semantics, ensure you also update the corresponding JS files (`app.js`/`tool.js`) and adjust `example.json` accordingly. - For new types/versions: add to `public_html/types/registry.json` and update `README.md`.