import {
    CMS_FIELD_TYPES,
} from "./field-types.js";
import { createCmsTextListControl } from "./text-list-control.js";

function createPageSelect(
    documentObject,
    field,
) {
    const select =
        documentObject.createElement(
            "select",
        );

    const placeholder =
        documentObject.createElement(
            "option",
        );

    placeholder.value = "";
    placeholder.textContent =
        "Select a page";

    select.append(placeholder);

    for (const option of field.options) {
        const optionElement =
            documentObject.createElement(
                "option",
            );

        optionElement.value =
            option.value;

        optionElement.textContent =
            option.label;

        select.append(optionElement);
    }

    return select;
}

function createInputForField(
    documentObject,
    field,
) {
    if (
        field.type ===
        CMS_FIELD_TYPES.TEXTAREA
    ) {
        return documentObject.createElement(
            "textarea",
        );
    }

    if (
        field.type ===
        CMS_FIELD_TYPES.PAGE
    ) {
        return createPageSelect(
            documentObject,
            field,
        );
    }

    const input =
        documentObject.createElement(
            "input",
        );

    switch (field.type) {
        case CMS_FIELD_TYPES.TEXT:
            input.type = "text";
            break;

        case CMS_FIELD_TYPES.URL:
            input.type = "url";
            break;

        case CMS_FIELD_TYPES.EMAIL:
            input.type = "email";
            break;

        case CMS_FIELD_TYPES.PHONE:
            input.type = "tel";
            break;

        default:
            throw new Error(
                `Unsupported CMS field type "${field.type}".`,
            );
    }

    return input;
}

function readableBytes(value) {
    if (!Number.isInteger(value) || value <= 0) {
        return "";
    }

    if (value >= 1024 * 1024) {
        return `${Math.round(value / (1024 * 1024))} MB`;
    }

    return `${Math.round(value / 1024)} KB`;
}

function createImageFieldControl({
    documentObject,
    schemaId,
    field,
    value,
    previewValue,
    index,
}) {
    const wrapper = documentObject.createElement("div");
    wrapper.className = "cms-field cms-field--image";

    const controlId = ["cms", schemaId, String(index)].join("-");
    const fileInputId = `${controlId}-file`;
    const errorId = `${controlId}-error`;
    const statusId = `${controlId}-upload-status`;

    const label = documentObject.createElement("span");
    label.className = "cms-field__label";
    label.id = `${controlId}-label`;
    label.textContent = field.label;

    const imagePanel = documentObject.createElement("div");
    imagePanel.className = "cms-image-field";

    const preview = documentObject.createElement("img");
    preview.className = "cms-image-field__preview";
    preview.dataset.cmsImagePreview = "";
    preview.alt = `Current ${field.label}`;
    const initialPreviewValue = String(previewValue ?? value ?? "");
    if (initialPreviewValue) {
        preview.src = initialPreviewValue;
    }

    const current = documentObject.createElement("p");
    current.className = "cms-image-field__current";
    current.dataset.cmsImageCurrent = "";
    current.textContent = String(value ?? "") || "No image selected";

    const control = documentObject.createElement("input");
    control.type = "hidden";
    control.id = controlId;
    control.name = field.key;
    control.className = "cms-field__control cms-image-field__value";
    control.dataset.cmsFieldKey = field.key;
    control.value = value === null || value === undefined ? "" : String(value);
    control.dataset.cmsPreviewValue = String(previewValue ?? value ?? "");
    control.setAttribute("aria-describedby", `${errorId} ${statusId}`);

    const fileInput = documentObject.createElement("input");
    fileInput.type = "file";
    fileInput.id = fileInputId;
    fileInput.className = "cms-image-field__input";
    fileInput.dataset.cmsImageFile = "";
    fileInput.dataset.cmsImageFieldKey = field.key;
    fileInput.setAttribute("aria-labelledby", label.id);
    fileInput.setAttribute("aria-describedby", `${errorId} ${statusId}`);
    if (Array.isArray(field.accept)) {
        fileInput.accept = field.accept.join(",");
    }

    const uploadLabel = documentObject.createElement("label");
    uploadLabel.className = "cms-image-field__replace";
    uploadLabel.dataset.cmsImageUploadLabel = "";
    uploadLabel.htmlFor = fileInputId;
    uploadLabel.textContent = value ? "Replace image" : "Choose image";

    const actions = documentObject.createElement("div");
    actions.className = "cms-image-field__actions";
    actions.append(uploadLabel);

    let removeButton = null;
    if (field.required !== true) {
        removeButton = documentObject.createElement("button");
        removeButton.type = "button";
        removeButton.className = "cms-image-field__remove";
        removeButton.dataset.cmsImageRemove = "";
        removeButton.textContent = "Remove image";
        removeButton.hidden = !value;
        actions.append(removeButton);
    }

    const hint = documentObject.createElement("p");
    hint.className = "cms-image-field__hint";
    const typeText = Array.isArray(field.accept)
        ? field.accept.map((type) => type.replace("image/", "").toUpperCase()).join(", ")
        : "approved image types";
    const sizeText = readableBytes(field.maxBytes);
    hint.textContent = `${typeText}${sizeText ? ` · max ${sizeText}` : ""}`;

    const status = documentObject.createElement("p");
    status.id = statusId;
    status.className = "cms-image-field__status";
    status.dataset.cmsImageStatus = "";
    status.setAttribute("aria-live", "polite");

    const errorElement = documentObject.createElement("p");
    errorElement.id = errorId;
    errorElement.className = "cms-field__error";
    errorElement.dataset.cmsFieldError = "";
    errorElement.hidden = true;

    imagePanel.append(
        preview,
        current,
        fileInput,
        actions,
        hint,
        status,
    );

    wrapper.append(
        label,
        imagePanel,
        control,
        errorElement,
    );

    return {
        wrapper,
        control,
        errorElement,
        fileInput,
        imagePreview: preview,
        imageRemoveButton: removeButton,
        imageUploadLabel: uploadLabel,
        imageStatus: status,
    };
}

function createFileFieldControl({ documentObject, schemaId, field, value, index }) {
    const wrapper = documentObject.createElement("div");
    wrapper.className = "cms-field cms-field--file";
    const controlId = ["cms", schemaId, String(index)].join("-");
    const fileInputId = `${controlId}-file`;
    const currentId = `${controlId}-current`;
    const actionId = `${controlId}-action`;
    const statusId = `${controlId}-status`;
    const hintId = `${controlId}-hint`;
    const errorId = `${controlId}-error`;

    const label = documentObject.createElement("label");
    label.className = "cms-field__label";
    label.htmlFor = fileInputId;
    label.textContent = field.label;

    const control = documentObject.createElement("input");
    control.type = "hidden";
    control.id = controlId;
    control.name = field.key;
    control.className = "cms-field__control cms-file-field__value";
    control.dataset.cmsFieldKey = field.key;
    control.value = value == null ? "" : String(value);

    const fileInput = documentObject.createElement("input");
    fileInput.type = "file";
    fileInput.id = fileInputId;
    fileInput.className = "cms-file-field__input";
    fileInput.dataset.cmsFileInput = "";
    fileInput.dataset.cmsFileFieldKey = field.key;
    fileInput.accept = field.accept.join(",");
    fileInput.setAttribute("aria-describedby", `${currentId} ${actionId} ${hintId} ${statusId} ${errorId}`);
    if (field.required === true) fileInput.setAttribute("aria-required", "true");

    const action = documentObject.createElement("p");
    action.className = "cms-file-field__action";
    action.id = actionId;
    action.dataset.cmsFileAction = "";
    action.textContent = value ? "Replace file" : "Choose file";
    const current = documentObject.createElement("p");
    current.className = "cms-file-field__current";
    current.id = currentId;
    current.dataset.cmsFileCurrent = "";
    current.textContent = value ? "Loading file details…" : "No file selected";
    const hint = documentObject.createElement("p");
    hint.id = hintId;
    hint.className = "cms-file-field__hint";
    hint.textContent = field.hint ?? `${field.accept.join(", ")}${readableBytes(field.maxBytes) ? ` · max ${readableBytes(field.maxBytes)}` : ""}`;
    const status = documentObject.createElement("p");
    status.id = statusId;
    status.className = "cms-file-field__status";
    status.dataset.cmsFileStatus = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const errorElement = documentObject.createElement("p");
    errorElement.id = errorId;
    errorElement.className = "cms-field__error";
    errorElement.dataset.cmsFieldError = "";
    errorElement.hidden = true;

    wrapper.append(label, action, current, fileInput, hint, status, control, errorElement);
    return { wrapper, control, fileInput, fileCurrent: current, fileAction: action, fileStatus: status, errorElement };
}

export function clearCmsOptionalImageControl({
    control,
    field,
    documentObject = document,
}) {
    if (
        field?.type !== CMS_FIELD_TYPES.IMAGE ||
        field.required === true ||
        !control?.value
    ) {
        return false;
    }

    control.value = "";
    delete control.dataset.cmsPreviewValue;

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

    return true;
}

export function createCmsFieldControl({
    documentObject = document,
    schemaId,
    sectionPath,
    field,
    value,
    previewValue = value,
    index,
}) {
    if (field.type === CMS_FIELD_TYPES.TEXT_LIST) {
        return createCmsTextListControl({ documentObject, schemaId, sectionPath, field, value, index });
    }
    if (field.type === CMS_FIELD_TYPES.IMAGE) {
        return createImageFieldControl({
            documentObject,
            schemaId,
            field,
            value,
            previewValue,
            index,
        });
    }
    if (field.type === CMS_FIELD_TYPES.FILE) {
        return createFileFieldControl({ documentObject, schemaId, field, value, index });
    }

    const wrapper =
        documentObject.createElement(
            "div",
        );

    wrapper.className =
        "cms-field";

    const controlId = [
        "cms",
        schemaId,
        String(index),
    ].join("-");

    const errorId =
        `${controlId}-error`;

    const label =
        documentObject.createElement(
            "label",
        );

    label.className =
        "cms-field__label";

    label.htmlFor = controlId;
    label.textContent = field.label;

    const control =
        createInputForField(
            documentObject,
            field,
        );

    control.id = controlId;
    control.name = field.key;
    control.className =
        "cms-field__control";

    control.dataset.cmsFieldKey =
        field.key;

    control.value =
        value === null ||
        value === undefined
            ? ""
            : String(value);

    control.setAttribute(
        "aria-describedby",
        errorId,
    );

    if (field.required === true) {
        control.required = true;
    }

    if (
        Number.isInteger(field.maxLength) &&
        field.maxLength > 0
    ) {
        control.maxLength =
            field.maxLength;
    }

    const errorElement =
        documentObject.createElement(
            "p",
        );

    errorElement.id = errorId;
    errorElement.className =
        "cms-field__error";
    errorElement.dataset.cmsFieldError =
        "";
    errorElement.hidden = true;

    wrapper.append(
        label,
        control,
        errorElement,
    );

    return {
        wrapper,
        control,
        errorElement,
    };
}
