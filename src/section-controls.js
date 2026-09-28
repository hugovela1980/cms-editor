const EDITABLE_SECTION_SELECTOR = [
    "[data-cms-section]",
    "[data-cms-schema]",
].join("");

const GLOBAL_EDIT_CONTROL_ID =
    "cms-global-edit-control";

export function discoverCmsSections(
    documentObject = document,
) {
    return Array.from(
        documentObject.querySelectorAll(
            EDITABLE_SECTION_SELECTOR,
        ),
    );
}

export function readCmsSectionContract(
    section,
    { requireSchema },
) {
    const sectionPath =
        section.dataset.cmsSection;

    const schemaId =
        section.dataset.cmsSchema;

    if (!sectionPath || !schemaId) {
        throw new Error(
            "CMS section is missing its editing contract.",
        );
    }

    return {
        sectionPath,
        schemaId,
        schema:
            requireSchema(schemaId),
    };
}


function isTypingTarget(target) {
    if (!target) {
        return false;
    }

    const tagName =
        String(
            target.tagName ?? "",
        ).toLowerCase();

    if (
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
    ) {
        return true;
    }

    return Boolean(
        target.closest?.(
            '[contenteditable]:not([contenteditable="false"])',
        ),
    );
}

export function installCmsEditControlVisibilityShortcut({
    editControl,
    drawer,
    documentObject = document,
    key = "0",
} = {}) {
    if (!editControl || !drawer) {
        throw new Error(
            "CMS edit-control shortcut requires an edit control and drawer.",
        );
    }

    const onKeyDown =
        (event) => {
            if (
                event.key !== key ||
                event.defaultPrevented ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey
            ) {
                return;
            }

            if (
                drawer.getAttribute(
                    "aria-hidden",
                ) === "false"
            ) {
                return;
            }

            if (
                isTypingTarget(
                    event.target,
                )
            ) {
                return;
            }

            event.preventDefault();

            editControl.hidden =
                !editControl.hidden;
        };

    documentObject.addEventListener(
        "keydown",
        onKeyDown,
    );

    return () => {
        documentObject.removeEventListener(
            "keydown",
            onKeyDown,
        );
    };
}

export function createCmsGlobalEditControl({
    documentObject = document,
} = {}) {
    const existing =
        documentObject.getElementById(
            GLOBAL_EDIT_CONTROL_ID,
        );

    if (existing) {
        return existing;
    }

    const button =
        documentObject.createElement(
            "button",
        );

    button.id =
        GLOBAL_EDIT_CONTROL_ID;

    button.className =
        "cms-edit-control";

    button.type =
        "button";

    button.textContent =
        "Edit";

    button.setAttribute(
        "aria-label",
        "Edit this page",
    );

    button.dataset.cmsGlobalEdit = "";

    documentObject.body.append(button);

    return button;
}