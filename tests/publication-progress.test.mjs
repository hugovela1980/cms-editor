import assert from "node:assert/strict";
import fs from "node:fs";

import {
    createCmsPublicationProgress,
} from "../src/publication-progress.js";

import {
    renderCmsEditorShell,
} from "../src/editor-shell-controller.js";

import {
    CMS_EDITOR_STATES,
} from "../src/editor-workflow.js";

import {
    getCmsStatusSurface,
} from "../src/status-surface.js";

function dataName(name) {
    return name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matches(element, selector) {
    if (selector === "dialog") return element.tagName === "DIALOG";
    const attributes = [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];
    if (!attributes.length) return false;
    return attributes.every(([, name, value]) => {
        const actual = name.startsWith("data-")
            ? element.dataset[dataName(name.slice(5))]
            : element.getAttribute(name);
        return value === undefined ? actual !== undefined && actual !== null : actual === value;
    });
}

class FakeElement {
    constructor(tagName, ownerDocument) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.hidden = false;
        this.disabled = false;
        this.textContent = "";
        this.className = "";
        this.id = "";
    }

    append(...children) {
        for (const child of children) {
            child.parentNode = this;
            this.children.push(child);
        }
    }

    replaceChildren(...children) {
        for (const child of this.children) child.parentNode = null;
        this.children = [];
        this.append(...children);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatch(type) {
        for (const listener of this.listeners.get(type) ?? []) {
            listener({ type, preventDefault() {} });
        }
    }

    querySelectorAll(selector) {
        const result = [];
        for (const child of this.children) {
            if (matches(child, selector)) result.push(child);
            result.push(...child.querySelectorAll(selector));
        }
        return result;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] ?? null;
    }

    focus() {
        this.ownerDocument.activeElement = this;
    }
}

class FakeDocument {
    constructor() {
        this.activeElement = null;
        this.body = new FakeElement("body", this);
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }
}

function stateByStage(shell) {
    return Object.fromEntries(
        shell.querySelectorAll("[data-cms-publication-stage]").map(
            (row) => [row.dataset.cmsPublicationStage, row.dataset.cmsPublicationState],
        ),
    );
}

const documentObject = new FakeDocument();
const shell = documentObject.createElement("section");
documentObject.body.append(shell);
const statusSurface = getCmsStatusSurface(shell);
const progress = createCmsPublicationProgress({ statusSurface });

const first = progress.start();
const more = shell.querySelector("[data-cms-status-more]");
const details = shell.querySelector("[data-cms-status-inline-details]");
assert.equal(details.hidden, true, "publishing starts compact");
assert.equal(more.hidden, false);
assert.equal(more.textContent, "See more…");
assert.equal(more.getAttribute("aria-expanded"), "false");

more.focus();
more.dispatch("click");
assert.equal(details.hidden, false);
assert.equal(more.textContent, "Show less");
assert.equal(more.getAttribute("aria-expanded"), "true");
assert.equal(more.getAttribute("aria-controls"), details.id);
assert.equal(documentObject.activeElement, more, "expansion keeps disclosure focus");
assert.equal(documentObject.body.querySelector("dialog"), null, "inline progress creates no dialog");
assert.equal(stateByStage(shell).preparing, "active");
assert.equal(first.reportProgress("preparing"), false, "host cannot report package-owned preparing");
assert.equal(first.reportProgress("confirmed"), false, "host cannot report package-owned confirmed");

assert.equal(first.reportProgress("creating-version"), true);
assert.deepEqual(stateByStage(shell), {
    preparing: "completed",
    "creating-version": "active",
    "updating-live": "pending",
    "confirming-live": "pending",
    confirmed: "pending",
});
assert.equal(details.hidden, false, "expansion persists across stages");
assert.equal(
    shell.querySelector('[data-cms-publication-state="active"]').getAttribute("aria-current"),
    "step",
);

assert.equal(first.reportProgress("updating-live"), true);
assert.equal(stateByStage(shell)["updating-live"], "active");
assert.equal(first.reportProgress("creating-version"), false, "stages cannot move backward");
assert.equal(stateByStage(shell)["updating-live"], "active");
assert.equal(first.reportProgress("provider-specific-stage"), false, "unknown stages are ignored");

assert.equal(first.reportProgress("confirming-live"), true);
assert.equal(stateByStage(shell)["confirming-live"], "active");
assert.equal(progress.succeed(first), true);
assert.ok(
    Object.values(stateByStage(shell)).every((state) => state === "completed"),
    "success completes every stage",
);
assert.equal(shell.querySelector("[data-cms-editor-feedback]").textContent, "Website published");
assert.equal(details.hidden, false, "expanded success remains visible");

// Subsequent work permanently retires retained completion details.
statusSurface.set("workflow", {
    message: "Unsaved changes",
    priority: 50,
});
assert.equal(shell.querySelector("[data-cms-editor-feedback]").textContent, "Unsaved changes");
assert.equal(progress.clearCompleted(), true);
statusSurface.set("workflow", {
    message: "Saved",
    priority: 10,
});
assert.equal(shell.querySelector("[data-cms-editor-feedback]").textContent, "Saved");
assert.equal(more.hidden, true, "retired completion details cannot resurface");
assert.equal(details.hidden, true);
assert.equal(progress.clearCompleted(), false);

const second = progress.start();
assert.equal(details.hidden, true, "a new publication starts collapsed");
assert.equal(first.reportProgress("confirmed"), false, "stale reports cannot replace a newer operation");
assert.equal(stateByStage(shell).preparing, "active");
assert.equal(progress.clearCompleted(), false, "editing cannot retire active publication progress");

more.dispatch("click");
assert.equal(details.hidden, false);
more.dispatch("click");
assert.equal(details.hidden, true);
assert.equal(more.textContent, "See more…");
assert.equal(more.getAttribute("aria-expanded"), "false");

// Existing publishing workflow keeps ordinary fields enabled.
const editingRoot = documentObject.createElement("div");
const field = documentObject.createElement("input");
field.dataset.cmsFieldKey = "heading";
editingRoot.append(field);
renderCmsEditorShell({
    shell,
    editingRoot,
    snapshot: {
        state: CMS_EDITOR_STATES.PUBLISHING,
        hasUnsavedChanges: true,
        lastCleanState: CMS_EDITOR_STATES.SAVED,
        message: null,
        error: null,
    },
});
assert.equal(field.disabled, false);

assert.equal(second.reportProgress("creating-version"), true);
assert.equal(progress.succeed(second), true);
statusSurface.set("workflow", {
    message: "Unsaved changes",
    priority: 50,
});
assert.equal(
    shell.querySelector("[data-cms-editor-feedback]").textContent,
    "Unsaved changes",
    "newer dirty work is authoritative after publication succeeds",
);
assert.equal(progress.clearCompleted(), true, "later save/reconciliation retires completion");
statusSurface.set("workflow", {
    message: "Saved",
    priority: 10,
});
assert.equal(shell.querySelector("[data-cms-editor-feedback]").textContent, "Saved");
assert.equal(more.hidden, true, "old completion stays retired after Saved becomes lower priority");

// Starting another publication replaces retained completion and resets disclosure.
const third = progress.start();
third.reportProgress("confirming-live");
progress.succeed(third);
more.dispatch("click");
assert.equal(details.hidden, false);
const fourth = progress.start();
assert.equal(details.hidden, true);
assert.equal(third.reportProgress("confirming-live"), false);
progress.fail(fourth);
assert.equal(details.hidden, true, "failure removes normal progress disclosure");

const css = fs.readFileSync(
    new URL("../styles/cms-editor.css", import.meta.url),
    "utf8",
);
assert.match(css, /\.cms-status-strip__details\s*\{[^}]*grid-column:\s*1 \/ -1/s);
assert.doesNotMatch(
    css.match(/\.cms-status-strip__details\s*\{[^}]*\}/s)?.[0] ?? "",
    /position:\s*(?:fixed|absolute)/,
);

console.log("Publication progress checks passed.");
