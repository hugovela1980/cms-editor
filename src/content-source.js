const CMS_CONTENT_ELEMENT_ID = "cms-site-content";

export function readCmsSiteContent(
    documentObject = document,
) {
    const element = documentObject.getElementById(
        CMS_CONTENT_ELEMENT_ID,
    );

    if (!element) {
        throw new Error(
            `Missing CMS content payload "#${CMS_CONTENT_ELEMENT_ID}".`
        );
    }

    const rawContent = element.textContent ?? "";

    if (rawContent.trim() === "") {
        throw new Error(
            "CMS content payload is empty."
        );
    }

    try {
        return JSON.parse(rawContent);
    } catch {
        throw new Error(
            "CMS content payload contains invalid JSON."
        );
    }
}