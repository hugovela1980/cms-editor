export function createCmsTextListControl({ documentObject, schemaId, sectionPath, field, value, index }) {
    const wrapper = documentObject.createElement("div");
    wrapper.className = "cms-field cms-field--text-list";

    const control = documentObject.createElement("fieldset");
    control.className = "cms-text-list";
    control.dataset.cmsFieldKey = field.key;
    control.id = `cms-${encodeURIComponent(sectionPath ?? schemaId)}-${index}`;

    const legend = documentObject.createElement("legend");
    legend.className = "cms-field__label";
    legend.textContent = field.label;
    const rows = documentObject.createElement("div");
    rows.className = "cms-text-list__rows";
    const addButton = documentObject.createElement("button");
    addButton.type = "button";
    addButton.className = "cms-text-list__add";
    addButton.textContent = field.addButtonLabel ?? `Add ${field.label} item`;
    const errorElement = documentObject.createElement("p");
    errorElement.id = `${control.id}-error`;
    errorElement.className = "cms-field__error";
    errorElement.dataset.cmsFieldError = "";
    errorElement.hidden = true;
    control.setAttribute("aria-describedby", errorElement.id);

    function inputs() {
        return Array.from(rows.querySelectorAll("input"));
    }

    function emitInput() {
        const EventConstructor = documentObject.defaultView?.Event ?? Event;
        control.dispatchEvent(new EventConstructor("input", { bubbles: true }));
    }

    function refreshRows() {
        const current = inputs();
        current.forEach((input, position) => {
            const row = input.parentElement;
            const label = row.querySelector("label");
            const remove = row.querySelector("button");
            input.id = `${control.id}-item-${position}`;
            label.htmlFor = input.id;
            label.textContent = `${field.label} item ${position + 1}`;
            remove.setAttribute("aria-label", `Remove ${field.label} item ${position + 1}`);
            remove.disabled = current.length <= (field.minItems ?? (field.required ? 1 : 0));
        });
    }

    function appendRow(item, focus = false) {
        const row = documentObject.createElement("div");
        row.className = "cms-text-list__row";
        const label = documentObject.createElement("label");
        label.className = "cms-text-list__label";
        const input = documentObject.createElement("input");
        input.type = "text";
        input.className = "cms-field__control";
        input.value = item;
        input.setAttribute("aria-describedby", errorElement.id);
        if (Number.isInteger(field.maxLength)) input.maxLength = field.maxLength;
        const remove = documentObject.createElement("button");
        remove.type = "button";
        remove.className = "cms-text-list__remove";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            if (remove.disabled) return;
            const position = inputs().indexOf(input);
            row.remove();
            refreshRows();
            const remaining = inputs();
            (remaining[Math.min(position, remaining.length - 1)] ?? addButton).focus();
            emitInput();
        });
        row.append(label, input, remove);
        rows.append(row);
        refreshRows();
        if (focus) input.focus();
    }

    Object.defineProperty(control, "value", {
        get() { return inputs().map((input) => input.value); },
        set(next) {
            rows.replaceChildren();
            if (Array.isArray(next)) next.forEach((item) => appendRow(String(item)));
        },
    });

    addButton.addEventListener("click", () => {
        appendRow("", true);
        emitInput();
    });
    control.append(legend, rows, addButton);
    wrapper.append(control, errorElement);
    control.value = value;
    return { wrapper, control, errorElement };
}
