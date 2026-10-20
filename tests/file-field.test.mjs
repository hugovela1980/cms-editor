import assert from "node:assert/strict";
import {
    CMS_FIELD_TYPES, applyCmsFieldPreview, assertValidCmsSchema,
    collectCmsEditorValues, createCmsEditorState, createCmsFieldControl,
    createCmsEditorWorkflow, hasCmsEditorChanges, installCmsDrawerController,
    renderCmsDrawerValidationErrors, restoreCmsSectionPreview, validateCmsValuesForSchema,
} from "../src/index.js";

class Element {
    constructor(tagName, ownerDocument) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.listeners = new Map();
        this.attributes = new Map();
        this.className = "";
        this.value = "";
        this.disabled = false;
    }
    append(...children) {
        for (const child of children) {
            child.parentElement = this;
            this.children.push(child);
        }
    }
    querySelectorAll(selector) {
        const data = /^\[data-([a-z-]+)\]$/.exec(selector)?.[1]
            ?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return this.children.flatMap((child) => [
            ...(child.tagName.toLowerCase() === selector || data && child.dataset[data] !== undefined ? [child] : []),
            ...child.querySelectorAll(selector),
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    get classList() { return { contains: (name) => this.className.split(/\s+/).includes(name) }; }
    closest(selector) {
        if (selector.startsWith(".") && this.classList.contains(selector.slice(1))) return this;
        return this.parentElement?.closest(selector) ?? null;
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }
    dispatchEvent(event) {
        const results = (this.listeners.get(event.type) ?? []).map((listener) => listener(event));
        if (event.bubbles) this.parentElement?.dispatchEvent(event);
        return Promise.all(results);
    }
    focus() { this.ownerDocument.activeElement = this; }
}
const documentObject = {
    activeElement: null,
    defaultView: { Event },
    createElement(tag) { return new Element(tag, this); },
    querySelectorAll() { return []; },
};
const fields = [
    { key: "webpage", label: "Webpage document", type: CMS_FIELD_TYPES.FILE,
        accept: [".docx", "text/markdown"], maxBytes: 2048, required: true,
        hint: "Choose an editable document", group: "documents" },
    { key: "download", label: "Download document", type: CMS_FIELD_TYPES.FILE,
        accept: ["application/pdf"], maxBytes: 4096, required: true },
];
const schema = { id: "legal", label: "Legal", fields };
assert.doesNotThrow(() => assertValidCmsSchema(schema));
assert.throws(() => assertValidCmsSchema({ ...schema, fields: [{ ...fields[0], accept: [] }] }), /accept/);
assert.throws(() => assertValidCmsSchema({ ...schema, fields: [{ ...fields[0], maxBytes: 0 }] }), /maxBytes/);
assert.equal(validateCmsValuesForSchema({ schema, values: { webpage: "", download: "pdf-1" } }).valid, false);
assert.equal(validateCmsValuesForSchema({ schema, values: { webpage: "doc-1", download: "pdf-1" } }).valid, true);

const initial = { legal: { webpage: "doc-1", download: "pdf-1" } };
const root = new Element("div", documentObject);
const controls = fields.map((field, index) => {
    const ui = createCmsFieldControl({ documentObject, schemaId: schema.id,
        sectionPath: "legal", field, value: initial.legal[field.key], index });
    ui.control.dataset.cmsSectionPath = "legal";
    ui.control.dataset.cmsSchemaId = schema.id;
    ui.fileInput.dataset.cmsSectionPath = "legal";
    ui.fileInput.dataset.cmsSchemaId = schema.id;
    root.append(ui.wrapper);
    assert.equal(ui.fileInput.type, "file");
    assert.equal(ui.fileInput.accept, field.accept.join(","));
    assert.equal(ui.fileInput.getAttribute("aria-describedby")?.includes(`${ui.control.id}-status`), true);
    assert.equal(ui.fileInput.getAttribute("aria-describedby")?.includes(ui.fileCurrent.id), true);
    assert.equal(ui.fileInput.getAttribute("aria-required"), "true");
    assert.equal(ui.wrapper.querySelector("label").htmlFor, ui.fileInput.id);
    assert.equal(ui.fileAction.textContent, "Replace file");
    return ui;
});
const state = createCmsEditorState(initial);
renderCmsDrawerValidationErrors({
    drawer: root,
    errors: [{ fieldKey: "webpage", schemaId: schema.id, message: "Webpage document is required." }],
    focusFirst: true,
});
assert.equal(documentObject.activeElement, controls[0].fileInput);
assert.equal(controls[0].fileInput.getAttribute("aria-invalid"), "true");
assert.equal(controls[0].fileInput.getAttribute("aria-errormessage"), controls[0].errorElement.id);
renderCmsDrawerValidationErrors({ drawer: root, errors: [] });
assert.equal(controls[0].fileInput.getAttribute("aria-invalid"), null);
const workflow = createCmsEditorWorkflow({ initialState: "saved" });
const targetA = { dataset: { cmsPreviewField: "webpage" } };
const targetB = { dataset: { cmsPreviewField: "download" } };
const section = { querySelectorAll() { return [targetA, targetB]; } };
const buttons = Object.fromEntries([
    "[data-cms-drawer-close]", "[data-cms-preview-toggle]", "[data-cms-save-local]",
    "[data-cms-revert-live]", "[data-cms-save-deploy]",
].map((selector) => [selector, new Element("button", documentObject)]));
buttons["[data-cms-preview-toggle]"].checked = true;
const drawer = {
    ownerDocument: documentObject,
    dataset: {},
    classList: { contains() { return false; } },
    addEventListener() {},
    querySelector(selector) { return buttons[selector] ?? root.querySelector(selector); },
    querySelectorAll(selector) { return root.querySelectorAll(selector); },
};
const previews = [];
const uploads = [];
const saves = [];
let resolveCount = 0;
let completeSlowUpload;
let completeSlowDocument;
const controller = installCmsDrawerController({
    drawer,
    sectionEntries: [{ sectionPath: "legal", section, schema }],
    editorState: state,
    workflow,
    initialShowPreview: true,
    revertToSaved: true,
    uploadFile: async (request) => {
        uploads.push(request);
        if (request.file.name === "fail.pdf") throw new Error("Upload rejected");
        if (request.file.name === "slow.pdf") return new Promise((resolve) => { completeSlowUpload = resolve; });
        if (request.file.name === "slow.docx") return new Promise((resolve) => { completeSlowDocument = resolve; });
        return {
            value: request.file.name === "new.pdf" ? "pdf-2" : "doc-2",
            name: request.file.name,
            previewUrl: `https://preview.test/${request.file.name}`,
        };
    },
    resolveFileReference: async ({ fieldKey, value }) => {
        if (value === "bad") throw new Error("Resolver unavailable");
        return {
            name: `${fieldKey}-${value}.name`,
            previewUrl: `https://preview.test/${++resolveCount}/${value}`,
        };
    },
    renderFilePreview(event) { previews.push(event); },
    saveChanges(request) { saves.push(request); },
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(controls[0].fileCurrent.textContent, "webpage-doc-1.name");
assert.equal(controls[1].fileCurrent.textContent, "download-pdf-1.name");
assert.deepEqual(previews.at(-1).value, "pdf-1");

const file = (name, type, size) => ({ name, type, size });
controls[0].fileInput.files = [file("wrong.exe", "application/octet-stream", 100)];
await controls[0].fileInput.dispatchEvent(new Event("change"));
assert.equal(uploads.length, 0, "unaccepted files are rejected before upload");
controls[0].fileInput.files = [file("large.docx", "", 3000)];
await controls[0].fileInput.dispatchEvent(new Event("change"));
assert.equal(uploads.length, 0, "oversized files are rejected before upload");
controls[0].fileInput.files = [file("new.docx", "", 100)];
await controls[0].fileInput.dispatchEvent(new Event("change"));
assert.deepEqual(uploads[0].sectionPath, "legal");
assert.deepEqual(uploads[0].fieldKey, "webpage");
assert.equal(controls[0].control.value, "doc-2");
assert.equal(controls[1].control.value, "pdf-1", "second field stays independent");
assert.equal(hasCmsEditorChanges({ editingRoot: drawer, editorState: state }), true);
assert.equal(previews.at(-1).previewUrl, "https://preview.test/new.docx");
assert.deepEqual(collectCmsEditorValues({ editingRoot: drawer }), [
    { path: "legal.webpage", value: "doc-2" },
    { path: "legal.download", value: "pdf-1" },
]);

controls[1].fileInput.files = [file("fail.pdf", "application/pdf", 100)];
await controls[1].fileInput.dispatchEvent(new Event("change"));
assert.equal(controls[1].control.value, "pdf-1", "failed upload retains existing reference");
assert.match(controls[1].fileStatus.textContent, /Upload rejected/);
controls[1].fileInput.files = [file("new.pdf", "application/pdf", 100)];
await controls[1].fileInput.dispatchEvent(new Event("change"));
assert.equal(controls[1].control.value, "pdf-2");
assert.equal(controls[0].control.value, "doc-2");
assert.equal(controls[1].fileCurrent.textContent, "new.pdf");
await buttons["[data-cms-save-local]"].dispatchEvent(new Event("click"));
assert.deepEqual(saves[0].changes, [
    { path: "legal.webpage", value: "doc-2" },
    { path: "legal.download", value: "pdf-2" },
]);
assert.equal(state.getSavedValue("legal.webpage"), "doc-2");
assert.equal(state.getSavedValue("legal.download"), "pdf-2");
assert.equal(JSON.stringify(state.getSavedContent()).includes("preview.test"), false);

const snapshot = controller.captureTransientState();
assert.equal(JSON.stringify(snapshot).includes("preview.test"), false);
assert.equal(controller.reconcileSavedContent({ legal: { webpage: "doc-restore", download: "pdf-restore" } }), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(controls[0].control.value, "doc-restore");
assert.equal(controls[1].control.value, "pdf-restore");
assert.equal(controls[0].fileCurrent.textContent, "webpage-doc-restore.name");
assert.equal(controls[1].fileCurrent.textContent, "download-pdf-restore.name");
assert.equal(previews.at(-1).value, "pdf-restore");
assert.equal(controller.reconcileSavedContent({ legal: { webpage: "bad", download: "pdf-restore" } }), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.match(controls[0].fileStatus.textContent, /could not be loaded/i);
assert.equal(controller.reconcileSavedContent({ legal: { webpage: "doc-restore", download: "pdf-restore" } }), true);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(controls[0].fileStatus.textContent, "", "resolved replacement clears stale error");

controls[0].fileInput.focus();
assert.equal(documentObject.activeElement, controls[0].fileInput, "native chooser is keyboard focusable");
controls[1].fileInput.files = [file("slow.pdf", "application/pdf", 100)];
const slowUpload = controls[1].fileInput.dispatchEvent(new Event("change"));
await Promise.resolve();
assert.equal(controls[1].fileStatus.textContent, "Uploading file…");
assert.equal(drawer.dataset.cmsFileUploadsPending, "true");
await buttons["[data-cms-save-local]"].dispatchEvent(new Event("click"));
assert.equal(saves.length, 1, "Save Draft waits for an active upload");
assert.equal(controller.reconcileSavedContent({ legal: { webpage: "doc-restore", download: "pdf-newer" } }), true);
completeSlowUpload({ value: "pdf-stale", name: "slow.pdf" });
await slowUpload;
assert.equal(drawer.dataset.cmsFileUploadsPending, undefined);
assert.equal(controls[1].control.value, "pdf-newer", "restore invalidates an upload in flight");

controls[0].fileInput.files = [file("new.docx", "", 100)];
await controls[0].fileInput.dispatchEvent(new Event("change"));
await buttons["[data-cms-revert-live]"].dispatchEvent(new Event("click"));
assert.equal(controls[0].control.value, "doc-restore", "Revert restores the saved reference");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(controls[0].fileCurrent.textContent, "webpage-doc-restore.name");

let completeOld;
const old = new Promise((resolve) => { completeOld = resolve; });
const stalePreviews = [];
restoreCmsSectionPreview({
    section, sectionPath: "legal", schema, siteContent: { legal: { webpage: "old", download: "pdf-restore" } },
    resolveFileReference: () => old,
    renderFilePreview: (event) => stalePreviews.push(event),
});
applyCmsFieldPreview({ section, field: fields[0], value: "new",
    previewUrl: "https://preview.test/new", renderFilePreview: (event) => stalePreviews.push(event) });
completeOld({ previewUrl: "https://preview.test/old" });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(stalePreviews.filter((event) => event.field.key === "webpage").at(-1).value,
    "new", "changed reference invalidates stale preview resolution");
assert.equal(targetA.textContent, undefined, "FILE has no scalar preview fallback");
assert.equal(applyCmsFieldPreview({ section, field: fields[0], value: "doc-2" }), false);

controls[0].fileInput.files = [file("slow.docx", "", 100)];
const firstPending = controls[0].fileInput.dispatchEvent(new Event("change"));
controls[1].fileInput.files = [file("slow.pdf", "application/pdf", 100)];
const secondPending = controls[1].fileInput.dispatchEvent(new Event("change"));
await Promise.resolve();
completeSlowDocument({ value: "doc-concurrent", name: "slow.docx" });
await firstPending;
assert.equal(drawer.dataset.cmsFileUploadsPending, "true", "second field keeps actions blocked");
completeSlowUpload({ value: "pdf-concurrent", name: "slow.pdf" });
await secondPending;
assert.equal(drawer.dataset.cmsFileUploadsPending, undefined);
assert.equal(controls[0].control.value, "doc-concurrent");
assert.equal(controls[1].control.value, "pdf-concurrent");

console.log("File field checks passed.");
