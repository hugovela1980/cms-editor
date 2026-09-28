# @hugovela/cms-editor

A private, standalone plain-ESM package containing reusable browser-side CMS editor machinery for custom websites. It provides schema-driven controls, validation, editor state and workflow, live preview, revision UI, and the editor stylesheet without imposing a site layout or backend provider.

The package is currently prepared for Git-based installation and is not configured for npm publication.

## Install from GitHub

After this directory has been moved to its own repository:

```bash
npm install github:hugovela1980/cms-editor
```

The package remains `private` to prevent accidental registry publication; that does not prevent installation from GitHub.

## Public entrypoints

Import JavaScript through the package root:

```js
import {
  initializeCmsEditor,
  createRevisionHistory,
} from "@hugovela/cms-editor";
```

Import or expose the stylesheet through:

```text
@hugovela/cms-editor/styles/cms-editor.css
```

The package is distributed as source ESM and CSS. It has no bundler or generated `dist/` directory.

## Host responsibilities

The consuming website owns its schemas, content, templates, authentication, authorization, session behavior, persistence, publication, image storage, and backend enforcement. Host operations are supplied to the editor through its existing callbacks; credentials and provider-specific code do not belong in this package.

## Verify locally

```bash
npm test
npm run pack:check
```

`npm test` checks the public API, CSS entrypoint, package metadata, and host-isolation boundary. `npm run pack:check` shows the files that would be included in the package artifact. To create and inspect the actual artifact, run `npm pack`.

To create a ZIP of the standalone working tree:

```bash
npm run zip
```
