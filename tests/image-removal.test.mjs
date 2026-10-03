import assert from "node:assert/strict";

import {
    CMS_FIELD_TYPES,
    applyCmsFieldPreview,
    createCmsFieldControl,
    hasCmsEditorChanges,
    installCmsDrawerController,
    validateCmsFieldValue,
} from "../src/index.js";

class FakeElement extends EventTarget {
    constructor(tagName) {
        super();
        this.tagName = tagName.toUpperCase();
        this.dataset = {};
        this.children = [];
        this.hidden = false;
        this.value = "";
    }

    append(...children) {
        this.children.push(...children);
    }

    setAttribute(name, value) {
        this[name] = String(value);
    }
}

const documentObject = {
    defaultView: { Event },
    createElement(tagName) {
        return new FakeElement(tagName);
    },
};

const optionalImage = {
    key: "image",
    label: "Background image",
    type: CMS_FIELD_TYPES.IMAGE,
    accept: ["image/png"],
    maxBytes: 1024,
};

{
    const populated = createCmsFieldControl({
        documentObject,
        schemaId: "hero",
        field: optionalImage,
        value: "/images/original.png",
        index: 0,
    });
    assert.equal(populated.imageRemoveButton?.textContent, "Remove image");
    assert.equal(populated.imageRemoveButton?.type, "button");
    assert.equal(populated.imageRemoveButton?.hidden, false);

    const empty = createCmsFieldControl({
        documentObject,
        schemaId: "hero",
        field: optionalImage,
        value: "",
        index: 0,
    });
    assert.equal(empty.imageRemoveButton?.hidden, true);
    assert.equal(empty.imageUploadLabel?.textContent, "Choose image");
    assert.equal(empty.imagePreview.src, undefined);

    const required = createCmsFieldControl({
        documentObject,
        schemaId: "hero",
        field: { ...optionalImage, required: true },
        value: "/images/original.png",
        index: 0,
    });
    assert.equal(required.imageRemoveButton, null);
}

function previewTarget() {
    const attributes = new Map([["src", "/images/original.png"]]);
    return {
        dataset: { cmsPreviewField: "image" },
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
        getAttribute(name) { return attributes.get(name) ?? null; },
    };
}

function inertButton() {
    return {
        disabled: false,
        addEventListener() {},
        setAttribute() {},
        removeAttribute() {},
    };
}

{
    const target = previewTarget();
    const section = { querySelectorAll: () => [target] };
    const control = new FakeElement("input");
    control.value = "/images/original.png";
    control.dataset = {
        cmsFieldKey: "image",
        cmsSectionPath: "hero",
        cmsPreviewValue: "/images/original.png",
    };

    const imagePreview = new FakeElement("img");
    imagePreview.src = "/images/original.png";
    imagePreview.removeAttribute = (name) => {
        if (name === "src") delete imagePreview.src;
    };
    const current = new FakeElement("p");
    const uploadLabel = new FakeElement("label");
    uploadLabel.textContent = "Replace image";
    const removeButton = new FakeElement("button");
    removeButton.hidden = false;
    const wrapper = {
        querySelector(selector) {
            return {
                "[data-cms-field-key]": control,
                "[data-cms-image-preview]": imagePreview,
                "[data-cms-image-current]": current,
                "[data-cms-image-upload-label]": uploadLabel,
                "[data-cms-image-remove]": removeButton,
            }[selector] ?? null;
        },
    };
    control.closest = () => wrapper;
    removeButton.closest = () => wrapper;

    const closeButton = inertButton();
    const previewToggle = { ...inertButton(), checked: true };
    const localSaveButton = inertButton();
    const revertButton = inertButton();
    const editorState = {
        getPublishedContent() {
            return { hero: { image: "/images/original.png" } };
        },
        getSavedValue(path) {
            assert.equal(path, "hero.image");
            return "/images/original.png";
        },
    };
    const workflowEvents = [];
    const workflow = {
        isBusy() { return false; },
        getSnapshot() { return { state: "idle" }; },
        send(event, detail) { workflowEvents.push({ event, detail }); },
    };
    const drawerDocument = {
        activeElement: null,
        defaultView: { Event },
        querySelectorAll() { return []; },
    };
    const drawer = {
        ownerDocument: drawerDocument,
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
            return {
                "[data-cms-field-key]": [control],
                "[data-cms-image-remove]": [removeButton],
                "[data-cms-image-file]": [],
                "[data-cms-drawer-section]": [],
            }[selector] ?? [];
        },
    };
    const sectionEntries = [{
        sectionPath: "hero",
        section,
        schema: {
            id: "hero",
            label: "Hero",
            fields: [optionalImage],
        },
    }];

    installCmsDrawerController({
        drawer,
        sectionEntries,
        editorState,
        workflow,
        initialShowPreview: true,
    });

    removeButton.dispatchEvent(new Event("click"));
    assert.equal(control.value, "");
    assert.equal(control.dataset.cmsPreviewValue, undefined);
    assert.equal(control.dataset.cmsUnsavedChange, "true");
    assert.equal(hasCmsEditorChanges({ editingRoot: drawer, editorState }), true);
    assert.equal(target.getAttribute("src"), null);
    assert.equal(imagePreview.src, undefined);
    assert.equal(current.textContent, "No image selected");
    assert.equal(uploadLabel.textContent, "Choose image");
    assert.equal(removeButton.hidden, true);
    assert.equal(validateCmsFieldValue({
        schemaId: "hero",
        field: optionalImage,
        value: control.value,
    }).valid, true);
    assert.equal(
        workflowEvents.some(({ detail }) => detail?.dirty === true),
        true,
    );

    control.value = "/images/new.png";
    control.dataset.cmsPreviewValue = "/images/new-preview.png";
    control.dispatchEvent(new Event("input"));
    assert.equal(target.getAttribute("src"), "/images/new-preview.png");
    assert.equal(imagePreview.src, "/images/new-preview.png");
    assert.equal(uploadLabel.textContent, "Replace image");
    assert.equal(removeButton.hidden, false);

    control.value = "/images/original.png";
    delete control.dataset.cmsPreviewValue;
    control.dispatchEvent(new Event("input"));
    assert.equal(target.getAttribute("src"), "/images/original.png");

    control.value = "javascript:alert(1)";
    control.dispatchEvent(new Event("input"));
    assert.equal(target.getAttribute("src"), "/images/original.png");

    assert.equal(applyCmsFieldPreview({
        section,
        field: optionalImage,
        value: "",
    }), true);
    assert.equal(target.getAttribute("src"), null);
}

console.log("Optional image removal checks passed.");
