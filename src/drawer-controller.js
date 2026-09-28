import {
    closeCmsDrawer,
    getCmsDrawerSection,
    openCmsDrawer,
} from "./drawer-builder.js";

import {
    getValueAtCmsPath,
    joinCmsContentPath,
} from "./content-path.js";

import {
    validateCmsDrawerControl,
    validateCmsDrawerSubmission,
} from "./drawer-validation.js";

import {
    collectCmsEditorValues,
    hasCmsEditorChanges,
    syncCmsEditorChangedFields,
    syncCmsEditorControlChangeState,
} from "./editor-changes.js";

import {
    CMS_EDITOR_EVENTS,
    CMS_EDITOR_STATES,
} from "./editor-workflow.js";

import {
    CMS_FIELD_TYPES,
} from "./field-types.js";


import {
    applyCmsFieldPreview,
    restoreCmsSectionPreview,
} from "./live-preview.js";

import {
    clearCmsHighlights,
    highlightCmsField,
    highlightCmsSection,
} from "./preview-target.js";

import {
    writeCmsPreviewPreference,
} from "./preview-preference.js";

import {
    clearCmsControlValidation,
    clearCmsDrawerValidation,
    hasCmsDrawerValidationErrors,
    renderCmsDrawerValidationErrors,
    showCmsControlValidationError,
} from "./validation-ui.js";

import {
    createCmsTransientStateSnapshot,
    isCmsTransientStateSnapshot,
} from "./transient-state.js";

function findSectionEntry(
    sectionEntries,
    sectionPath,
) {
    return sectionEntries.find(
        (entry) =>
            entry.sectionPath ===
            sectionPath,
    ) ?? null;
}

function getCurrentControlValue(
    control,
) {
    return control.value ?? "";
}

function getPreviewControlValue(
    control,
    field,
) {
    if (
        field?.type === CMS_FIELD_TYPES.IMAGE &&
        control.dataset.cmsPreviewValue
    ) {
        return control.dataset.cmsPreviewValue;
    }

    return getCurrentControlValue(control);
}

function syncImageControlDisplay(control) {
    const wrapper = control.closest?.(".cms-field--image");
    if (!wrapper) return;

    const preview = wrapper.querySelector("[data-cms-image-preview]");
    const current = wrapper.querySelector("[data-cms-image-current]");

    if (preview) {
        preview.src =
            control.dataset.cmsPreviewValue ||
            control.value ||
            "";
    }

    if (current) {
        current.textContent =
            control.value ||
            "No image selected";
    }
}

function findField(
    entry,
    fieldKey,
) {
    return entry.schema.fields.find(
        (candidate) =>
            candidate.key ===
            fieldKey,
    ) ?? null;
}

function applyAllDrawerPreviews({
    drawer,
    sectionEntries,
}) {
    const controls =
        drawer.querySelectorAll(
            "[data-cms-field-key]",
        );

    for (const control of controls) {
        const entry =
            findSectionEntry(
                sectionEntries,
                control.dataset.cmsSectionPath,
            );

        if (!entry) {
            continue;
        }

        const field =
            findField(
                entry,
                control.dataset.cmsFieldKey,
            );

        if (!field) {
            continue;
        }

        applyCmsFieldPreview({
            section:
                entry.section,

            field,

            value:
                getPreviewControlValue(
                    control,
                    field,
                ),
        });
    }
}

function restoreAllSavedPreviews({
    sectionEntries,
    editorState,
}) {
    const savedContent =
        editorState.getSavedContent();

    for (const entry of sectionEntries) {
        restoreCmsSectionPreview({
            section:
                entry.section,

            sectionPath:
                entry.sectionPath,

            schema:
                entry.schema,

            siteContent:
                savedContent,
        });
    }
}

function restoreAllPublishedPreviews({
    sectionEntries,
    editorState,
}) {
    const publishedContent =
        editorState.getPublishedContent();

    for (const entry of sectionEntries) {
        restoreCmsSectionPreview({
            section: entry.section,
            sectionPath: entry.sectionPath,
            schema: entry.schema,
            siteContent: publishedContent,
        });
    }
}

function syncDrawerControlsFromContent({
    drawer,
    sectionEntries,
    content,
    resolveImagePreviewUrl = null,
}) {
    const controls =
        drawer.querySelectorAll(
            "[data-cms-field-key]",
        );

    for (const control of controls) {
        const sectionPath =
            control.dataset.cmsSectionPath;

        const fieldKey =
            control.dataset.cmsFieldKey;

        const entry =
            findSectionEntry(
                sectionEntries,
                sectionPath,
            );

        if (
            !entry ||
            !findField(entry, fieldKey)
        ) {
            continue;
        }

        const fullPath =
            joinCmsContentPath(
                sectionPath,
                fieldKey,
            );

        const value =
            getValueAtCmsPath(
                content,
                fullPath,
            );

        control.value =
            value === null ||
                value === undefined
                ? ""
                : String(value);

        const field = findField(entry, fieldKey);
        if (field?.type === CMS_FIELD_TYPES.IMAGE) {
            const previewValue =
                typeof resolveImagePreviewUrl === "function"
                    ? resolveImagePreviewUrl({
                        sectionPath,
                        field,
                        value,
                    })
                    : value;

            if (previewValue) {
                control.dataset.cmsPreviewValue =
                    String(previewValue);
            } else {
                delete control.dataset.cmsPreviewValue;
            }
            syncImageControlDisplay(control);
        }
    }
}

function refreshControlValidation({
    control,
    sectionEntries,
}) {
    const result =
        validateCmsDrawerControl({
            control,
            sectionEntries,
        });

    clearCmsControlValidation(
        control,
    );

    const firstError =
        result.errors[0];

    if (firstError) {
        showCmsControlValidationError(
            control,
            firstError,
        );
    }

    return result;
}

/**
 * @param {{
 *   drawer: HTMLElement,
 *   sectionEntries: Array<any>,
 *   editorState: any,
 *   workflow: any,
 *   initialShowPreview: boolean,
 *   previewStorage?: Storage | null
 * }} options
 */
export function installCmsDrawerController(
    options,
) {
    const {
        drawer,
        sectionEntries,
        editorState,
        workflow,
        initialShowPreview,
        previewStorage = null,
        saveChanges = null,
        confirmSave = null,
        saveSuccessMessage = null,
        revertToSaved = false,
        confirmRevert = null,
        revertChanges = null,
        revertSuccessMessage = null,
        confirmPublish = null,
        publishChanges = null,
        publishSuccessMessage = null,
        uploadImage = null,
        onImageUploadStatus = null,
        resolveImagePreviewUrl = null,
        confirmDiscard = null,
        hasSavedDraft = false,
    } = options;

    let showPreview =
        initialShowPreview;

    let sectionSummarySelectionDismissed =
        false;

    let saveConfirmationPending =
        false;

    const uploadedImagePaths = new Set();
    const supersededUploadedImagePaths = new Set();

    /** @type {HTMLElement | null} */
    let openTrigger =
        null;

    const documentObject =
        drawer.ownerDocument;

    const storage =
        previewStorage ??
        documentObject
            .defaultView
            ?.localStorage ??
        null;

    const closeButton =
        drawer.querySelector(
            "[data-cms-drawer-close]",
        );

    const previewToggle =
        drawer.querySelector(
            "[data-cms-preview-toggle]",
        );

    const localSaveButton =
        drawer.querySelector(
            "[data-cms-save-local]",
        );

    const revertButton =
        drawer.querySelector(
            "[data-cms-revert-live]",
        );

    const publishButton =
        drawer.querySelector(
            "[data-cms-save-deploy]",
        );

    const detailsElements =
        Array.from(
            drawer.querySelectorAll(
                "[data-cms-drawer-section]",
            ),
        );

    function updateWorkflowDirtyState({
        allowErrorExit = false,
    } = {}) {
        const dirty =
            hasCmsEditorChanges({
                editingRoot:
                    drawer,
                editorState,
            });

        const snapshot =
            workflow.getSnapshot();

        if (
            snapshot.state ===
            CMS_EDITOR_STATES.ERROR &&
            dirty &&
            !allowErrorExit
        ) {
            return dirty;
        }

        workflow.send(
            CMS_EDITOR_EVENTS
                .FORM_CHANGED,
            {
                dirty,
            },
        );

        return dirty;
    }

    function refreshChangedFieldState(
        control = null,
    ) {
        if (control) {
            const changed =
                syncCmsEditorControlChangeState({
                    control,
                    editorState,
                });

            refreshChangedSectionState();

            return changed;
        }

        const changedCount =
            syncCmsEditorChangedFields({
                editingRoot:
                    drawer,
                editorState,
            });

        refreshChangedSectionState();

        return changedCount;
    }

    function refreshChangedSectionState() {
        const detailsElements =
            drawer.querySelectorAll(
                "[data-cms-drawer-section]",
            );

        for (
            const details
            of detailsElements
        ) {
            const hasUnsavedChanges =
                Boolean(
                    details.querySelector(
                        '[data-cms-unsaved-change="true"]',
                    ),
                );

            if (hasUnsavedChanges) {
                details.dataset
                    .cmsHasUnsavedChanges =
                    "true";
            } else {
                delete details.dataset
                    .cmsHasUnsavedChanges;
            }
        }
    }

    function collectChangedValidatedEntries({
    validationEntries,
    editorState,
}) {
    return validationEntries.filter(
        ({ path, value }) =>
            String(value ?? "") !==
            String(
                editorState.getSavedValue(
                    path,
                ) ?? "",
            ),
    );
}

function describeChangedSections({
    changedEntries,
    sectionEntries,
}) {
    return sectionEntries
        .filter(({ sectionPath }) =>
            changedEntries.some(
                ({ path }) =>
                    path === sectionPath ||
                    path.startsWith(
                        `${sectionPath}.`,
                    ),
            ),
        )
        .map(({ sectionPath, schema }) => ({
            sectionPath,
            schemaId:
                schema.id,
            label:
                schema.label,
        }));
}

function getFirstValidationMessage() {
        return drawer.querySelector(
            "[data-cms-field-error]:not([hidden])",
        )?.textContent?.trim() ||
            "Please correct the highlighted validation errors before saving.";
    }

    function closeEditor() {
        closeCmsDrawer(
            drawer,
        );

        clearCmsHighlights(
            documentObject,
        );

        if (openTrigger) {
            openTrigger.setAttribute?.(
                "aria-expanded",
                "false",
            );

            if (
                typeof openTrigger.focus ===
                "function"
            ) {
                openTrigger.focus();
            }
        }

        openTrigger =
            null;
    }

    closeButton.addEventListener(
        "click",
        closeEditor,
    );

    drawer.addEventListener(
        "keydown",
        (event) => {
            if (
                event.defaultPrevented || event.key !==
                "Escape"
            ) {
                return;
            }

            if (
                !drawer.classList.contains(
                    "cms-drawer--open",
                )
            ) {
                return;
            }

            event.preventDefault();
            closeEditor();
        },
    );

    previewToggle.addEventListener(
        "change",
        () => {
            if (workflow.isLocalEditingBusy?.() ?? workflow.isBusy()) {
                return;
            }

            showPreview =
                previewToggle.checked;

            if (storage) {
                writeCmsPreviewPreference(
                    showPreview,
                    storage,
                );
            }

            if (showPreview) {
                applyAllDrawerPreviews({
                    drawer,
                    sectionEntries,
                });
            } else {
                restoreAllPublishedPreviews({
                    sectionEntries,
                    editorState,
                });
            }
        },
    );

    localSaveButton.addEventListener(
        "click",
        async () => {
            if (workflow.isBusy() || saveConfirmationPending) {
                return;
            }

            const dirty =
                updateWorkflowDirtyState();

            if (!dirty) {
                return;
            }

            const validation =
                validateCmsDrawerSubmission({
                    drawer,
                    sectionEntries,
                });

            if (!validation.valid) {
                renderCmsDrawerValidationErrors({
                    drawer,
                    errors:
                        validation.errors,
                    focusFirst:
                        true,
                });

                const count =
                    validation.errors.length;

                workflow.send(
                    CMS_EDITOR_EVENTS
                        .VALIDATION_FAILED,
                    {
                        message:
                            count === 1
                                ? "Please correct 1 validation error before saving."
                                : `Please correct ${count} validation errors before saving.`,
                    },
                );

                return;
            }

            const changedEntries =
                collectChangedValidatedEntries({
                    validationEntries:
                        validation.entries,
                    editorState,
                });

            const changedSections =
                describeChangedSections({
                    changedEntries,
                    sectionEntries,
                });

            const saveRequest = {
                changes:
                    changedEntries.map(
                        ({ path, value }) => ({
                            path,
                            value,
                        }),
                    ),
                sections:
                    changedSections,
                cleanupCandidates:
                    [...supersededUploadedImagePaths],
            };

            if (
                typeof confirmSave ===
                "function"
            ) {
                let confirmation = false;

                saveConfirmationPending = true;
                try {
                    confirmation =
                        await confirmSave(
                            saveRequest,
                        );
                } catch (error) {
                    workflow.send(
                        CMS_EDITOR_EVENTS.FAIL,
                        {
                            operation:
                                "saving",
                            message:
                                error instanceof Error
                                    ? error.message
                                    : "Unable to confirm the save.",
                        },
                    );
                    return;
                } finally {
                    saveConfirmationPending = false;
                }

                if (workflow.isBusy()) {
                    return;
                }

                const confirmed =
                    typeof confirmation === "object" && confirmation !== null
                        ? confirmation.confirmed !== false
                        : Boolean(confirmation);

                if (!confirmed) {
                    return;
                }

                if (
                    typeof confirmation === "object" &&
                    confirmation !== null &&
                    "saveData" in confirmation
                ) {
                    saveRequest.saveData =
                        confirmation.saveData;
                }
            }

            clearCmsDrawerValidation(
                drawer,
            );

            workflow.send(
                CMS_EDITOR_EVENTS
                    .SAVE_START,
            );

            try {
                if (
                    typeof saveChanges ===
                    "function"
                ) {
                    await saveChanges(
                        saveRequest,
                    );
                }

                supersededUploadedImagePaths.clear();

                editorState.saveValues(
                    validation.entries,
                );

                if (showPreview) {
                    applyAllDrawerPreviews({
                        drawer,
                        sectionEntries,
                    });
                } else {
                    restoreAllPublishedPreviews({
                        sectionEntries,
                        editorState,
                    });
                }

                onImageUploadStatus?.(null);

                refreshChangedFieldState();

                workflow.send(
                    CMS_EDITOR_EVENTS
                        .SAVE_SUCCESS,
                    {
                        message:
                            saveSuccessMessage ??
                            (saveChanges
                                ? "Draft changes saved permanently."
                                : "Current changes saved for this browser session."),
                    },
                );
            } catch (error) {
                workflow.send(
                    CMS_EDITOR_EVENTS.FAIL,
                    {
                        operation:
                            "saving",

                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to save changes.",
                    },
                );
            }
        },
    );

    publishButton?.addEventListener(
        "click",
        async () => {
            if (workflow.isBusy()) {
                return;
            }

            if (typeof confirmPublish === "function") {
                try {
                    const confirmed = await confirmPublish();
                    if (!confirmed) return;
                } catch {
                    return;
                }
            }

            workflow.send(
                CMS_EDITOR_EVENTS.PUBLISH_START,
                {
                    message: "Publishing the saved draft to the public website…",
                },
            );

            try {
                if (typeof publishChanges === "function") {
                    await publishChanges();
                }

                workflow.send(
                    CMS_EDITOR_EVENTS.PUBLISH_SUCCESS,
                    {
                        message:
                            publishSuccessMessage ??
                            "The public website has been published successfully.",
                    },
                );
            } catch (error) {
                workflow.send(
                    CMS_EDITOR_EVENTS.FAIL,
                    {
                        operation: "publishing",
                        message:
                            error instanceof Error
                                ? error.message
                                : "Unable to publish the website.",
                    },
                );
            }
        },
    );

    revertButton.addEventListener(
        "click",
        async () => {
            if (workflow.isBusy()) {
                return;
            }

            if (typeof confirmRevert === "function") {
                try {
                    const confirmed = await confirmRevert();
                    if (!confirmed) return;
                } catch {
                    return;
                }
            }

            const previousDisabled = revertButton.disabled;
            revertButton.disabled = true;

            try {
                if (typeof revertChanges === "function") {
                    await revertChanges();
                }

                const revertedContent =
                    revertToSaved
                        ? editorState.getSavedContent()
                        : editorState.revertToPublished();

                clearCmsDrawerValidation(
                    drawer,
                );

                syncDrawerControlsFromContent({
                    drawer,
                    sectionEntries,
                    content:
                        revertedContent,
                    resolveImagePreviewUrl,
                });

                if (showPreview) {
                    restoreAllSavedPreviews({
                        sectionEntries,
                        editorState,
                    });
                } else {
                    restoreAllPublishedPreviews({
                        sectionEntries,
                        editorState,
                    });
                }

                refreshChangedFieldState();

                workflow.send(
                    CMS_EDITOR_EVENTS.REVERT,
                    {
                        message:
                            revertSuccessMessage ??
                            (revertToSaved
                                ? "Unsaved changes discarded."
                                : "Reverted to live content for this browser session."),
                    },
                );
            } catch (error) {
                const feedback = drawer.querySelector(
                    "[data-cms-editor-feedback]",
                );
                if (feedback) {
                    feedback.textContent =
                        error instanceof Error
                            ? error.message
                            : "Unable to revert the saved draft.";
                    feedback.setAttribute("role", "alert");
                    feedback.setAttribute("aria-live", "assertive");
                }
            } finally {
                revertButton.disabled = previousDisabled;
            }
        },
    );

    for (
        const details
        of detailsElements
    ) {
        details.addEventListener(
            "toggle",
            () => {
                if (!details.open) {
                    return;
                }

                if (
                    !drawer.classList.contains(
                        "cms-drawer--open",
                    )
                ) {
                    return;
                }

                if (!sectionSummarySelectionDismissed) {
                    sectionSummarySelectionDismissed =
                        true;

                    for (
                        const currentDetails
                        of detailsElements
                    ) {
                        delete currentDetails.dataset
                            .cmsCurrentSection;
                    }
                }

                for (
                    const otherDetails
                    of detailsElements
                ) {
                    if (
                        otherDetails !==
                        details
                    ) {
                        otherDetails.open =
                            false;
                    }
                }

                const sectionPath =
                    details.dataset
                        .cmsDrawerSection;

                const entry =
                    findSectionEntry(
                        sectionEntries,
                        sectionPath,
                    );

                if (entry) {
                    highlightCmsSection(
                        entry.section,
                        documentObject,
                    );
                }
            },
        );
    }

    const controls =
        drawer.querySelectorAll(
            "[data-cms-field-key]",
        );

    for (const control of controls) {
        control.addEventListener(
            "focus",
            () => {
                const entry =
                    findSectionEntry(
                        sectionEntries,
                        control.dataset
                            .cmsSectionPath,
                    );

                if (!entry) {
                    return;
                }

                highlightCmsField(
                    entry.section,
                    control.dataset
                        .cmsFieldKey,
                    documentObject,
                );
            },
        );

        control.addEventListener(
            "blur",
            () => {
                const validation =
                    refreshControlValidation({
                        control,
                        sectionEntries,
                    });

                refreshChangedFieldState(
                    control,
                );

                if (!validation.valid) {
                    workflow.send(
                        CMS_EDITOR_EVENTS
                            .VALIDATION_FAILED,
                        {
                            message:
                                validation.errors[0]
                                    ?.message ??
                                "Please correct this field before saving.",
                        },
                    );
                } else if (
                    hasCmsDrawerValidationErrors(
                        drawer,
                    )
                ) {
                    workflow.send(
                        CMS_EDITOR_EVENTS
                            .VALIDATION_FAILED,
                        {
                            message:
                                getFirstValidationMessage(),
                        },
                    );
                } else {
                    updateWorkflowDirtyState({
                        allowErrorExit:
                            true,
                    });
                }

                const entry =
                    findSectionEntry(
                        sectionEntries,
                        control.dataset
                            .cmsSectionPath,
                    );

                if (
                    entry &&
                    drawer.classList.contains(
                        "cms-drawer--open",
                    )
                ) {
                    highlightCmsSection(
                        entry.section,
                        documentObject,
                    );
                }
            },
        );

        control.addEventListener(
            "input",
            () => {
                if (workflow.isLocalEditingBusy?.() ?? workflow.isBusy()) {
                    return;
                }

                refreshChangedFieldState(
                    control,
                );

                updateWorkflowDirtyState();

                if (!showPreview) {
                    return;
                }

                const entry =
                    findSectionEntry(
                        sectionEntries,
                        control.dataset
                            .cmsSectionPath,
                    );

                if (!entry) {
                    return;
                }

                const field =
                    findField(
                        entry,
                        control.dataset
                            .cmsFieldKey,
                    );

                if (!field) {
                    return;
                }

                applyCmsFieldPreview({
                    section:
                        entry.section,

                    field,

                    value:
                        getPreviewControlValue(
                            control,
                            field,
                        ),
                });
            },
        );
    }

    const imageFileInputs =
        drawer.querySelectorAll(
            "[data-cms-image-file]",
        );

    for (const fileInput of imageFileInputs) {
        const sectionPath =
            fileInput.dataset.cmsSectionPath;
        const fieldKey =
            fileInput.dataset.cmsImageFieldKey;
        const entry =
            findSectionEntry(
                sectionEntries,
                sectionPath,
            );
        const field =
            entry
                ? findField(entry, fieldKey)
                : null;
        const control =
            Array.from(controls).find(
                (candidate) =>
                    candidate.dataset.cmsSectionPath === sectionPath &&
                    candidate.dataset.cmsFieldKey === fieldKey,
            );
        const wrapper =
            fileInput.closest?.(".cms-field--image");
        const status =
            wrapper?.querySelector(
                "[data-cms-image-status]",
            );

        if (typeof uploadImage !== "function") {
            fileInput.disabled = true;
            if (status) {
                status.textContent =
                    "Image replacement is available on the authenticated editor site.";
            }
            continue;
        }

        fileInput.addEventListener(
            "change",
            async () => {
                if (workflow.isBusy()) {
                    fileInput.value = "";
                    return;
                }

                const file = fileInput.files?.[0];
                if (!file || !field || !control) return;

                if (
                    Array.isArray(field.accept) &&
                    !field.accept.includes(file.type)
                ) {
                    if (status) {
                        status.textContent =
                            "Choose a PNG, JPEG, or WebP image.";
                    }
                    fileInput.value = "";
                    return;
                }

                if (
                    Number.isInteger(field.maxBytes) &&
                    file.size > field.maxBytes
                ) {
                    if (status) {
                        status.textContent =
                            "That image is larger than the allowed upload size.";
                    }
                    fileInput.value = "";
                    return;
                }

                const previousValue = control.value;
                const previousPreview =
                    control.dataset.cmsPreviewValue;
                const previousSaveDisabled = localSaveButton?.disabled;
                const previousPublishDisabled = publishButton?.disabled;
                const previousRevertDisabled = revertButton?.disabled;
                const attemptUpload = async () => {
                    let uploadSucceeded = false;
                    fileInput.disabled = true;
                    if (localSaveButton) localSaveButton.disabled = true;
                    if (publishButton) publishButton.disabled = true;
                    if (revertButton) revertButton.disabled = true;
                    if (status) status.textContent = "";

                    onImageUploadStatus?.({
                        state: "uploading",
                        message: "Uploading image",
                        supporting: "Keep this editor open while the replacement is prepared.",
                    });

                    try {
                        const result = await uploadImage({
                            sectionPath,
                            schemaId: entry.schema.id,
                            fieldKey,
                            file,
                        });

                        if (
                            !result ||
                            typeof result.src !== "string" ||
                            result.src.trim() === ""
                        ) {
                            throw new Error(
                                "The image upload completed without a usable image path.",
                            );
                        }

                        control.value = result.src;
                        control.dataset.cmsPreviewValue =
                            String(result.previewUrl || result.src);
                        syncImageControlDisplay(control);

                        if (uploadedImagePaths.has(previousValue)) {
                            supersededUploadedImagePaths.add(previousValue);
                        }
                        uploadedImagePaths.add(result.src);

                        const EventConstructor =
                            documentObject.defaultView?.Event;
                        if (EventConstructor) {
                            control.dispatchEvent(
                                new EventConstructor(
                                    "input",
                                    { bubbles: true },
                                ),
                            );
                        }

                        uploadSucceeded = true;
                        onImageUploadStatus?.({
                            state: "uploaded",
                            message: "Unsaved changes",
                            supporting: "Image uploaded. Save Draft to keep this replacement in the shared draft.",
                        });

                        if (status) status.textContent = "";
                    } catch (error) {
                        const previewChanged =
                            control.value !== previousValue ||
                            control.dataset.cmsPreviewValue !== previousPreview;

                        if (previewChanged) {
                            control.value = previousValue;
                            if (previousPreview) {
                                control.dataset.cmsPreviewValue = previousPreview;
                            } else {
                                delete control.dataset.cmsPreviewValue;
                            }
                            syncImageControlDisplay(control);
                        }

                        if (status) status.textContent = "";
                        onImageUploadStatus?.({
                            state: "failed",
                            message: "Image couldn't upload",
                            code: typeof error?.code === "string" ? error.code : null,
                            explanation: error instanceof Error
                                ? error.message
                                : "The image could not be uploaded. The current image was kept.",
                            retry: error?.retryable === true ? attemptUpload : null,
                        });
                    } finally {
                        fileInput.value = "";
                        fileInput.disabled = false;
                        if (!uploadSucceeded) {
                            if (localSaveButton) {
                                localSaveButton.disabled = Boolean(previousSaveDisabled);
                            }
                            if (publishButton) {
                                publishButton.disabled = Boolean(previousPublishDisabled);
                            }
                            if (revertButton) {
                                revertButton.disabled = Boolean(previousRevertDisabled);
                            }
                        }
                    }
                };
                await attemptUpload();
            },
        );
    }

    /**
     * @param {string} sectionPath
     * @param {HTMLElement | null} [trigger]
     */
    function openForSection(
        sectionPath,
        trigger = null,
    ) {
        openTrigger =
            trigger;

        if (openTrigger) {
            openTrigger.setAttribute?.(
                "aria-expanded",
                "true",
            );
        }

        openCmsDrawer(
            drawer,
        );

        sectionSummarySelectionDismissed =
            false;

        for (
            const currentDetails
            of detailsElements
        ) {
            currentDetails.open =
                false;
            delete currentDetails.dataset
                .cmsCurrentSection;
        }

        const details =
            getCmsDrawerSection(
                drawer,
                sectionPath,
            );

        if (details) {
            details.dataset.cmsCurrentSection =
                "true";
        }

        const entry =
            findSectionEntry(
                sectionEntries,
                sectionPath,
            );

        if (entry) {
            highlightCmsSection(
                entry.section,
                documentObject,
            );
        }

        details
            ?.querySelector(
                "summary",
            )
            ?.focus();
    }

    function captureTransientState() {
        const openDetails =
            detailsElements.find(
                (details) =>
                    details.open,
            );

        return createCmsTransientStateSnapshot({
            values:
                collectCmsEditorValues({
                    editingRoot:
                        drawer,
                }).map((entry) => {
                    const control = Array.from(controls).find((candidate) =>
                        joinCmsContentPath(
                            candidate.dataset.cmsSectionPath,
                            candidate.dataset.cmsFieldKey,
                        ) === entry.path,
                    );
                    return control?.dataset.cmsPreviewValue
                        ? { ...entry, previewValue: control.dataset.cmsPreviewValue }
                        : entry;
                }),

            drawerOpen:
                drawer.classList.contains(
                    "cms-drawer--open",
                ),

            openSectionPath:
                openDetails?.dataset
                    .cmsDrawerSection ??
                null,

            showPreview,
        });
    }

    function restoreTransientState(
        snapshot,
    ) {
        if (
            !isCmsTransientStateSnapshot(
                snapshot,
            )
        ) {
            return false;
        }

        const valuesByPath =
            new Map(
                snapshot.values.map(
                    (entry) => [
                        entry.path,
                        entry,
                    ],
                ),
            );

        for (const control of controls) {
            const sectionPath =
                control.dataset
                    .cmsSectionPath;

            const fieldKey =
                control.dataset
                    .cmsFieldKey;

            if (
                !sectionPath ||
                !fieldKey
            ) {
                continue;
            }

            const path =
                joinCmsContentPath(
                    sectionPath,
                    fieldKey,
                );

            if (
                !valuesByPath.has(
                    path,
                )
            ) {
                continue;
            }

            const restored = valuesByPath.get(path);
            control.value = restored.value;
            if (typeof restored.previewValue === "string") {
                control.dataset.cmsPreviewValue = restored.previewValue;
            }
            syncImageControlDisplay(control);
        }

        clearCmsDrawerValidation(
            drawer,
        );

        showPreview =
            snapshot.showPreview;
        previewToggle.checked =
            showPreview;

        if (storage) {
            writeCmsPreviewPreference(
                showPreview,
                storage,
            );
        }

        if (showPreview) {
            applyAllDrawerPreviews({
                drawer,
                sectionEntries,
            });
        } else {
            restoreAllPublishedPreviews({
                sectionEntries,
                editorState,
            });
        }

        refreshChangedFieldState();
        const dirty =
            updateWorkflowDirtyState({
                allowErrorExit:
                    true,
            });

        if (snapshot.drawerOpen) {
            if (snapshot.openSectionPath) {
                openForSection(
                    snapshot.openSectionPath,
                );
            } else {
                openCmsDrawer(
                    drawer,
                );
            }
        }

        return dirty;
    }

    async function discardChanges() {
        if (
            (workflow.isLocalEditingBusy?.() ?? workflow.isBusy()) ||
            !hasCmsEditorChanges({ editingRoot: drawer, editorState })
        ) {
            return false;
        }

        const savedDraftExists =
            typeof hasSavedDraft === "function"
                ? Boolean(hasSavedDraft())
                : Boolean(hasSavedDraft);
        const message = savedDraftExists
            ? "Discard your unsaved changes and restore the saved draft? The shared draft and published website will not change. This cannot be undone."
            : "Discard your unsaved changes and restore the published website? Nothing will be saved or published. This cannot be undone.";
        const confirmed = typeof confirmDiscard === "function"
            ? await confirmDiscard({ hasSavedDraft: savedDraftExists, message })
            : documentObject.defaultView?.confirm(message);

        if (!confirmed) return false;

        clearCmsDrawerValidation(drawer);
        const restoredContent = savedDraftExists
            ? editorState.getSavedContent()
            : editorState.getPublishedContent();
        syncDrawerControlsFromContent({
            drawer,
            sectionEntries,
            content: restoredContent,
            resolveImagePreviewUrl,
        });

        if (showPreview) {
            applyAllDrawerPreviews({ drawer, sectionEntries });
        } else {
            restoreAllPublishedPreviews({ sectionEntries, editorState });
        }

        onImageUploadStatus?.(null);
        refreshChangedFieldState();
        // Discard is local-only. Return to the workflow's existing clean state
        // (Saved, Idle, or Published) instead of forcing Idle, which would
        // incorrectly disable Publish when a saved shared draft still exists.
        workflow.send(CMS_EDITOR_EVENTS.FORM_CHANGED, { dirty: false });
        return true;
    }

    function reconcileSavedContent(content, { hasSavedDraft: savedDraftExists = true } = {}) {
        if (
            (workflow.isLocalEditingBusy?.() ?? workflow.isBusy()) ||
            hasCmsEditorChanges({ editingRoot: drawer, editorState })
        ) {
            return false;
        }

        const reconciledContent = editorState.replaceSavedContent(content);
        clearCmsDrawerValidation(drawer);
        syncDrawerControlsFromContent({
            drawer,
            sectionEntries,
            content: reconciledContent,
            resolveImagePreviewUrl,
        });

        if (showPreview) {
            applyAllDrawerPreviews({ drawer, sectionEntries });
        } else {
            restoreAllPublishedPreviews({ sectionEntries, editorState });
        }

        onImageUploadStatus?.(null);
        refreshChangedFieldState();
        workflow.send(CMS_EDITOR_EVENTS.DRAFT_RECONCILED, {
            hasSavedDraft: savedDraftExists,
        });
        return true;
    }

    if (!showPreview) {
        restoreAllPublishedPreviews({
            sectionEntries,
            editorState,
        });
    }

    return {
        openForSection,

        close:
            closeEditor,

        getShowPreview() {
            return showPreview;
        },

        captureTransientState,
        restoreTransientState,
        discardChanges,
        reconcileSavedContent,

        setPublishedContent(content) {
            const snapshot = editorState.setPublishedContent(content);
            if (!showPreview) {
                restoreAllPublishedPreviews({ sectionEntries, editorState });
            }
            return snapshot;
        },
    };
}
