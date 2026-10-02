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

import {
    installCmsDrawerController,
} from "../src/drawer-controller.js";

function previewSection(target) {
    return { querySelectorAll: () => [target] };
}

function previewTarget(fieldKey = "value") {
    const attributes = new Map();
    return {
        dataset: { cmsPreviewField: fieldKey },
        textContent: "original",
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
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

for (const absentValue of ["", null, undefined]) {
    const target = previewTarget();
    target.setAttribute("src", "/original.jpg");
    assert.equal(applyCmsFieldPreview({
        section: previewSection(target),
        field: { key: "value", type: CMS_FIELD_TYPES.IMAGE },
        value: absentValue,
    }), true);
    assert.equal(target.getAttribute("src"), null);

    assert.equal(applyCmsFieldPreview({
        section: previewSection(target),
        field: { key: "value", type: CMS_FIELD_TYPES.IMAGE },
        value: "/images/example.jpg",
    }), true);
    assert.equal(target.getAttribute("src"), "/images/example.jpg");
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

{
    const target = previewTarget("image");
    target.setAttribute("src", "/temporary.jpg");
    restoreCmsSectionPreview({
        section: previewSection(target),
        sectionPath: "hero",
        schema: {
            fields: [{
                key: "image",
                type: CMS_FIELD_TYPES.IMAGE,
            }],
        },
        siteContent: {
            hero: { image: "" },
        },
    });
    assert.equal(target.getAttribute("src"), null);
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


{
    const target = previewTarget("heading");
    target.textContent = "Published heading";
    const section = previewSection(target);
    const control = {
        dataset: {
            cmsSectionPath: "hero",
            cmsFieldKey: "heading",
        },
        value: "Saved draft heading",
        addEventListener() {},
        removeEventListener() {},
    };
    const button = () => ({
        disabled: false,
        addEventListener() {},
        setAttribute() {},
        removeAttribute() {},
    });
    const closeButton = button();
    const previewToggle = { ...button(), checked: true };
    const localSaveButton = button();
    const revertButton = button();
    const documentObject = {
        activeElement: null,
        defaultView: null,
        querySelectorAll() { return []; },
    };
    const drawer = {
        ownerDocument: documentObject,
        addEventListener() {},
        querySelector(selector) {
            return {
                "[data-cms-drawer-close]": closeButton,
                "[data-cms-preview-toggle]": previewToggle,
                "[data-cms-save-local]": localSaveButton,
                "[data-cms-revert-live]": revertButton,
                "[data-cms-save-deploy]": null,
            }[selector] ?? null;
        },
        querySelectorAll(selector) {
            if (selector === "[data-cms-field-key]") return [control];
            return [];
        },
    };
    const editorState = {
        getPublishedContent() {
            return { hero: { heading: "Published heading" } };
        },
    };
    const workflow = {
        isBusy() { return false; },
        getSnapshot() { return { state: "idle" }; },
        send() {},
    };
    installCmsDrawerController({
        drawer,
        sectionEntries: [{
            sectionPath: "hero",
            section,
            schema: {
                id: "hero",
                label: "Hero",
                fields: [{
                    key: "heading",
                    label: "Heading",
                    type: CMS_FIELD_TYPES.TEXT,
                }],
            },
        }],
        editorState,
        workflow,
        initialShowPreview: true,
    });
    assert.equal(
        target.textContent,
        "Saved draft heading",
        "Preview-on initialization should immediately apply the saved draft to the website preview.",
    );
}

console.log("Preview behavior checks passed.");
