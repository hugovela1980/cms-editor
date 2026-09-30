import assert from "node:assert/strict";

import {
    mountConfiguredRevisionHistory,
} from "../src/revision-integration.js";

function fixture() {
    const action = { disabled: false };
    const container = {};
    const drawer = {
        querySelector(selector) {
            if (selector === "[data-cms-history-open]") return action;
            if (selector === "[data-cms-history-content]") return container;
            return null;
        },
    };
    return { drawer, action, container };
}

const provider = {
    list() {},
    view() {},
    restore() {},
};

{
    const { drawer, action } = fixture();
    assert.equal(mountConfiguredRevisionHistory({
        drawer,
        options: null,
        onStatus() {},
    }), null);
    assert.equal(action.disabled, true);
}

{
    const { drawer, action, container } = fixture();
    const mounts = [];
    const restored = () => {};
    const controller = {};
    const options = { provider, onRestored: restored };
    const createHistory = (received) => {
        mounts.push(received);
        return controller;
    };
    assert.equal(mountConfiguredRevisionHistory({
        drawer,
        options,
        documentObject: {},
        windowObject: {},
        onStatus() {},
        createHistory,
    }), controller);
    assert.equal(action.disabled, false);
    assert.equal(mounts.length, 1);
    assert.equal(mounts[0].container, container);
    assert.equal(mounts[0].provider, provider);
    assert.equal(mounts[0].onRestored, restored);

    assert.equal(mountConfiguredRevisionHistory({
        drawer,
        options,
        onStatus() {},
        createHistory,
    }), controller);
    assert.equal(mounts.length, 1);
}

console.log("Revision integration checks passed.");
