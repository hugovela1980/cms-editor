let verificationSequence = 0;

function versionOf(document) {
    return typeof document?.versionId === "string" && document.versionId.trim()
        ? document.versionId
        : null;
}

function securePreview(url) {
    if (typeof url !== "string" || !url.trim()) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === "https:" ? parsed.href : null;
    } catch {
        return null;
    }
}

export function cmsDocumentVersionsMatch(expected, current) {
    return Boolean(
        versionOf(expected?.webpage) &&
        versionOf(expected?.downloadable) &&
        versionOf(expected.webpage) === versionOf(current?.webpage) &&
        versionOf(expected.downloadable) === versionOf(current?.downloadable)
    );
}

/** Show only for an inconclusive host verification. The host owns publication enforcement. */
export function showCmsDocumentVerificationConfirmation({
    status,
    title,
    explanation,
    webpage,
    downloadable,
    getCurrentVersions,
    documentObject = document,
}) {
    if (status !== "could-not-verify") {
        throw new Error('Document confirmation requires status "could-not-verify".');
    }
    if (!versionOf(webpage) || !versionOf(downloadable)) {
        throw new Error("Both document version IDs are required.");
    }
    if (typeof getCurrentVersions !== "function") {
        throw new Error("getCurrentVersions is required to reject changed documents.");
    }
    const versions = Object.freeze({
        webpage: webpage.versionId,
        downloadable: downloadable.versionId,
    });
    const expected = {
        webpage: { versionId: versions.webpage },
        downloadable: { versionId: versions.downloadable },
    };
    const webpageUrl = securePreview(webpage.previewUrl);
    const downloadableUrl = securePreview(downloadable.previewUrl);

    return new Promise((resolve) => {
        const opener = documentObject.activeElement;
        const dialog = documentObject.createElement("dialog");
        const id = `cms-document-verification-${++verificationSequence}`;
        dialog.className = "cms-save-confirmation cms-document-verification";
        dialog.setAttribute("aria-modal", "true");
        dialog.setAttribute("aria-labelledby", `${id}-title`);
        dialog.setAttribute("aria-describedby", `${id}-explanation ${id}-instruction`);

        const panel = documentObject.createElement("form");
        panel.className = "cms-save-confirmation__panel";
        panel.method = "dialog";
        const heading = documentObject.createElement("h2");
        heading.id = `${id}-title`;
        heading.tabIndex = -1;
        heading.textContent = title || "Check both documents before publishing";
        const reason = documentObject.createElement("p");
        reason.id = `${id}-explanation`;
        reason.textContent = explanation || "The documents could not be verified automatically.";
        const instruction = documentObject.createElement("p");
        instruction.id = `${id}-instruction`;
        instruction.textContent = "Inspect both previews, then confirm that the downloadable document is the correct match for the webpage.";
        panel.append(heading, reason, instruction);

        const links = documentObject.createElement("div");
        links.className = "cms-document-verification__previews";
        for (const [label, item, url] of [
            ["Webpage", webpage, webpageUrl],
            ["Downloadable document", downloadable, downloadableUrl],
        ]) {
            const row = documentObject.createElement("p");
            if (url) {
                const link = documentObject.createElement("a");
                link.href = url;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = `Preview ${item.label || label}`;
                row.append(link);
            } else {
                row.textContent = `${item.label || label} preview unavailable`;
            }
            links.append(row);
        }
        panel.append(links);

        const acknowledgement = documentObject.createElement("label");
        acknowledgement.className = "cms-document-verification__acknowledgement";
        const checkbox = documentObject.createElement("input");
        checkbox.type = "checkbox";
        checkbox.disabled = !webpageUrl || !downloadableUrl;
        const checkboxText = documentObject.createElement("span");
        checkboxText.textContent = "I inspected both previews and confirm the downloadable document is the correct match for the webpage.";
        acknowledgement.append(checkbox, checkboxText);
        panel.append(acknowledgement);

        const feedback = documentObject.createElement("p");
        feedback.className = "cms-document-verification__feedback";
        feedback.setAttribute("role", "alert");
        panel.append(feedback);
        const actions = documentObject.createElement("div");
        actions.className = "cms-save-confirmation__actions";
        const cancel = documentObject.createElement("button");
        cancel.type = "button";
        cancel.className = "cms-modal__cancel";
        cancel.textContent = "Cancel";
        const confirm = documentObject.createElement("button");
        confirm.type = "submit";
        confirm.className = "cms-save-confirmation__confirm";
        confirm.textContent = "Confirm";
        confirm.disabled = true;
        actions.append(cancel, confirm);
        panel.append(actions);
        dialog.append(panel);

        let settled = false;
        let checking = false;
        const finish = (confirmed) => {
            if (settled) return;
            settled = true;
            if (dialog.open && typeof dialog.close === "function") dialog.close();
            dialog.remove();
            if (opener?.isConnected && typeof opener.focus === "function") opener.focus();
            resolve({ confirmed, versions });
        };
        checkbox.addEventListener("change", () => {
            confirm.disabled = !checkbox.checked || checkbox.disabled;
        });
        cancel.addEventListener("click", () => finish(false));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            finish(false);
        });
        dialog.addEventListener("close", () => finish(false));
        dialog.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                finish(false);
            }
            if (event.key !== "Tab") return;
            const focusables = [
                ...links.querySelectorAll("a"),
                checkbox,
                cancel,
                confirm,
            ].filter((element) => !element.disabled);
            const first = focusables[0];
            const last = focusables.at(-1);
            if (event.shiftKey && (documentObject.activeElement === first || documentObject.activeElement === heading)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (documentObject.activeElement === last || documentObject.activeElement === heading)) {
                event.preventDefault();
                first?.focus();
            }
        });
        panel.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (checking || confirm.disabled || !checkbox.checked || !webpageUrl || !downloadableUrl) return;
            checking = true;
            confirm.disabled = true;
            try {
                const current = await getCurrentVersions();
                if (settled) return;
                if (!cmsDocumentVersionsMatch(expected, current)) {
                    finish(false);
                    return;
                }
                finish(true);
            } catch {
                if (settled) return;
                feedback.textContent = "The document versions could not be checked. Try again or cancel.";
                checking = false;
                confirm.disabled = false;
            }
        });

        documentObject.body.append(dialog);
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
        heading.focus();
    });
}
