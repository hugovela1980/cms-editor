import {
    CMS_EDITOR_STATES,
    isCmsEditorBusyState,
} from "./editor-workflow.js";

import { getCmsStatusSurface } from "./status-surface.js";

const DEFAULT_MESSAGES =
    Object.freeze({
        [CMS_EDITOR_STATES.IDLE]:
            "Ready.",

        [CMS_EDITOR_STATES.DIRTY]:
            "You have unsaved changes.",

        [CMS_EDITOR_STATES.SAVING]:
            "Saving changes…",

        [CMS_EDITOR_STATES.SAVED]:
            "Changes saved.",

        [CMS_EDITOR_STATES.BUILD_PENDING]:
            "A new site build is pending…",

        [CMS_EDITOR_STATES.ERROR]:
            "The editor needs attention.",

        [CMS_EDITOR_STATES.PUBLISHING]:
            "Publishing changes…",

        [CMS_EDITOR_STATES.PUBLISHED]:
            "Published.",
    });

function setDisabled(
    element,
    disabled,
) {
    if (!element) {
        return;
    }

    element.disabled =
        disabled;

    if (disabled) {
        element.setAttribute(
            "aria-disabled",
            "true",
        );
    } else {
        element.removeAttribute(
            "aria-disabled",
        );
    }
}

export function renderCmsEditorShell({
    shell,
    editingRoot,
    snapshot,
    canPublish = false,
    sharedStateLocked = false,
    discardChanges = null,
}) {
    const busy =
        isCmsEditorBusyState(
            snapshot.state,
        );
    const localEditingBusy = busy && snapshot.state !== CMS_EDITOR_STATES.PUBLISHING;

    const sharedLocked =
        typeof sharedStateLocked === "function"
            ? Boolean(sharedStateLocked(snapshot))
            : Boolean(sharedStateLocked);

    shell.dataset.cmsEditorState =
        snapshot.state;

    editingRoot.dataset.cmsEditorState =
        snapshot.state;

    editingRoot.setAttribute(
        "aria-busy",
        localEditingBusy
            ? "true"
            : "false",
    );

    const isError = snapshot.state === CMS_EDITOR_STATES.ERROR;
    const message = isError ? 'Editor needs attention' : ({
        idle: 'Ready', dirty: 'Unsaved changes', saving: 'Saving…',
        saved: 'Saved', build_pending: 'Preview rebuilding…',
        publishing: 'Publishing website…', published: 'Website published',
    }[snapshot.state] ?? 'Ready');
    const supporting = isError
        ? 'Your local edits are still available. See more for the next step.'
        : ({
            idle: 'Choose a field to begin editing.',
            dirty: 'These changes are only in this browser until you save.',
            saving: 'Writing your changes to the shared draft.',
            saved: 'Your latest changes are in the shared draft.',
            build_pending: 'The preview is catching up with the saved draft.',
            publishing: snapshot.hasUnsavedChanges
                ? 'Publishing continues in the background. New edits belong to your next draft.'
                : 'You can keep editing. Saving is temporarily paused.',
            published: 'The public website is up to date.',
        }[snapshot.state] ?? 'The editor is ready.');
    getCmsStatusSurface(shell).set('workflow', {
        message,
        supporting,
        severity: isError ? 'error' : 'info',
        priority: isError ? 100 : busy ? 80 : snapshot.hasUnsavedChanges ? 50 : snapshot.state === CMS_EDITOR_STATES.IDLE ? 0 : 10,
        detail: isError ? {
            title: 'Editor needs attention',
            explanation: snapshot.message ?? DEFAULT_MESSAGES[snapshot.state],
        } : null,
        action: snapshot.hasUnsavedChanges && !localEditingBusy && typeof discardChanges === 'function'
            ? { label: 'Discard Changes', run: discardChanges }
            : null,
    });

    for (
        const control
        of editingRoot.querySelectorAll(
            "[data-cms-field-key]",
        )
    ) {
        setDisabled(
            control,
            localEditingBusy,
        );
    }

    for (
        const imageInput
        of editingRoot.querySelectorAll(
            "[data-cms-image-file]",
        )
    ) {
        setDisabled(
            imageInput,
            busy || sharedLocked,
        );
    }

    setDisabled(
        editingRoot.querySelector(
            "[data-cms-preview-toggle]",
        ),
        localEditingBusy,
    );

    const localSave =
        editingRoot.querySelector(
            "[data-cms-save-local]",
        );

    const hasValidationErrors =
        Boolean(
            editingRoot.querySelector(
                '[data-cms-field-key][aria-invalid="true"]',
            ),
        );

    setDisabled(
        localSave,
        busy ||
            sharedLocked ||
            !snapshot.hasUnsavedChanges ||
            hasValidationErrors,
    );

    setDisabled(
        editingRoot.querySelector(
            "[data-cms-revert-live]",
        ),
        busy || sharedLocked,
    );

    const deploy =
        editingRoot.querySelector(
            "[data-cms-save-deploy]",
        );

    const publishableState =
        snapshot.state === CMS_EDITOR_STATES.SAVED ||
        (snapshot.state === CMS_EDITOR_STATES.ERROR &&
            !snapshot.hasUnsavedChanges &&
            snapshot.lastCleanState === CMS_EDITOR_STATES.SAVED);

    const publishAllowed =
        typeof canPublish === "function"
            ? Boolean(canPublish(snapshot))
            : Boolean(canPublish);

    setDisabled(
        deploy,
        !publishAllowed ||
            busy ||
            sharedLocked ||
            !publishableState,
    );

    return {
        busy,
        localEditingBusy,
        sharedLocked,
        hasValidationErrors,
        state:
            snapshot.state,
    };
}

export function installCmsEditorShellController({
    shell,
    editingRoot,
    workflow,
    canPublish = false,
    sharedStateLocked = false,
    discardChanges = null,
}) {
    const render =
        (snapshot) =>
            renderCmsEditorShell({
                shell,
                editingRoot,
                snapshot,
                canPublish,
                sharedStateLocked,
                discardChanges,
            });

    render(
        workflow.getSnapshot(),
    );

    const unsubscribe =
        workflow.subscribe(
            render,
        );

    return {
        render,

        destroy() {
            unsubscribe();
        },
    };
}
