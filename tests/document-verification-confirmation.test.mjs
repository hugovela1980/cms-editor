import assert from "node:assert/strict";
import {
    cmsDocumentVersionsMatch,
    showCmsDocumentVerificationConfirmation,
} from "../src/index.js";

class Element {
    constructor(tagName, ownerDocument) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.listeners = new Map();
        this.disabled = false;
        this.isConnected = false;
        this.open = false;
    }
    append(...children) {
        for (const child of children) {
            child.parent = this;
            child.isConnected = true;
            this.children.push(child);
        }
    }
    remove() {
        if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this);
        this.isConnected = false;
    }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(type, listener) {
        this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }
    dispatch(type, properties = {}) {
        const event = { type, preventDefault() { this.defaultPrevented = true; }, ...properties };
        for (const listener of this.listeners.get(type) ?? []) listener(event);
        return event;
    }
    focus() { this.ownerDocument.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatch("close"); }
    querySelectorAll(tag) {
        return this.children.flatMap((child) => [
            ...(child.tagName === tag.toUpperCase() ? [child] : []),
            ...child.querySelectorAll(tag),
        ]);
    }
}

function fixture(overrides = {}) {
    const documentObject = {};
    documentObject.createElement = (tag) => new Element(tag, documentObject);
    documentObject.body = documentObject.createElement("body");
    const opener = documentObject.createElement("button");
    documentObject.body.append(opener);
    opener.focus();
    const webpage = { label: "Webpage", previewUrl: "https://example.test/web", versionId: "web-1" };
    const downloadable = { label: "Download", previewUrl: "https://example.test/file", versionId: "file-1" };
    const options = {
        status: "could-not-verify",
        title: "Inspect files",
        explanation: "Automatic comparison was inconclusive.",
        webpage,
        downloadable,
        getCurrentVersions: () => ({ webpage, downloadable }),
        documentObject,
        ...overrides,
    };
    const start = () => {
        const result = showCmsDocumentVerificationConfirmation(options);
        const dialog = documentObject.body.querySelectorAll("dialog")[0];
        const find = (tag) => dialog.querySelectorAll(tag);
        return { result, dialog, find, opener, documentObject };
    };
    return { start, options };
}

function acknowledge(ui) {
    const checkbox = ui.find("input")[0];
    checkbox.checked = true;
    checkbox.dispatch("change");
}

{
    const ui = fixture().start();
    const [heading] = ui.find("h2");
    const [cancel, confirm] = ui.find("button");
    assert.equal(ui.documentObject.activeElement, heading, "initial focus is the title");
    assert.equal(ui.dialog["aria-labelledby"], heading.id);
    assert.equal(confirm.disabled, true);
    assert.deepEqual(ui.find("a").map(({ target, rel }) => [target, rel]), [
        ["_blank", "noopener noreferrer"], ["_blank", "noopener noreferrer"],
    ]);
    ui.find("form")[0].dispatch("submit");
    assert.equal(confirm.disabled, true, "submit cannot bypass acknowledgement");
    acknowledge(ui);
    assert.equal(confirm.disabled, false);
    ui.find("form")[0].dispatch("submit");
    assert.deepEqual(await ui.result, {
        confirmed: true,
        versions: { webpage: "web-1", downloadable: "file-1" },
    });
    assert.equal(ui.documentObject.activeElement, ui.opener, "focus returns to Publish");
    assert.equal(ui.documentObject.body.querySelectorAll("dialog").length, 0);
    void cancel;
}

for (const action of ["click", "escape", "native-cancel"]) {
    const ui = fixture().start();
    if (action === "click") ui.find("button")[0].dispatch("click");
    if (action === "escape") ui.dialog.dispatch("keydown", { key: "Escape" });
    if (action === "native-cancel") ui.dialog.dispatch("cancel");
    assert.equal((await ui.result).confirmed, false, `${action} stops Publish`);
    assert.equal(ui.documentObject.activeElement, ui.opener);
}

{
    const ui = fixture().start();
    const links = ui.find("a");
    const buttons = ui.find("button");
    const titleTab = ui.dialog.dispatch("keydown", { key: "Tab" });
    assert.equal(titleTab.defaultPrevented, true);
    assert.equal(ui.documentObject.activeElement, links[0]);
    links[0].focus();
    const backward = ui.dialog.dispatch("keydown", { key: "Tab", shiftKey: true });
    assert.equal(backward.defaultPrevented, true);
    assert.equal(ui.documentObject.activeElement, buttons[0]);
    buttons[0].focus();
    const forward = ui.dialog.dispatch("keydown", { key: "Tab" });
    assert.equal(forward.defaultPrevented, true);
    assert.equal(ui.documentObject.activeElement, links[0]);
    ui.dialog.dispatch("cancel");
    await ui.result;
}

for (const missing of ["webpage", "downloadable"]) {
    const base = fixture();
    const ui = fixture({ [missing]: {
        ...base.options[missing],
        previewUrl: missing === "webpage" ? "" : "http://insecure.test/file",
    } }).start();
    assert.equal(ui.find("a").length, 1);
    assert.equal(ui.find("input")[0].disabled, true);
    acknowledge(ui);
    assert.equal(ui.find("button")[1].disabled, true);
    ui.find("button")[0].dispatch("click");
    assert.equal((await ui.result).confirmed, false);
}

for (const changed of ["webpage", "downloadable"]) {
    const original = fixture().options;
    const ui = fixture({
        getCurrentVersions: () => ({
            webpage: original.webpage,
            downloadable: original.downloadable,
            [changed]: { versionId: "new-version" },
        }),
    }).start();
    acknowledge(ui);
    ui.find("form")[0].dispatch("submit");
    assert.equal((await ui.result).confirmed, false, `${changed} change invalidates confirmation`);
}

assert.equal(cmsDocumentVersionsMatch(
    { webpage: { versionId: "a" }, downloadable: { versionId: "b" } },
    { webpage: { versionId: "a" }, downloadable: { versionId: "b" } },
), true);
assert.equal(cmsDocumentVersionsMatch(
    { webpage: { versionId: "a" }, downloadable: { versionId: "b" } },
    { webpage: { versionId: "a" }, downloadable: { versionId: "c" } },
), false);
assert.throws(() => fixture({ status: "content-difference" }).start(), /could-not-verify/);

console.log("Document verification confirmation checks passed.");
