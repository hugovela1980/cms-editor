let confirmationSequence = 0;

const COPY = Object.freeze({
    save: {
        eyebrow: "Save draft",
        title: "Save these changes?",
        message: "Your changes will be saved to the draft. The public website will not change until you publish.",
        confirmLabel: "Save Draft",
    },
    revertToSaved: {
        eyebrow: "Revert changes",
        title: "Discard unsaved changes?",
        message: "The editor will return to the last saved draft.",
        confirmLabel: "Revert Changes",
    },
    revertToPublished: {
        eyebrow: "Revert changes",
        title: "Revert draft to published?",
        message: "The saved draft will be replaced with the currently published content. The public website will not change.",
        confirmLabel: "Revert Changes",
    },
    publish: {
        eyebrow: "Publish website",
        title: "Publish the saved draft?",
        message: "The saved draft will become the public website.",
        confirmLabel: "Publish Website",
    },
});

export function getCmsWorkflowConfirmationCopy({
    kind,
    revertToSaved = false,
}) {
    if (kind === "revert") {
        return revertToSaved
            ? COPY.revertToSaved
            : COPY.revertToPublished;
    }

    return COPY[kind];
}

export function showCmsWorkflowConfirmation({
    kind,
    draftNote = false,
    draftNoteLabel = "Draft note (optional)",
    revertToSaved = false,
    documentObject = document,
}) {
    const copy = getCmsWorkflowConfirmationCopy({
        kind,
        revertToSaved,
    });
    if (!copy) {
        throw new Error(`Unknown CMS workflow confirmation kind "${kind}".`);
    }

    return new Promise((resolve) => {
        const dialog = documentObject.createElement("dialog");
        const titleId = `cms-workflow-confirmation-${++confirmationSequence}`;
        dialog.className = "cms-save-confirmation cms-workflow-confirmation";
        dialog.setAttribute("aria-labelledby", titleId);

        const form = documentObject.createElement("form");
        form.method = "dialog";
        form.className = "cms-save-confirmation__panel";
        const eyebrow = documentObject.createElement("p");
        eyebrow.className = "cms-save-confirmation__eyebrow";
        eyebrow.textContent = copy.eyebrow;
        const title = documentObject.createElement("h2");
        title.id = titleId;
        title.textContent = copy.title;
        const message = documentObject.createElement("p");
        message.textContent = copy.message;
        form.append(eyebrow, title, message);

        let noteControl = null;
        if (kind === "save" && draftNote) {
            const label = documentObject.createElement("label");
            label.className = "cms-workflow-confirmation__note";
            const labelText = documentObject.createElement("span");
            labelText.textContent = draftNoteLabel;
            noteControl = documentObject.createElement("textarea");
            noteControl.name = "draftNote";
            noteControl.rows = 3;
            label.append(labelText, noteControl);
            form.append(label);
        }

        const actions = documentObject.createElement("div");
        actions.className = "cms-save-confirmation__actions";
        const cancel = documentObject.createElement("button");
        cancel.type = "button";
        cancel.className = "cms-modal__cancel";
        cancel.textContent = "Cancel";
        const confirm = documentObject.createElement("button");
        confirm.type = "submit";
        confirm.className = "cms-save-confirmation__confirm";
        confirm.textContent = copy.confirmLabel;
        actions.append(cancel, confirm);
        form.append(actions);
        dialog.append(form);

        let settled = false;
        const finish = (confirmed) => {
            if (settled) return;
            settled = true;
            const note = noteControl?.value.trim() ?? "";
            dialog.remove();
            resolve({
                confirmed,
                ...(confirmed && draftNote
                    ? { saveData: { draftNote: note } }
                    : {}),
            });
        };
        const close = () => {
            if (typeof dialog.close === "function" && dialog.open) {
                dialog.close();
            } else {
                finish(false);
            }
        };

        cancel.addEventListener("click", close);
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            close();
        });
        dialog.addEventListener("close", () => finish(false), { once: true });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            finish(true);
        });

        documentObject.body.append(dialog);
        if (typeof dialog.showModal === "function") {
            dialog.showModal();
        } else {
            dialog.setAttribute("open", "");
        }
        (noteControl ?? confirm).focus();
    });
}

function normalizeConfirmation(value) {
    if (value === true) return {};
    if (!value || typeof value !== "object") return null;
    return value;
}

export function createCmsWorkflowConfirmers({
    configuration,
    documentObject,
    revertToSaved = false,
    showConfirmation = showCmsWorkflowConfirmation,
}) {
    const save = normalizeConfirmation(configuration?.save);
    const revert = normalizeConfirmation(configuration?.revert);
    const publish = normalizeConfirmation(configuration?.publish);

    return {
        confirmSave: save
            ? () => showConfirmation({
                kind: "save",
                draftNote: save.draftNote === true,
                draftNoteLabel: save.draftNoteLabel,
                documentObject,
            })
            : null,
        confirmRevert: revert
            ? async () => (await showConfirmation({
                kind: "revert",
                revertToSaved,
                documentObject,
            })).confirmed
            : null,
        confirmPublish: publish
            ? async () => (await showConfirmation({
                kind: "publish",
                documentObject,
            })).confirmed
            : null,
    };
}
