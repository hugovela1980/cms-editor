import assert from "node:assert/strict";
import {
    CMS_FIELD_TYPES,
    applyCmsFieldPreview,
    assertValidCmsSchema,
    collectCmsEditorValues,
    createCmsEditorState,
    createCmsFieldControl,
    createCmsTransientStateSnapshot,
    hasCmsEditorChanges,
    installCmsDrawerController,
    isCmsTransientStateSnapshot,
    renderCmsDrawerValidationErrors,
    validateCmsFieldValue,
    validateCmsValuesForSchema,
} from "../src/index.js";

class Element {
    constructor(tagName, documentObject) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = documentObject;
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.className = "";
        this.disabled = false;
        this.value = "";
    }
    append(...children) {
        children.forEach((child) => {
            child.parentElement = this;
            this.children.push(child);
        });
    }
    replaceChildren(...children) {
        this.children.forEach((child) => { child.parentElement = null; });
        this.children = [];
        this.append(...children);
    }
    remove() {
        const siblings = this.parentElement.children;
        siblings.splice(siblings.indexOf(this), 1);
        this.parentElement = null;
    }
    querySelectorAll(selector) {
        const dataMatch = /^\[data-([a-z-]+)\]$/.exec(selector);
        const dataKey = dataMatch?.[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return this.children.flatMap((child) => [
            ...(selector === child.tagName.toLowerCase() ||
                (dataKey && child.dataset[dataKey] !== undefined)
                ? [child] : []),
            ...child.querySelectorAll(selector),
        ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(type, listener) {
        const handlers = this.listeners.get(type) ?? [];
        handlers.push(listener);
        this.listeners.set(type, handlers);
    }
    dispatchEvent(event) {
        for (const listener of this.listeners.get(event.type) ?? []) listener(event);
        if (event.bubbles) this.parentElement?.dispatchEvent(event);
    }
    focus() { this.ownerDocument.activeElement = this; }
    get classList() { return { contains: (name) => this.className.split(/\s+/).includes(name) }; }
    closest(selector) {
        if (selector === ".cms-field" && this.classList.contains("cms-field")) return this;
        return this.parentElement?.closest(selector) ?? null;
    }
}
const documentObject = {
    activeElement: null,
    defaultView: { Event },
    createElement(tag) { return new Element(tag, this); },
};
const field = { key: "options", label: "Options", type: CMS_FIELD_TYPES.TEXT_LIST, minItems: 1 };
const schema = { id: "contact", label: "Contact", fields: [field] };
assert.doesNotThrow(() => assertValidCmsSchema(schema));
assert.throws(() => assertValidCmsSchema({ ...schema, fields: [{ ...field, minItems: -1 }] }), /minItems/);
assert.throws(() => assertValidCmsSchema({ ...schema, fields: [{ ...field, addButtonLabel: "  " }] }), /addButtonLabel/);
assert.throws(() => assertValidCmsSchema({ ...schema, fields: [{ key: "title", label: "Title", type: CMS_FIELD_TYPES.TEXT, addButtonLabel: "Add title" }] }), /addButtonLabel/);
assert.equal(validateCmsFieldValue({ schemaId: schema.id, field, value: [] }).valid, false);
assert.equal(validateCmsValuesForSchema({ schema, values: {} }).valid, false);
assert.equal(validateCmsFieldValue({ schemaId: schema.id, field, value: ["A", ""] }).valid, true);
assert.equal(validateCmsFieldValue({ schemaId: schema.id, field, value: "A" }).valid, false);
assert.equal(validateCmsValuesForSchema({ schema, values: { options: ["A", "B"] } }).valid, true);

const { wrapper, control } = createCmsFieldControl({ documentObject, schemaId: schema.id, field, value: ["A", "B"], index: 0 });
control.dataset.cmsSectionPath = "inquiry";
control.dataset.cmsSchemaId = schema.id;
const changes = [];
control.addEventListener("input", () => changes.push([...control.value]));
assert.deepEqual(control.value, ["A", "B"]);
const state = createCmsEditorState({ inquiry: { options: ["A", "B"] } });
assert.equal(hasCmsEditorChanges({ editingRoot: wrapper, editorState: state }), false);
const rows = control.querySelectorAll("input");
assert.equal(control.tagName, "FIELDSET");
assert.equal(control.querySelector("legend").textContent, "Options");
assert.equal(control.querySelectorAll("label")[0].htmlFor, rows[0].id);
assert.equal(control.querySelectorAll("button").every((button) => button.type === "button"), true);
rows[0].value = "B";
rows[0].dispatchEvent(new Event("input", { bubbles: true }));
assert.deepEqual(changes.at(-1), ["B", "B"]);
assert.equal(hasCmsEditorChanges({ editingRoot: wrapper, editorState: state }), true);
control.value = ["B", "A"];
assert.equal(hasCmsEditorChanges({ editingRoot: wrapper, editorState: state }), true, "Order is significant");
control.value = ["A", "B"];
const add = control.querySelectorAll("button").at(-1);
assert.equal(add.textContent, "Add Options item", "Existing schemas keep the default button label");
const customField = { ...field, addButtonLabel: "Add dropdown options" };
assert.doesNotThrow(() => assertValidCmsSchema({ ...schema, fields: [customField] }));
const custom = createCmsFieldControl({ documentObject, schemaId: schema.id, field: customField, value: ["A"], index: 0 });
assert.equal(custom.control.querySelectorAll("button").at(-1).textContent, "Add dropdown options");
assert.equal(custom.control.querySelectorAll("button")[0].disabled, true, "minItems still protects the final row");
add.dispatchEvent(new Event("click"));
assert.deepEqual(control.value, ["A", "B", ""]);
assert.equal(documentObject.activeElement, control.querySelectorAll("input").at(-1));
const removes = control.querySelectorAll("button");
removes[1].dispatchEvent(new Event("click"));
assert.deepEqual(control.value, ["A", ""]);
assert.equal(documentObject.activeElement, control.querySelectorAll("input")[1]);
removes[0].dispatchEvent(new Event("click"));
assert.deepEqual(control.value, [""]);
assert.equal(control.querySelectorAll("button")[0].disabled, true);
assert.deepEqual(collectCmsEditorValues({ editingRoot: wrapper }), [{ path: "inquiry.options", value: [""] }]);
const snapshot = createCmsTransientStateSnapshot({ values: collectCmsEditorValues({ editingRoot: wrapper }) });
assert.equal(isCmsTransientStateSnapshot(snapshot), true);
assert.deepEqual(snapshot.values[0].value, [""]);
snapshot.values[0].value.push("later");
assert.deepEqual(control.value, [""], "Draft snapshot does not alias the control value");

const target = { dataset: { cmsPreviewField: "options" } };
const section = { querySelectorAll() { return [target]; } };
const previews = [];
assert.equal(applyCmsFieldPreview({ section, field, value: ["A", "B"], renderTextListPreview: (event) => previews.push(event) }), true);
assert.deepEqual(previews[0].value, ["A", "B"]);
assert.equal(previews[0].target, target);
assert.equal(target.textContent, undefined, "No scalar fallback writes the target");
assert.equal(applyCmsFieldPreview({ section, field, value: ["A", "B"] }), false);
assert.equal(applyCmsFieldPreview({ section, field, value: undefined, renderTextListPreview: (event) => previews.push(event) }), true);
assert.deepEqual(previews.at(-1).value, [], "A missing published list clears the host preview");

const drawer = {
    querySelectorAll(selector) { return selector === "[data-cms-field-key]" ? [control] : []; },
};
renderCmsDrawerValidationErrors({ drawer, errors: [{ fieldKey: field.key, schemaId: schema.id, message: "Duplicate option" }], focusFirst: true });
assert.equal(control.getAttribute("aria-invalid"), "true");
assert.equal(wrapper.querySelector("p").textContent, "Duplicate option");
assert.equal(documentObject.activeElement, control.querySelector("input"));

control.value = ["A", "B"];
const makeButton = () => new Element("button", documentObject);
const closeButton = makeButton();
const previewToggle = makeButton();
previewToggle.checked = true;
const saveButton = makeButton();
const revertButton = makeButton();
const drawerControls = {
    "[data-cms-drawer-close]": closeButton,
    "[data-cms-preview-toggle]": previewToggle,
    "[data-cms-save-local]": saveButton,
    "[data-cms-revert-live]": revertButton,
};
const controllerDrawer = {
    ownerDocument: documentObject,
    classList: { contains() { return false; } },
    addEventListener() {},
    querySelector(selector) { return drawerControls[selector] ?? null; },
    querySelectorAll(selector) { return selector === "[data-cms-field-key]" ? [control] : []; },
};
const workflowEvents = [];
const savedRequests = [];
const livePreviews = [];
const controller = installCmsDrawerController({
    drawer: controllerDrawer,
    sectionEntries: [{ sectionPath: "inquiry", section, schema }],
    editorState: state,
    workflow: {
        isBusy() { return false; },
        getSnapshot() { return { state: "idle" }; },
        send(event, detail) { workflowEvents.push({ event, detail }); },
    },
    initialShowPreview: true,
    saveChanges(request) { savedRequests.push(request); },
    renderTextListPreview({ value }) { livePreviews.push(value); },
});
assert.deepEqual(livePreviews.at(-1), ["A", "B"], "Initial preview receives the ordered array");
control.value = ["A", "B", ""];
control.dispatchEvent(new Event("input", { bubbles: true }));
assert.deepEqual(livePreviews.at(-1), ["A", "B", ""], "An empty draft row previews immediately");
assert.equal(workflowEvents.some(({ detail }) => detail?.dirty === true), true);
saveButton.dispatchEvent(new Event("click"));
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(savedRequests[0].changes, [{ path: "inquiry.options", value: ["A", "B", ""] }]);
assert.deepEqual(state.getSavedValue("inquiry.options"), ["A", "B", ""]);
const draftSnapshot = controller.captureTransientState();
assert.deepEqual(draftSnapshot.values[0].value, ["A", "B", ""]);
control.value = ["Temporary"];
assert.equal(controller.restoreTransientState(draftSnapshot), false);
assert.deepEqual(control.value, ["A", "B", ""]);
assert.equal(controller.reconcileSavedContent({ inquiry: { options: ["Reconciled"] } }), true);
assert.deepEqual(control.value, ["Reconciled"]);
assert.deepEqual(livePreviews.at(-1), ["Reconciled"]);

console.log("Text list checks passed.");
