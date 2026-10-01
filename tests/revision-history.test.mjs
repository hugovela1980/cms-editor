import assert from "node:assert/strict";
import fs from "node:fs";

import {
    createRevisionHistory,
} from "../src/revision-history.js";

class FakeEvent {
    constructor(type, { bubbles = false } = {}) {
        this.type = type;
        this.bubbles = bubbles;
        this.defaultPrevented = false;
    }

    preventDefault() {
        this.defaultPrevented = true;
    }
}

class FakeElement {
    constructor(tagName, ownerDocument) {
        this.tagName = tagName.toUpperCase();
        this.ownerDocument = ownerDocument;
        this.children = [];
        this.parentNode = null;
        this.attributes = new Map();
        this.listeners = new Map();
        this.textContent = "";
        this.className = "";
        this.hidden = false;
        this.disabled = false;
        this.open = false;
    }

    get isConnected() {
        let node = this;
        while (node) {
            if (node === this.ownerDocument.body) return true;
            node = node.parentNode;
        }
        return false;
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

    remove() {
        if (!this.parentNode) return;
        this.parentNode.children = this.parentNode.children.filter(
            (child) => child !== this,
        );
        this.parentNode = null;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    getAttribute(name) {
        return this.attributes.get(name) ?? null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    toggleAttribute(name, force) {
        if (force) this.setAttribute(name, "");
        else this.removeAttribute(name);
    }

    addEventListener(type, listener, options = {}) {
        const entries = this.listeners.get(type) ?? [];
        entries.push({ listener, once: options.once === true });
        this.listeners.set(type, entries);
    }

    removeEventListener(type, listener) {
        this.listeners.set(
            type,
            (this.listeners.get(type) ?? []).filter(
                (entry) => entry.listener !== listener,
            ),
        );
    }

    dispatchEvent(event) {
        for (const entry of [...(this.listeners.get(event.type) ?? [])]) {
            entry.listener(event);
            if (entry.once) this.removeEventListener(event.type, entry.listener);
        }
        if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
        return !event.defaultPrevented;
    }

    querySelectorAll(selector) {
        const matches = [];
        for (const child of this.children) {
            if (selector === "button" && child.tagName === "BUTTON") {
                matches.push(child);
            }
            matches.push(...child.querySelectorAll(selector));
        }
        return matches;
    }

    focus() {
        this.ownerDocument.activeElement = this;
    }

    showModal() {
        this.open = true;
    }

    close() {
        this.open = false;
        this.dispatchEvent(new FakeEvent("close"));
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

function findButton(root, label) {
    return root.querySelectorAll("button").find(
        (button) => button.textContent === label,
    ) ?? null;
}

function containsText(root, text) {
    return root.textContent === text || root.children.some(
        (child) => containsText(child, text),
    );
}

async function settle() {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

async function openRevisionFixture({
    revision,
    baseline = false,
}) {
    const documentObject = new FakeDocument();
    const container = documentObject.createElement("div");
    documentObject.body.append(container);
    const restoreCalls = [];
    const confirmations = [];
    const provider = {
        async list() {
            return {
                head: "head-1",
                nextPage: null,
                baseline: baseline ? revision : null,
                highlighted: null,
                revisions: baseline ? [] : [revision],
            };
        },
        async view(id) {
            return {
                draftVersion: "draft-1",
                revision: {
                    ...revision,
                    id,
                    values: { "hero.title": "Earlier title" },
                },
            };
        },
        async restore(id, draftVersion) {
            restoreCalls.push({ id, draftVersion });
            return {
                draft: { hero: { title: "Earlier title" } },
                draftVersion: "draft-2",
            };
        },
    };
    const windowObject = {
        Event: FakeEvent,
        confirm(message) {
            confirmations.push(message);
            return true;
        },
    };

    createRevisionHistory({
        container,
        provider,
        documentObject,
        windowObject,
    });
    container.dispatchEvent(new FakeEvent("cms:history-open"));
    await settle();

    const viewLabel = baseline ? "View Baseline" : "View Revision";
    const view = findButton(container, viewLabel);
    assert.ok(view, `${viewLabel} remains available`);
    view.dispatchEvent(new FakeEvent("click"));
    await settle();

    return {
        documentObject,
        restoreCalls,
        confirmations,
    };
}

const currentRevision = {
    id: "current",
    title: "Current version",
    date: "2026-01-01T00:00:00Z",
    current: true,
};

for (const baseline of [false, true]) {
    const fixture = await openRevisionFixture({
        revision: {
            ...currentRevision,
            baseline,
        },
        baseline,
    });
    assert.ok(
        fixture.documentObject.body.children.some(
            (element) => element.tagName === "DIALOG",
        ),
        "current revision remains viewable",
    );
    assert.equal(
        containsText(fixture.documentObject.body, "Current live revision"),
        true,
        "current status remains visibly indicated",
    );
    assert.equal(
        findButton(fixture.documentObject.body, "Restore to Draft"),
        null,
        "current revision does not offer Restore to Draft",
    );
    assert.equal(fixture.restoreCalls.length, 0);
}

const historical = await openRevisionFixture({
    revision: {
        id: "historical",
        title: "Earlier version",
        date: "2025-12-01T00:00:00Z",
        current: false,
    },
});
const restore = findButton(historical.documentObject.body, "Restore to Draft");
assert.ok(restore, "non-current revision remains restorable");
restore.dispatchEvent(new FakeEvent("click"));
await settle();
assert.deepEqual(historical.restoreCalls, [{
    id: "historical",
    draftVersion: "draft-1",
}]);
assert.match(
    historical.confirmations[0],
    /Restore this revision to the draft\?/,
);
assert.match(
    historical.confirmations[0],
    /replace the current draft with this revision/,
);
assert.match(
    historical.confirmations[0],
    /live website will not change until the draft is published/,
);

const source = fs.readFileSync(
    new URL("../src/revision-history.js", import.meta.url),
    "utf8",
);
assert.doesNotMatch(source, /draft note will be kept/i);

console.log("Revision history checks passed.");
