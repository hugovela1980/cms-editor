export const CMS_EDITOR_STATES = Object.freeze({
    IDLE:
        "idle",

    DIRTY:
        "dirty",

    SAVING:
        "saving",

    SAVED:
        "saved",

    BUILD_PENDING:
        "build_pending",

    ERROR:
        "error",

    PUBLISHING:
        "publishing",

    PUBLISHED:
        "published",
});

export const CMS_EDITOR_EVENTS = Object.freeze({
    FORM_CHANGED:
        "form_changed",

    SAVE_START:
        "save_start",

    SAVE_SUCCESS:
        "save_success",

    BUILD_PENDING:
        "build_pending",

    BUILD_SUCCESS:
        "build_success",

    VALIDATION_FAILED:
        "validation_failed",

    FAIL:
        "fail",

    PUBLISH_START:
        "publish_start",

    PUBLISH_SUCCESS:
        "publish_success",

    REVERT:
        "revert",

    DRAFT_RECONCILED:
        "draft_reconciled",
});

const BUSY_STATES = new Set([
    CMS_EDITOR_STATES.SAVING,
    CMS_EDITOR_STATES.BUILD_PENDING,
    CMS_EDITOR_STATES.PUBLISHING,
]);

const CLEAN_STATES = new Set([
    CMS_EDITOR_STATES.IDLE,
    CMS_EDITOR_STATES.SAVED,
    CMS_EDITOR_STATES.PUBLISHED,
]);

function freezeSnapshot({
    state,
    hasUnsavedChanges,
    lastCleanState,
    message = null,
    error = null,
}) {
    return Object.freeze({
        state,
        hasUnsavedChanges,
        lastCleanState,
        message,
        error:
            error
                ? Object.freeze({
                    ...error,
                })
                : null,
    });
}

function assertAllowed(
    snapshot,
    event,
    allowedStates,
) {
    if (
        allowedStates.includes(
            snapshot.state,
        )
    ) {
        return;
    }

    throw new Error(
        `Invalid CMS editor transition "${event}" from "${snapshot.state}".`,
    );
}

function createErrorPayload(
    payload,
    fallbackOperation,
) {
    return {
        code:
            typeof payload.code ===
            "string"
                ? payload.code
                : null,

        operation:
            typeof payload.operation ===
            "string"
                ? payload.operation
                : fallbackOperation,

        message:
            typeof payload.message ===
            "string" &&
            payload.message.trim() !== ""
                ? payload.message
                : "The editor could not complete the requested operation.",
    };
}

export function isCmsEditorBusyState(
    state,
) {
    return BUSY_STATES.has(
        state,
    );
}

export function createCmsEditorWorkflow({
    initialState =
        CMS_EDITOR_STATES.IDLE,
} = {}) {
    if (
        !CLEAN_STATES.has(
            initialState,
        )
    ) {
        throw new Error(
            `CMS editor workflow must start in a clean state, received "${initialState}".`,
        );
    }

    let snapshot =
        freezeSnapshot({
            state:
                initialState,

            hasUnsavedChanges:
                false,

            lastCleanState:
                initialState,
        });

    const listeners =
        new Set();

    function publish(
        nextSnapshot,
    ) {
        snapshot =
            freezeSnapshot(
                nextSnapshot,
            );

        for (
            const listener
            of listeners
        ) {
            listener(
                snapshot,
            );
        }

        return snapshot;
    }

    function send(
        event,
        payload = {},
    ) {
        switch (event) {
            case CMS_EDITOR_EVENTS.FORM_CHANGED: {
                if (
                    isCmsEditorBusyState(snapshot.state) &&
                    snapshot.state !== CMS_EDITOR_STATES.PUBLISHING
                ) {
                    throw new Error(
                        `Cannot update CMS form state while editor is "${snapshot.state}".`,
                    );
                }

                const dirty =
                    Boolean(
                        payload.dirty,
                    );

                if (snapshot.state === CMS_EDITOR_STATES.PUBLISHING) {
                    return publish({
                        ...snapshot,
                        hasUnsavedChanges: dirty,
                        message: snapshot.message,
                        error: null,
                    });
                }

                if (!dirty) {
                    return publish({
                        state:
                            snapshot.lastCleanState,

                        hasUnsavedChanges:
                            false,

                        lastCleanState:
                            snapshot.lastCleanState,

                        message:
                            null,

                        error:
                            null,
                    });
                }

                return publish({
                    state:
                        CMS_EDITOR_STATES.DIRTY,

                    hasUnsavedChanges:
                        true,

                    lastCleanState:
                        snapshot.lastCleanState,

                    message:
                        null,

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.SAVE_START: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.DIRTY,
                        CMS_EDITOR_STATES.ERROR,
                    ],
                );

                if (
                    !snapshot.hasUnsavedChanges
                ) {
                    throw new Error(
                        "Cannot save CMS editor state without unsaved changes.",
                    );
                }

                return publish({
                    state:
                        CMS_EDITOR_STATES.SAVING,

                    hasUnsavedChanges:
                        true,

                    lastCleanState:
                        snapshot.lastCleanState,

                    message:
                        payload.message ??
                        "Saving changes…",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.SAVE_SUCCESS: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.SAVING,
                    ],
                );

                return publish({
                    state:
                        CMS_EDITOR_STATES.SAVED,

                    hasUnsavedChanges:
                        false,

                    lastCleanState:
                        CMS_EDITOR_STATES.SAVED,

                    message:
                        payload.message ??
                        "Changes saved.",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.BUILD_PENDING: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.SAVING,
                        CMS_EDITOR_STATES.SAVED,
                    ],
                );

                return publish({
                    state:
                        CMS_EDITOR_STATES.BUILD_PENDING,

                    hasUnsavedChanges:
                        false,

                    lastCleanState:
                        CMS_EDITOR_STATES.SAVED,

                    message:
                        payload.message ??
                        "Build pending…",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.BUILD_SUCCESS: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.BUILD_PENDING,
                    ],
                );

                return publish({
                    state:
                        CMS_EDITOR_STATES.SAVED,

                    hasUnsavedChanges:
                        false,

                    lastCleanState:
                        CMS_EDITOR_STATES.SAVED,

                    message:
                        payload.message ??
                        "Build complete.",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.VALIDATION_FAILED: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.DIRTY,
                        CMS_EDITOR_STATES.ERROR,
                    ],
                );

                return publish({
                    state:
                        CMS_EDITOR_STATES.ERROR,

                    hasUnsavedChanges:
                        true,

                    lastCleanState:
                        snapshot.lastCleanState,

                    message:
                        payload.message ??
                        "Please correct the validation errors before saving.",

                    error:
                        createErrorPayload(
                            payload,
                            "validation",
                        ),
                });
            }

            case CMS_EDITOR_EVENTS.FAIL: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.SAVING,
                        CMS_EDITOR_STATES.BUILD_PENDING,
                        CMS_EDITOR_STATES.PUBLISHING,
                    ],
                );

                const operation =
                    payload.operation ??
                    snapshot.state;

                return publish({
                    state:
                        CMS_EDITOR_STATES.ERROR,

                    hasUnsavedChanges:
                        snapshot.hasUnsavedChanges,

                    lastCleanState:
                        snapshot.lastCleanState,

                    message:
                        payload.message ??
                        "The editor encountered an error.",

                    error:
                        createErrorPayload(
                            payload,
                            operation,
                        ),
                });
            }

            case CMS_EDITOR_EVENTS.PUBLISH_START: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.SAVED,
                        CMS_EDITOR_STATES.ERROR,
                    ],
                );

                if (
                    snapshot.hasUnsavedChanges ||
                    (snapshot.state === CMS_EDITOR_STATES.ERROR &&
                        snapshot.lastCleanState !== CMS_EDITOR_STATES.SAVED)
                ) {
                    throw new Error(
                        "Cannot publish CMS editor state without a clean saved draft.",
                    );
                }

                return publish({
                    state:
                        CMS_EDITOR_STATES.PUBLISHING,

                    hasUnsavedChanges:
                        false,

                    lastCleanState:
                        CMS_EDITOR_STATES.SAVED,

                    message:
                        payload.message ??
                        "Publishing…",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.PUBLISH_SUCCESS: {
                assertAllowed(
                    snapshot,
                    event,
                    [
                        CMS_EDITOR_STATES.PUBLISHING,
                    ],
                );

                return publish({
                    state: snapshot.hasUnsavedChanges
                        ? CMS_EDITOR_STATES.DIRTY
                        : CMS_EDITOR_STATES.PUBLISHED,

                    hasUnsavedChanges:
                        snapshot.hasUnsavedChanges,

                    lastCleanState:
                        CMS_EDITOR_STATES.PUBLISHED,

                    message:
                        payload.message ??
                        "Published.",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.REVERT: {
                if (
                    isCmsEditorBusyState(
                        snapshot.state,
                    )
                ) {
                    throw new Error(
                        `Cannot revert CMS editor while state is "${snapshot.state}".`,
                    );
                }

                return publish({
                    state:
                        CMS_EDITOR_STATES.IDLE,

                    hasUnsavedChanges:
                        false,

                    lastCleanState:
                        CMS_EDITOR_STATES.IDLE,

                    message:
                        payload.message ??
                        "Reverted to live content.",

                    error:
                        null,
                });
            }

            case CMS_EDITOR_EVENTS.DRAFT_RECONCILED: {
                if (
                    isCmsEditorBusyState(
                        snapshot.state,
                    )
                ) {
                    throw new Error(
                        `Cannot reconcile CMS editor while state is "${snapshot.state}".`,
                    );
                }

                const hasSavedDraft = payload.hasSavedDraft !== false;
                const cleanState = hasSavedDraft
                    ? CMS_EDITOR_STATES.SAVED
                    : CMS_EDITOR_STATES.IDLE;

                return publish({
                    state: cleanState,
                    hasUnsavedChanges: false,
                    lastCleanState: cleanState,
                    message: payload.message ?? null,
                    error: null,
                });
            }

            default:
                throw new Error(
                    `Unknown CMS editor event "${String(event)}".`,
                );
        }
    }

    return {
        getSnapshot() {
            return snapshot;
        },

        isBusy() {
            return isCmsEditorBusyState(
                snapshot.state,
            );
        },

        isLocalEditingBusy() {
            return isCmsEditorBusyState(snapshot.state) &&
                snapshot.state !== CMS_EDITOR_STATES.PUBLISHING;
        },

        send,

        subscribe(listener) {
            if (
                typeof listener !==
                "function"
            ) {
                throw new Error(
                    "CMS editor workflow listener must be a function.",
                );
            }

            listeners.add(
                listener,
            );

            return () => {
                listeners.delete(
                    listener,
                );
            };
        },
    };
}
