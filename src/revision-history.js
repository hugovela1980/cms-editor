// Provider-independent controls. The host supplies persistence and navigation.
let revisionDialogSequence = 0;

function revisionDateLabel(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Date unavailable";
}

function revisionNote(value) {
    return String(value ?? "").trim() || "Revision without a note";
}

function revisionTitle(revision) {
    return String(revision?.title ?? "").trim() || revisionNote(revision?.note);
}

function appendRevisionContext({ documentObject, parent, revision }) {
    if (!revision.current && !revision.baseline) return;
    const context = documentObject.createElement("div");
    context.className = "cms-revision-context";
    if (revision.current) {
        const current = documentObject.createElement("span");
        current.className = "cms-revision-badge";
        current.textContent = "Current live revision";
        context.append(current);
    }
    if (revision.baseline) {
        const baseline = documentObject.createElement("span");
        baseline.className = "cms-revision-badge cms-revision-badge--baseline";
        baseline.textContent = "Developer baseline";
        context.append(baseline);
    }
    parent.append(context);
}

function revisionValue(value) {
    if (value === "" || value === null || value === undefined) return "(empty)";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function createRevisionHistory({
    container,
    provider,
    onRestored = () => {},
    canRestore = () => true,
    hasUnpublishedDraft = () => false,
    onStatus = () => {},
    onDraftDiverged = () => {},
    checkDraftDivergence = () => {},
    isDraftDiverged = () => false,
    provenance,
    documentObject = document,
    windowObject = window,
}) {
    const panel = documentObject.createElement("section");
    panel.className = "cms-revision-history";
    const heading = documentObject.createElement("h2");
    heading.textContent = "Revision History";
    const help = documentObject.createElement("p");
    help.className = "cms-revision-history__help";
    help.textContent = "Browse saved versions of your website that were previously live. Restore to Draft prepares one for review; publishing remains a separate action.";
    const status = documentObject.createElement("p");
    status.className = "cms-revision-history__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const activity = documentObject.createElement("span");
    activity.className = "cms-revision-history__activity";
    activity.setAttribute("aria-hidden", "true");
    activity.hidden = true;
    const list = documentObject.createElement("ol");
    list.className = "cms-revision-list";
    const pinned = documentObject.createElement("div");
    pinned.className = "cms-revision-pinned";
    const more = documentObject.createElement("button");
    more.type = "button";
    more.textContent = "Load older entries";
    more.hidden = true;

    let busy = false;
    let nextPage = 1;
    let head;
    let activeDialog = null;
    let historyActive = false;
    let historySession = 0;
    let busySession = 0;
    let pendingRefresh = false;
    let loaded = false;
    const summaries = new Map();
    let restoredSummary = null;

    function emitStatus(model) {
        onStatus(model);
    }

    function rememberRevision(revision) {
        if (revision?.id) summaries.set(revision.id, revision);
        if (provenance?.revision === revision?.id) restoredSummary = revision;
    }

    function restoredStatus(revision) {
        const title = revisionTitle(revision);
        const subject = Number.isSafeInteger(revision?.number)
            ? `Revision ${revision.number}, “${title},”`
            : `“${title}”`;
        return {
            message: `${subject} was restored and saved. Publish to update the live website.`,
            priority: 70,
        };
    }

    function setPanelBusy(value, session = historySession) {
        busy = value;
        busySession = value ? session : 0;
        panel.toggleAttribute("aria-busy", value);
        activity.hidden = !value;
        for (const control of panel.querySelectorAll("button")) control.disabled = value;
    }

    async function run(action, session = historySession) {
        if (busy) return;
        setPanelBusy(true, session);
        try {
            await action();
        } catch (error) {
            status.textContent = error instanceof Error
                ? error.message
                : "Revision history is unavailable.";
            status.setAttribute("role", "alert");
            emitStatus({
                message: "Revision history needs attention",
                supporting: error instanceof Error ? error.message : "Revision history is unavailable.",
                severity: "error",
                priority: 70,
            });
        } finally {
            if (busySession !== session) return;
            setPanelBusy(false);
            if (pendingRefresh && historyActive) {
                pendingRefresh = false;
                void refresh();
            }
        }
    }

    function closeActiveDialog() {
        if (!activeDialog) return;
        activeDialog.close();
    }

    function openRevisionDialog(response, summary, opener) {
        closeActiveDialog();
        const revision = {
            ...summary,
            ...response.revision,
            current: response.revision.current ?? summary.current,
            baseline: response.revision.baseline ?? summary.baseline,
        };
        const dialog = documentObject.createElement("dialog");
        const titleId = `cms-revision-dialog-title-${++revisionDialogSequence}`;
        dialog.className = "cms-save-confirmation cms-revision-dialog";
        dialog.setAttribute("aria-labelledby", titleId);
        const surface = documentObject.createElement("div");
        surface.className = "cms-save-confirmation__panel cms-revision-dialog__surface";
        const body = documentObject.createElement("div");
        body.className = "cms-revision-dialog__body";
        const eyebrow = documentObject.createElement("p");
        eyebrow.className = "cms-save-confirmation__eyebrow";
        eyebrow.textContent = "Published revision";
        const title = documentObject.createElement("h2");
        title.id = titleId;
        title.tabIndex = -1;
        title.textContent = revisionTitle(revision);
        const date = documentObject.createElement("time");
        date.className = "cms-revision-dialog__date";
        date.dateTime = String(revision.date ?? "");
        date.textContent = revisionDateLabel(revision.date);
        body.append(eyebrow, title, date);
        appendRevisionContext({ documentObject, parent: body, revision });
        const scope = documentObject.createElement("p");
        scope.textContent = "This is a saved version of your website from this point in time. Restoring a revision replaces the current draft. The live website will not change until the draft is published.";
        body.append(scope);
        const valuesHeading = documentObject.createElement("h3");
        valuesHeading.textContent = "Website content";
        body.append(valuesHeading);
        const values = documentObject.createElement("dl");
        values.className = "cms-revision-values";
        for (const [path, value] of Object.entries(revision.values ?? {})) {
            const term = documentObject.createElement("dt");
            term.textContent = revision.fieldLabels?.[path] ?? path;
            const definition = documentObject.createElement("dd");
            definition.textContent = revisionValue(value);
            values.append(term, definition);
        }
        body.append(values);
        const feedback = documentObject.createElement("p");
        feedback.className = "cms-revision-dialog__feedback";
        feedback.setAttribute("role", "status");
        feedback.setAttribute("aria-live", "polite");
        const actions = documentObject.createElement("div");
        actions.className = "cms-save-confirmation__actions cms-revision-dialog__actions";
        const close = documentObject.createElement("button");
        close.type = "button";
        close.textContent = "Close";
        const restore = documentObject.createElement("button");
        restore.type = "button";
        restore.className = "cms-save-confirmation__confirm";
        restore.textContent = "Restore to Draft";
        actions.append(close);
        if (revision.current !== true) {
            actions.append(restore);
        }
        surface.append(body, feedback, actions);
        dialog.append(surface);

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            dialog.remove();
            if (activeDialog?.element === dialog) activeDialog = null;
            if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
        };
        const closeDialog = () => {
            if (typeof dialog.close === "function" && dialog.open) dialog.close();
            else finish();
        };
        dialog.addEventListener("close", finish, { once: true });
        dialog.addEventListener("cancel", event => {
            event.preventDefault();
            if (dialog.hasAttribute("aria-busy")) {
                feedback.textContent = "Restore is still in progress. Keep this dialog open until it finishes.";
                return;
            }
            closeDialog();
        });
        close.addEventListener("click", closeDialog);
        restore.addEventListener("click", async () => {
            if (revision.current === true) {
                return;
            }

            if (isDraftDiverged()) {
                feedback.textContent = "A newer version of the draft is available. Reload it before restoring this revision.";
                feedback.setAttribute("role", "alert");
                onDraftDiverged();
                return;
            }
            if (!canRestore()) {
                feedback.textContent = "Save or discard your unsaved edits before restoring.";
                feedback.setAttribute("role", "alert");
                emitStatus({
                    message: "Restore unavailable",
                    supporting: "Save or discard your unsaved edits before restoring.",
                    severity: "error",
                    priority: 85,
                });
                return;
            }
            const unpublishedWarning = hasUnpublishedDraft()
                ? "This will replace the current draft with this revision. Any unpublished draft changes will be overwritten and lost. The live website will not change until the draft is published."
                : "This will replace the current draft with this revision. The live website will not change until the draft is published.";
            const confirmed = windowObject.confirm(
                `Restore this revision to the draft?\n\n${unpublishedWarning}`,
            );
            if (!confirmed) {
                feedback.textContent = "Restore cancelled. This revision remains open for review.";
                feedback.setAttribute("role", "status");
                return;
            }
            dialog.setAttribute("aria-busy", "true");
            restore.disabled = true;
            close.disabled = true;
            feedback.textContent = "Restoring this revision to the draft…";
            feedback.setAttribute("role", "status");
            emitStatus({
                message: "Restoring draft",
                supporting: "Restoring the selected revision to the draft…",
                priority: 85,
            });
            let result;
            try {
                result = await provider.restore(revision.id, response.draftVersion);
            } catch (error) {
                const draftChanged = error?.code === "DRAFT_CONFLICT";
                feedback.textContent = draftChanged
                    ? "The draft has changed since you opened this revision."
                    : error instanceof Error
                        ? error.message
                        : "This revision could not be restored. The draft was kept.";
                feedback.setAttribute("role", "alert");
                restore.disabled = draftChanged;
                close.disabled = false;
                dialog.removeAttribute("aria-busy");
                if (draftChanged) {
                    onDraftDiverged();
                    // Draft-divergence owns the persistent recovery status/action.
                    // Keep History itself in a normal ready state so a successful
                    // reload cannot reveal a stale conflict message underneath.
                    emitStatus({
                        message: "Revision History",
                        supporting: "Review this confirmed website revision.",
                        priority: 60,
                    });
                } else {
                    emitStatus({
                        message: "Restore couldn't complete",
                        supporting: error instanceof Error ? error.message : "The draft was kept.",
                        severity: "error",
                        priority: 85,
                        detail: {
                            title: "Revision restore could not complete",
                            explanation: error instanceof Error ? error.message : "The draft was kept.",
                        },
                    });
                }
                return;
            }
            status.textContent = "Restored to Draft. Review the unpublished changes before publishing.";
            status.setAttribute("role", "status");
            restoredSummary = revision;
            emitStatus(restoredStatus(revision));
            try {
                await onRestored(result.draft, result.draftVersion ?? null);
            } catch {
                feedback.textContent = "The revision was restored and saved, but the editor could not finish loading the result. Your on-screen edits were not discarded. Close this dialog and follow the editor's recovery guidance before another saved change.";
                feedback.setAttribute("role", "alert");
                restore.hidden = true;
                close.disabled = false;
                dialog.removeAttribute("aria-busy");
                emitStatus({
                    message: "Draft restored — editor sync needed",
                    supporting: "The draft was restored successfully, but this editor needs recovery before another saved change.",
                    severity: "error",
                    priority: 85,
                });
                return;
            }
            closeDialog();
        });
        activeDialog = { element: dialog, close: closeDialog };
        documentObject.body.append(dialog);
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
        title.focus();
    }

    async function view(summary, opener, session = historySession) {
        emitStatus({
            message: "Loading revision",
            supporting: "Loading revision details…",
            priority: 65,
        });
        let response;
        try {
            response = await provider.view(summary.id);
        } catch (error) {
            if (!historyActive || session !== historySession) return;
            throw error;
        }
        if (!historyActive || session !== historySession || !opener?.isConnected) return;
        openRevisionDialog(response, summary, opener);
        status.textContent = "Revision ready for review.";
        status.setAttribute("role", "status");
        emitStatus({
            message: "Revision History",
            supporting: "Review this confirmed website revision.",
            priority: 60,
        });
    }

    function appendRevision(revision) {
        const row = documentObject.createElement("li");
        row.className = "cms-revision-entry";
        const note = documentObject.createElement("p");
        note.className = "cms-revision-entry__note";
        note.textContent = revisionTitle(revision);
        row.append(note);
        if (Number.isSafeInteger(revision.number)) {
            const number = documentObject.createElement("p");
            number.className = "cms-revision-entry__number";
            number.textContent = `Revision ${revision.number}`;
            row.append(number);
        }
        const date = documentObject.createElement("time");
        date.className = "cms-revision-entry__date";
        date.dateTime = String(revision.date ?? "");
        date.textContent = revisionDateLabel(revision.date);
        row.append(date);
        appendRevisionContext({ documentObject, parent: row, revision });
        const viewButton = documentObject.createElement("button");
        viewButton.type = "button";
        viewButton.textContent = "View Revision";
        viewButton.addEventListener("click", () => {
            const session = historySession;
            void run(() => view(revision, viewButton, session));
        });
        row.append(viewButton);
        list.append(row);
        rememberRevision(revision);
    }

    function renderBaseline(baseline) {
        pinned.replaceChildren();
        if (!baseline?.id) return;
        rememberRevision(baseline);
        const entry = documentObject.createElement("section");
        entry.className = "cms-revision-baseline";
        const title = documentObject.createElement("h3");
        title.textContent = "Developer baseline";
        const copy = documentObject.createElement("p");
        copy.textContent = "Original protected CMS baseline";
        const button = documentObject.createElement("button");
        button.type = "button";
        button.textContent = "View Baseline";
        button.addEventListener("click", () => {
            const session = historySession;
            void run(() => view(baseline, button, session));
        });
        entry.append(title, copy, button);
        pinned.append(entry);
    }

    function replaceFirstPage(result, { resetScroll = false } = {}) {
        list.replaceChildren();
        summaries.clear();
        renderBaseline(result.baseline);
        if (result.highlighted) rememberRevision(result.highlighted);
        head = result.head;
        nextPage = result.nextPage;
        for (const revision of result.revisions.filter(item => !item.baseline)) appendRevision(revision);
        more.hidden = !nextPage;
        loaded = true;
        if (resetScroll) {
            const EventConstructor = documentObject.defaultView?.Event;
            if (EventConstructor) {
                container.dispatchEvent(new EventConstructor("cms:history-reset-scroll", { bubbles: true }));
            }
        }
    }

    function showReadyStatus() {
        status.textContent = list.children.length
            ? "Choose a confirmed-live revision to review."
            : nextPage
                ? "No revisions on this page. Load older entries."
                : "No confirmed-live client revisions found.";
        status.setAttribute("role", "status");
        emitStatus(restoredSummary
            ? restoredStatus(restoredSummary)
            : {
                message: "Revision History",
                supporting: "Choose a confirmed website revision to review.",
                priority: 60,
            });
    }

    async function loadFirstPage(session = historySession) {
        emitStatus({
            message: "Loading revision history",
            supporting: "Loading confirmed website revisions…",
            priority: 65,
        });
        let result;
        try {
            result = await provider.list({
                page: 1,
                head: undefined,
                ...(provenance?.revision ? { highlightedRevision: provenance.revision } : {}),
            });
        } catch (error) {
            if (!historyActive || session !== historySession) return;
            throw error;
        }
        if (!historyActive || session !== historySession) return;
        replaceFirstPage(result);
        showReadyStatus();
    }

    async function revalidate(session = historySession) {
        const cachedHead = head;
        emitStatus({
            message: "Refreshing revision history",
            supporting: "Checking for newly confirmed revisions…",
            priority: 65,
        });
        const result = await provider.list({
            page: 1,
            head: undefined,
            ...(provenance?.revision ? { highlightedRevision: provenance.revision } : {}),
        });
        if (!historyActive || session !== historySession) return;
        if (result.head !== cachedHead) replaceFirstPage(result, { resetScroll: true });
        else if (result.baseline) {
            if (!pinned.children.length) renderBaseline(result.baseline);
            else rememberRevision(result.baseline);
        }
        if (result.highlighted) rememberRevision(result.highlighted);
        showReadyStatus();
    }

    async function loadOlder(session = historySession) {
        if (!historyActive || session !== historySession) return;
        const requestedPage = nextPage;
        const requestedHead = head;
        if (!requestedPage) return;
        emitStatus({
            message: "Loading older revisions",
            supporting: "Loading older revisions…",
            priority: 65,
        });
        let result;
        try {
            result = await provider.list({ page: requestedPage, head: requestedHead });
        } catch (error) {
            if (!historyActive || session !== historySession) return;
            throw error;
        }
        if (!historyActive || session !== historySession) return;
        if (head !== requestedHead) return;
        head = result.head;
        nextPage = result.nextPage;
        for (const revision of result.revisions.filter(item => !item.baseline)) {
            if (!summaries.has(revision.id)) appendRevision(revision);
        }
        more.hidden = !nextPage;
        showReadyStatus();
    }

    async function refresh() {
        if (busy) {
            pendingRefresh = true;
            return;
        }
        const session = historySession;
        if (!loaded) {
            await run(() => loadFirstPage(session));
            return;
        }
        try {
            await revalidate(session);
        } catch (error) {
            if (!historyActive || session !== historySession) return;
            emitStatus({
                message: "Revision history couldn't refresh",
                supporting: "The cached history remains available.",
                severity: "error",
                priority: 70,
                detail: {
                    title: "Revision history refresh failed",
                    explanation: error instanceof Error ? error.message : "The cached history remains available.",
                },
            });
        }
    }
    const handleHistoryOpen = () => {
        historyActive = true;
        historySession += 1;
        void Promise.resolve(checkDraftDivergence()).catch(() => {});
        if (loaded) showReadyStatus();
        void refresh();
    };
    const handleHistoryClose = () => {
        historyActive = false;
        historySession += 1;
        pendingRefresh = false;
        closeActiveDialog();
        if (busySession) setPanelBusy(false);
        emitStatus(null);
    };
    more.addEventListener("click", () => {
        const session = historySession;
        void run(() => loadOlder(session), session);
    });
    panel.append(heading, help);
    panel.append(status, activity, pinned, list, more);
    container.append(panel);
    container.addEventListener("cms:history-open", handleHistoryOpen);
    container.addEventListener("cms:history-close", handleHistoryClose);

    return {
        element: panel,
        refresh,
        destroy() {
            container.removeEventListener("cms:history-open", handleHistoryOpen);
            container.removeEventListener("cms:history-close", handleHistoryClose);
            handleHistoryClose();
            panel.remove();
        },
    };
}
