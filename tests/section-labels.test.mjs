import assert from "node:assert/strict";

import {
    CMS_FIELD_TYPES,
    assertValidCmsSchema,
} from "../src/index.js";

import { getCmsSectionLabel } from "../src/section-label.js";

const field = {
    key: "heading",
    label: "Heading",
    type: CMS_FIELD_TYPES.TEXT,
};
const cardSchema = {
    id: "card",
    label: "Editable card title",
    itemNoun: "Card",
    fields: [field],
};
const entries = [
    { sectionPath: "page.cards.0", schema: cardSchema },
    { sectionPath: "page.cards.1", schema: cardSchema },
    { sectionPath: "page.cards.2", schema: cardSchema },
];
assert.deepEqual(entries.map((entry, entryIndex) =>
    getCmsSectionLabel({ sectionEntries: entries, entryIndex })), [
    "Card 1", "Card 2", "Card 3",
]);

// Mutable content values are not consulted by structural labeling.
assert.equal(getCmsSectionLabel({ sectionEntries: entries, entryIndex: 0 }), "Card 1");

const reordered = [entries[2], entries[0], entries[1]];
assert.deepEqual(reordered.map((entry, entryIndex) =>
    getCmsSectionLabel({ sectionEntries: reordered, entryIndex })), [
    "Card 1", "Card 2", "Card 3",
]);

const fallbackEntries = [
    { sectionPath: "page.features.0", schema: { ...cardSchema, id: "feature", itemNoun: undefined } },
    { sectionPath: "page.features.1", schema: { ...cardSchema, id: "feature", itemNoun: undefined } },
];
assert.equal(getCmsSectionLabel({ sectionEntries: fallbackEntries, entryIndex: 1 }), "Section 2");

const topLevelEntries = [
    { sectionPath: "hero", schema: { ...cardSchema, label: "Hero", itemNoun: undefined } },
];
assert.equal(getCmsSectionLabel({ sectionEntries: topLevelEntries, entryIndex: 0 }), "Hero");

assert.throws(() => assertValidCmsSchema({
    ...cardSchema,
    itemNoun: " ",
}), /invalid itemNoun/);

console.log("Section label checks passed.");
