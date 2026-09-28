export const CMS_FIELD_TYPES = Object.freeze({
    TEXT: "text",
    TEXTAREA: "textarea",
    URL: "url",
    EMAIL: "email",
    PHONE: "phone",
    PAGE: "page",
    IMAGE: "image",
});

export const CMS_SUPPORTED_FIELD_TYPES = Object.freeze(
    new Set(Object.values(CMS_FIELD_TYPES)),
);
