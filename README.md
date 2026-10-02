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

## Field preview attributes

Fields continue to preview as text (`textContent`), links (`href`), or images (`src`) by default. To preview a value into a different safe HTML attribute, add `previewAttribute` to the field schema:

```js
{
  key: "alt",
  label: "Alternative text",
  type: CMS_FIELD_TYPES.TEXT,
  previewAttribute: "alt",
}
```

The supported attribute bindings are `alt`, `title`, `aria-label`, and `poster`. Event handlers, `style`, `srcdoc`, and other executable or markup-bearing targets are rejected during schema validation. Unsafe URL schemes are rejected at preview time. Preview values are applied with DOM attribute APIs; the editor never generates HTML from field values. For the default image preview, a non-empty value sets `src`, while an absent optional value (`""`, `null`, or `undefined`) removes `src` instead of producing `src=""`. This lets a host keep an image target in the DOM without loading an empty source, and a later non-empty image value sets the attribute normally.

The existing `data-cms-preview-field="alt"` target contract is unchanged. Focusing or clicking the corresponding editor control highlights that same target and scrolls the website preview only when the target is not comfortably visible. This navigation is independent of the Preview Changes toggle and respects reduced-motion preferences.

## Repeatable-item labels

Sections whose content path ends in an array position, such as `services.cards.0`, receive stable structural labels. Set an optional schema `itemNoun` to choose the noun:

```js
{
  id: "service-card",
  label: "Service card",
  itemNoun: "Card",
  fields: [/* ... */],
}
```

The drawer renders `Card 1`, `Card 2`, and so on in current section order. Without `itemNoun`, it renders `Section 1`, `Section 2`, and so on. Non-indexed, top-level sections continue to use `schema.label`. Labels never derive from editable field values.

## Revision-history integration

Pass the existing revision provider contract through `initializeCmsEditor({ revisionHistory })`. The package mounts `createRevisionHistory()` into its own drawer, enables its own Revision History menu action, and owns opening, closing, and navigation:

```js
const editor = initializeCmsEditor({
  requireSchema,
  revisionHistory: {
    provider: {
      list: ({ page, head, highlightedRevision }) => revisions.list({ page, head, highlightedRevision }),
      view: (revisionId) => revisions.view(revisionId),
      restore: (revisionId, draftVersion) => revisions.restore(revisionId, draftVersion),
    },
    onRestored: async (draft, draftVersion) => {
      // Fetch or otherwise establish the authoritative restored content,
      // then reconcile through the public editor instance API.
      editor.reconcileSavedContent(draft, { hasSavedDraft: true });
    },
    canRestore: () => !editor.hasUnsavedChanges(),
  },
});
```

All other `createRevisionHistory()` options remain available inside `revisionHistory`, including provenance and draft-divergence callbacks. A missing or incomplete provider leaves the menu action disabled. Hosts must not query or mount into package-internal history elements.

## Workflow confirmations

Package-owned Save Draft, Revert, and Publish dialogs are opt-in through `workflowConfirmations`:

```js
initializeCmsEditor({
  requireSchema,
  workflowConfirmations: {
    save: { draftNote: true },
    revert: true,
    publish: true,
  },
  async saveChanges(request) {
    const note = request.saveData?.draftNote ?? "";
    await saveDraft({ changes: request.changes, note });
  },
  revertChanges,
  publishChanges,
});
```

Use `save: true` for confirmation without a note. `save.draftNoteLabel` can customize the note label. Cancellation never invokes the operation callback. Notes are returned as `request.saveData.draftNote`; the package does not persist, validate, or interpret them.

The legacy `confirmSave`, `confirmRevert`, and `confirmPublish` callbacks remain supported and take precedence over the corresponding package-owned dialog when both are supplied. Omitting `workflowConfirmations` preserves existing behavior.

## Publication progress

`publishChanges` may optionally report provider-neutral publication progress through the context passed by the editor:

```js
initializeCmsEditor({
  requireSchema,
  canPublish: true,
  async publishChanges({ reportProgress }) {
    reportProgress("creating-version");
    await createWebsiteVersion();

    reportProgress("updating-live");
    await updateLiveWebsite();

    reportProgress("confirming-live");
    await confirmLiveWebsite();
  },
});
```

The complete lifecycle is `preparing`, `creating-version`, `updating-live`, `confirming-live`, and `confirmed`. The package exclusively owns `preparing` when publication starts and `confirmed` after `publishChanges` resolves. Hosts may report only `creating-version`, `updating-live`, and `confirming-live`; attempts to report package-owned, unknown, stale, or backward stages are safely rejected. Intermediate reporting is optional, and existing callbacks that ignore their argument continue to work.

The host determines when its work reaches each host-reportable semantic stage. The editor owns the labels, inline See more/Show less presentation, accessibility, ordering, and stale-report protection. Hosts should report only these stage identifiers, never provider-specific text or HTML. Completed details remain inspectable until subsequent editor work begins; there is no timer-based dismissal.

## Verify locally

```bash
npm run verify
```

`npm run verify` runs the test suite and checks the files that would be included in the package artifact. For targeted work, use `npm test` or `npm run pack:check` individually. To create and inspect the actual artifact, run `npm pack`.

To create a ZIP of the standalone working tree:

```bash
npm run zip
```
