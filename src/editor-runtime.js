import {
    findActiveCmsSectionEntry,
} from "./active-section.js";

import {
    readCmsSiteContent,
} from "./content-source.js";

import {
    createCmsDrawer,
} from "./drawer-builder.js";

import {
    installCmsDrawerController,
} from "./drawer-controller.js";

import {
    createCmsEditorState,
} from "./editor-state.js";

import {
    installCmsEditorShellController,
} from "./editor-shell-controller.js";

import {
    createCmsEditorWorkflow,
} from "./editor-workflow.js";

import {
    readCmsPreviewPreference,
} from "./preview-preference.js";

import {
    createCmsGlobalEditControl,
    discoverCmsSections,
    installCmsEditControlVisibilityShortcut,
    readCmsSectionContract,
} from "./section-controls.js";

import {
    installCmsUnsavedChangesWarning,
} from "./unsaved-warning.js";

export function initializeCmsEditor({
    requireSchema,
    headerActions = null,
    saveChanges = null,
    confirmSave = null,
    saveButtonLabel = null,
    saveSuccessMessage = null,
    revertButtonLabel = null,
    revertToSaved = false,
    confirmRevert = null,
    revertChanges = null,
    revertSuccessMessage = null,
    initialState = null,
    canPublish = false,
    sharedStateLocked = false,
    publishButtonLabel = null,
    confirmPublish = null,
    publishChanges = null,
    publishSuccessMessage = null,
    uploadImage = null,
    onImageUploadStatus = null,
    resolveImagePreviewUrl = null,
    confirmDiscard = null,
    hasSavedDraft = false,
    documentObject = document,
    windowObject = window,
} = {}) {
    const siteContent =
        readCmsSiteContent(
            documentObject,
        );

    const sections =
        discoverCmsSections(
            documentObject,
        );

    if (sections.length === 0) {
        return;
    }

    const sectionEntries = [];

    for (const section of sections) {
        try {
            const {
                sectionPath,
                schema,
            } =
                readCmsSectionContract(
                    section,
                    { requireSchema },
                );

            sectionEntries.push({
                section,
                sectionPath,
                schema,
            });
        } catch (error) {
            console.error(
                "Unable to initialize CMS section.",
                error,
                section,
            );
        }
    }

    if (
        sectionEntries.length ===
        0
    ) {
        return;
    }

    const showPreview =
        readCmsPreviewPreference(
            windowObject.localStorage,
        );

    const editorState =
        createCmsEditorState(
            siteContent,
            siteContent.published ??
                siteContent,
        );

    const workflow =
        createCmsEditorWorkflow(
            initialState
                ? { initialState }
                : undefined,
        );

    const drawer =
        createCmsDrawer({
            documentObject,
            sectionEntries,
            siteContent,
            showPreview,
            headerActions,
            saveButtonLabel:
                saveButtonLabel ??
                (saveChanges
                    ? "Save Draft"
                    : "Save Current Changes"),
            revertButtonLabel:
                revertButtonLabel ??
                (revertToSaved
                    ? "Discard Unsaved Changes"
                    : "Undo All Changes and Revert to Live Site"),
            publishButtonLabel:
                publishButtonLabel ??
                "Publish Website",
            resolveImagePreviewUrl,
        });

    const shell =
        drawer.querySelector(
            "[data-cms-editor-shell]",
        );

    if (!shell) {
        throw new Error(
            "CMS editor shell was not created.",
        );
    }

    let drawerController = null;

    const shellController =
        installCmsEditorShellController({
            shell,
            editingRoot:
                drawer,
            workflow,
            canPublish,
            sharedStateLocked,
            discardChanges() {
                void drawerController?.discardChanges();
            },
        });

    drawerController =
        installCmsDrawerController({
            drawer,
            sectionEntries,
            editorState,
            workflow,
            initialShowPreview:
                showPreview,
            saveChanges,
            confirmSave,
            saveSuccessMessage,
            revertToSaved,
            confirmRevert,
            revertChanges,
            revertSuccessMessage,
            confirmPublish,
            publishChanges,
            publishSuccessMessage,
            uploadImage,
            onImageUploadStatus,
            resolveImagePreviewUrl,
            confirmDiscard,
            hasSavedDraft,
        });

    const unsavedWarning =
        installCmsUnsavedChangesWarning({
            workflow,
            windowObject,
        });

    const editButton =
        createCmsGlobalEditControl({
            documentObject,
        });

    editButton.setAttribute(
        "aria-controls",
        drawer.id,
    );

    editButton.setAttribute(
        "aria-expanded",
        "false",
    );

    installCmsEditControlVisibilityShortcut({
        editControl:
            editButton,
        drawer,
        documentObject,
    });

    editButton.addEventListener(
        "click",
        () => {
            const activeEntry =
                findActiveCmsSectionEntry(
                    sectionEntries,
                );

            if (!activeEntry) {
                return;
            }

            drawerController.openForSection(
                activeEntry.sectionPath,
                editButton,
            );
        },
    );

    let navigationPrepared =
        false;

    return {
        hasUnsavedChanges() {
            return workflow
                .getSnapshot()
                .hasUnsavedChanges;
        },

        captureTransientState() {
            return drawerController
                .captureTransientState();
        },

        restoreTransientState(snapshot) {
            return drawerController
                .restoreTransientState(
                    snapshot,
                );
        },

        prepareForNavigation() {
            if (navigationPrepared) {
                return;
            }

            navigationPrepared =
                true;
            unsavedWarning.destroy();
        },

        getWorkflowSnapshot() {
            return workflow.getSnapshot();
        },

        getSavedContent() {
            return editorState.getSavedContent();
        },

        getPublishedContent() {
            return editorState.getPublishedContent();
        },

        setPublishedContent(content) {
            return drawerController.setPublishedContent(content);
        },

        discardChanges() {
            return drawerController.discardChanges();
        },

        reconcileSavedContent(content, options) {
            return drawerController.reconcileSavedContent(content, options);
        },

        refreshControls() {
            return shellController.render(
                workflow.getSnapshot(),
            );
        },
    };
}
