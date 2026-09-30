import assert from "node:assert/strict";

import {
    createCmsWorkflowConfirmers,
    getCmsWorkflowConfirmationCopy,
} from "../src/workflow-confirmation.js";

const calls = [];
const showConfirmation = async (options) => {
    calls.push(options);
    return options.kind === "save"
        ? { confirmed: true, saveData: { draftNote: "Launch copy" } }
        : { confirmed: options.kind === "revert" };
};
const documentObject = {};
const confirmers = createCmsWorkflowConfirmers({
    configuration: {
        save: { draftNote: true },
        revert: true,
        publish: true,
    },
    documentObject,
    showConfirmation,
});

assert.deepEqual(await confirmers.confirmSave(), {
    confirmed: true,
    saveData: { draftNote: "Launch copy" },
});
assert.equal(await confirmers.confirmRevert(), true);
assert.equal(await confirmers.confirmPublish(), false);
assert.deepEqual(calls.map(({ kind }) => kind), ["save", "revert", "publish"]);
assert.equal(calls[0].draftNote, true);
assert.equal(calls[0].documentObject, documentObject);

const disabled = createCmsWorkflowConfirmers({
    configuration: null,
    documentObject,
    showConfirmation,
});
assert.equal(disabled.confirmSave, null);
assert.equal(disabled.confirmRevert, null);
assert.equal(disabled.confirmPublish, null);

const cancelledSave = createCmsWorkflowConfirmers({
    configuration: { save: { draftNote: true } },
    documentObject,
    showConfirmation: async () => ({ confirmed: false }),
});
assert.deepEqual(await cancelledSave.confirmSave(), { confirmed: false });

const discardCopy = getCmsWorkflowConfirmationCopy({
    kind: "revert",
    revertToSaved: true,
});
assert.equal(discardCopy.title, "Discard unsaved changes?");
assert.equal(discardCopy.message, "The editor will return to the last saved draft.");

const publishedCopy = getCmsWorkflowConfirmationCopy({
    kind: "revert",
    revertToSaved: false,
});
assert.equal(publishedCopy.title, "Revert draft to published?");
assert.equal(
    publishedCopy.message,
    "The saved draft will be replaced with the currently published content. The public website will not change.",
);

assert.equal(
    getCmsWorkflowConfirmationCopy({ kind: "save" }).message,
    "Your changes will be saved to the draft. The public website will not change until you publish.",
);

const revertVariants = [];
for (const revertToSaved of [true, false]) {
    const variant = createCmsWorkflowConfirmers({
        configuration: { revert: true },
        documentObject,
        revertToSaved,
        showConfirmation: async (options) => {
            revertVariants.push(options);
            return { confirmed: true };
        },
    });
    assert.equal(await variant.confirmRevert(), true);
}
assert.deepEqual(
    revertVariants.map(({ revertToSaved }) => revertToSaved),
    [true, false],
);

console.log("Workflow confirmation checks passed.");
