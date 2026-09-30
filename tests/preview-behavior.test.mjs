import assert from "node:assert/strict";

import {
    CMS_FIELD_TYPES,
    applyCmsFieldPreview,
    assertValidCmsSchema,
    restoreCmsSectionPreview,
} from "../src/index.js";

import {
    scrollCmsPreviewTargetIntoView,
} from "../src/preview-navigation.js";

function previewSection(target) {
    return { querySelectorAll: () => [target] };
}

function previewTarget(fieldKey = "value") {
    const attributes = new Map();
    return {
        dataset: { cmsPreviewField: fieldKey },
        textContent: "original",
        setAttribute(name, value) { attributes.set(name, value); },
        getAttribute(name) { return attributes.get(name) ?? null; },
    };
}

for (const [type, attribute] of [
    [CMS_FIELD_TYPES.URL, "href"],
    [CMS_FIELD_TYPES.IMAGE, "src"],
]) {
    const target = previewTarget();
    assert.equal(applyCmsFieldPreview({
        section: previewSection(target),
        field: { key: "value", type },
        value: "/safe-value",
    }), true);
    assert.equal(target.getAttribute(attribute), "/safe-value");
}

{
    const target = previewTarget();
    assert.equal(applyCmsFieldPreview({
        section: previewSection(target),
        field: { key: "value", type: CMS_FIELD_TYPES.TEXT },
        value: "Updated text",
    }), true);
    assert.equal(target.textContent, "Updated text");
}

for (const attribute of ["alt", "title"]) {
    const target = previewTarget();
    assert.equal(applyCmsFieldPreview({
        section: previewSection(target),
        field: {
            key: "value",
            type: CMS_FIELD_TYPES.TEXT,
            previewAttribute: attribute,
        },
        value: "Accessible preview",
    }), true);
    assert.equal(target.getAttribute(attribute), "Accessible preview");
}

{
    const target = previewTarget("description");
    target.setAttribute("alt", "Temporary value");
    restoreCmsSectionPreview({
        section: previewSection(target),
        sectionPath: "hero",
        schema: {
            fields: [{
                key: "description",
                type: CMS_FIELD_TYPES.TEXT,
                previewAttribute: "alt",
            }],
        },
        siteContent: {
            hero: { description: "Original description" },
        },
    });
    assert.equal(target.getAttribute("alt"), "Original description");
}

const schemaField = {
    key: "value",
    label: "Value",
    type: CMS_FIELD_TYPES.TEXT,
};
for (const previewAttribute of ["onclick", "style", "srcdoc"]) {
    assert.throws(() => assertValidCmsSchema({
        id: "unsafe-attribute",
        label: "Unsafe attribute",
        fields: [{ ...schemaField, previewAttribute }],
    }), /unsafe or unsupported previewAttribute/);
}

{
    const target = previewTarget();
    target.setAttribute("src", "/original.jpg");
    assert.equal(applyCmsFieldPreview({
        section: previewSection(target),
        field: { key: "value", type: CMS_FIELD_TYPES.IMAGE },
        value: "java\nscript:alert(1)",
    }), false);
    assert.equal(target.getAttribute("src"), "/original.jpg");
}

function scrollTarget(rect, { connected = true, visible = true } = {}) {
    const calls = [];
    return {
        isConnected: connected,
        ownerDocument: { defaultView: null },
        getClientRects: () => visible ? [rect] : [],
        getBoundingClientRect: () => rect,
        scrollIntoView(options) { calls.push(options); },
        calls,
    };
}

const viewport = {
    innerWidth: 1000,
    innerHeight: 800,
    matchMedia: () => ({ matches: false }),
};
const outsideRect = {
    top: 700, bottom: 760, left: 200, right: 400,
    width: 200, height: 60,
};
{
    const target = scrollTarget(outsideRect);
    assert.equal(scrollCmsPreviewTargetIntoView(target, { windowObject: viewport }), true);
    assert.deepEqual(target.calls, [{ behavior: "smooth", block: "center", inline: "nearest" }]);
}
{
    const target = scrollTarget({
        top: 200, bottom: 300, left: 200, right: 400,
        width: 200, height: 100,
    });
    assert.equal(scrollCmsPreviewTargetIntoView(target, { windowObject: viewport }), false);
    assert.equal(target.calls.length, 0);
}
{
    const target = scrollTarget(outsideRect);
    scrollCmsPreviewTargetIntoView(target, {
        windowObject: { ...viewport, matchMedia: () => ({ matches: true }) },
    });
    assert.equal(target.calls[0].behavior, "auto");
}
assert.equal(scrollCmsPreviewTargetIntoView(null, { windowObject: viewport }), false);
assert.equal(scrollCmsPreviewTargetIntoView(
    scrollTarget(outsideRect, { connected: false }),
    { windowObject: viewport },
), false);

console.log("Preview behavior checks passed.");
