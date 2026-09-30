import assert from "node:assert/strict";

import {
    installCmsPreviewNavigationEvents,
} from "../src/preview-navigation-events.js";

function createControl(documentObject) {
    const listeners = new Map();
    return {
        ownerDocument: documentObject,
        addEventListener(name, listener) {
            const entries = listeners.get(name) ?? [];
            entries.push(listener);
            listeners.set(name, entries);
        },
        removeEventListener(name, listener) {
            listeners.set(
                name,
                (listeners.get(name) ?? []).filter(
                    (candidate) => candidate !== listener,
                ),
            );
        },
        dispatch(name) {
            for (const listener of listeners.get(name) ?? []) {
                listener({ type: name });
            }
        },
    };
}

const documentObject = { activeElement: null };
const control = createControl(documentObject);
let navigationCount = 0;
installCmsPreviewNavigationEvents({
    control,
    documentObject,
    navigate() {
        navigationCount += 1;
    },
});

// Keyboard/programmatic focus navigates.
documentObject.activeElement = control;
control.dispatch("focus");
assert.equal(navigationCount, 1);

// A pointer action that initially focuses the control navigates only once.
documentObject.activeElement = null;
control.dispatch("pointerdown");
documentObject.activeElement = control;
control.dispatch("focus");
control.dispatch("click");
assert.equal(navigationCount, 2);

// Clicking the already-focused control navigates again.
control.dispatch("pointerdown");
control.dispatch("click");
assert.equal(navigationCount, 3);

// Editing events are deliberately outside the navigation contract.
control.dispatch("input");
control.dispatch("change");
assert.equal(navigationCount, 3);

console.log("Preview navigation event checks passed.");
