import {
    getValueAtCmsPath,
    joinCmsContentPath,
} from "./content-path.js";

import {
    createCmsFieldControl,
} from "./field-control.js";

import {
    createCmsEditorShell,
} from "./editor-shell.js";

import { installCmsDrawerNavigation } from "./drawer-navigation.js";

const CMS_DRAWER_ID = "cms-editor-drawer";
const CMS_EDITOR_OPEN_CLASS = "cms-editor-surface-open";


function attachHeaderActions(
    drawer,
    headerActions,
) {
    if (!headerActions) {
        return;
    }

    const slot =
        drawer.querySelector(
            "[data-cms-editor-header-actions]",
        );

    slot?.append(
        headerActions,
    );
}

export function createCmsDrawer({
    documentObject = document,
    sectionEntries,
    siteContent,
    showPreview,
    headerActions = null,
    saveButtonLabel = "Save Current Changes",
    revertButtonLabel = "Undo All Changes and Revert to Live Site",
    publishButtonLabel = "Publish Website",
    resolveImagePreviewUrl = null,
}) {
    const existing =
        documentObject.getElementById(
            CMS_DRAWER_ID,
        );

    if (existing) {
        attachHeaderActions(
            existing,
            headerActions,
        );

        return existing;
    }

    const drawer =
        documentObject.createElement(
            "aside",
        );

    drawer.id = CMS_DRAWER_ID;
    drawer.className = "cms-drawer";

    drawer.setAttribute(
        "aria-label",
        "Website editor",
    );

    drawer.setAttribute(
        "aria-hidden",
        "true",
    );

    drawer.setAttribute(
        "inert",
        "",
    );

    const header =
        documentObject.createElement(
            "div",
        );

    header.className = "cms-drawer__header";

    header.innerHTML = `
    <h2 class="cms-drawer__title">
      Editor
    </h2>

    <button type="button" class="cms-drawer__menu-toggle" data-cms-menu-toggle
      aria-label="Editor options" aria-expanded="false" aria-controls="cms-editor-menu">⋯</button>
    <div class="cms-drawer__menu" id="cms-editor-menu" data-cms-menu hidden>
      <button type="button" data-cms-history-open disabled>Revision History</button>
      <div data-cms-menu-preview></div>
      <hr>
      <div class="cms-drawer__header-actions" data-cms-editor-header-actions></div>
    </div>

    <button
      class="cms-drawer__close"
      type="button"
      aria-label="Close website editor"
      data-cms-drawer-close
    >
      ×
    </button>
  `;

    const editorShell =
        createCmsEditorShell({
            documentObject,
            contentMode:
                siteContent.mode ??
                "draft",
        });

    const previewControl =
        documentObject.createElement(
            "label",
        );

    previewControl.className =
        "cms-preview-toggle";

    previewControl.innerHTML = `
    <span>Preview Changes</span>

    <input
      type="checkbox"
      data-cms-preview-toggle
    >
  `;

    const previewInput =
        previewControl.querySelector(
            "[data-cms-preview-toggle]",
        );

    previewInput.checked = showPreview;

    const sectionsContainer =
        documentObject.createElement(
            "div",
        );

    sectionsContainer.className =
        "cms-drawer__sections";

    sectionsContainer.dataset.cmsDrawerSections =
        "";

    sectionEntries.forEach(
        (
            {
                sectionPath,
                schema,
            },
        ) => {
            const details =
                documentObject.createElement(
                    "details",
                );

            details.className =
                "cms-drawer-section";

            details.dataset.cmsDrawerSection =
                sectionPath;

            details.dataset.cmsSchema =
                schema.id;

            const summary =
                documentObject.createElement(
                    "summary",
                );

            summary.className =
                "cms-drawer-section__summary";

            summary.textContent = schema.label;

            const fields =
                documentObject.createElement(
                    "div",
                );

            fields.className =
                "cms-drawer-section__fields";

            const fieldGroups =
                new Map();

            schema.fields.forEach(
                (field, fieldIndex) => {
                    const fullPath =
                        joinCmsContentPath(
                            sectionPath,
                            field.key,
                        );

                    const value =
                        getValueAtCmsPath(
                            siteContent,
                            fullPath,
                        );

                    const previewValue =
                        typeof resolveImagePreviewUrl === "function"
                            ? resolveImagePreviewUrl({
                                sectionPath,
                                field,
                                value,
                            })
                            : value;

                    const {
                        wrapper,
                        control,
                        fileInput,
                    } = createCmsFieldControl({
                        documentObject,
                        schemaId: schema.id,
                        field,
                        value,
                        previewValue,
                        index: fieldIndex,
                    });

                    control.dataset.cmsSectionPath =
                        sectionPath;

                    control.dataset.cmsSchemaId =
                        schema.id;

                    if (fileInput) {
                        fileInput.dataset.cmsSectionPath =
                            sectionPath;
                        fileInput.dataset.cmsSchemaId =
                            schema.id;
                    }

                    if (field.group) {
                        let group =
                            fieldGroups.get(
                                field.group,
                            );

                        if (!group) {
                            group =
                                documentObject.createElement(
                                    "div",
                                );
                            group.className =
                                "cms-field-group";
                            group.dataset.cmsFieldGroup =
                                field.group;

                            if (field.groupLabel) {
                                const groupTitle =
                                    documentObject.createElement(
                                        "h4",
                                    );

                                groupTitle.className =
                                    "cms-field-group__title";
                                groupTitle.textContent =
                                    field.groupLabel;

                                group.append(groupTitle);
                            }

                            fieldGroups.set(
                                field.group,
                                group,
                            );
                            fields.append(group);
                        }

                        group.append(wrapper);
                    } else {
                        fields.append(wrapper);
                    }
                },
            );

            details.append(
                summary,
                fields,
            );

            sectionsContainer.append(
                details,
            );
        },
    );

    const footer =
        documentObject.createElement(
            "div",
        );

    footer.className =
        "cms-drawer__footer";

    footer.innerHTML = `
        <div class="cms-drawer__footer-actions">
            <button
            class="cms-revert-button"
            type="button"
            data-cms-revert-live
            >
            ${revertButtonLabel}
            </button>

            <button
            class="cms-local-save-button"
            type="button"
            data-cms-save-local
            >
            ${saveButtonLabel}
            </button>

            <button
            class="cms-deploy-button"
            type="button"
            disabled
            aria-disabled="true"
            data-cms-save-deploy
            >
            ${publishButtonLabel}
            </button>
        </div>
    `;

    const menu = header.querySelector('[data-cms-menu]');
    menu.insertBefore(footer.querySelector('[data-cms-revert-live]'), menu.querySelector('[data-cms-menu-preview]'));
    header.querySelector('[data-cms-menu-preview]').append(previewControl);
    const central = documentObject.createElement('div');
    central.className = 'cms-drawer__content';
    central.dataset.cmsDrawerContent = '';
    const history = documentObject.createElement('div');
    history.className = 'cms-drawer__history';
    history.dataset.cmsHistoryView = '';
    history.hidden = true;
    history.innerHTML = '<div class="cms-history-toolbar"><button type="button" class="cms-status-link" data-cms-history-back>← Back to editing</button></div><div data-cms-history-content></div>';
    central.append(sectionsContainer, history);

    drawer.append(
        header,
        editorShell,
        central,
        footer,
    );

    attachHeaderActions(
        drawer,
        headerActions,
    );

    documentObject.body.append(drawer);
    installCmsDrawerNavigation(drawer);

    return drawer;
}

export function openCmsDrawer(drawer) {
    drawer.ownerDocument.body.classList.add(
        CMS_EDITOR_OPEN_CLASS,
    );

    drawer.classList.add(
        "cms-drawer--open",
    );

    drawer.setAttribute(
        "aria-hidden",
        "false",
    );

    drawer.removeAttribute(
        "inert",
    );
}

export function closeCmsDrawer(drawer) {
    drawer.ownerDocument.body.classList.remove(
        CMS_EDITOR_OPEN_CLASS,
    );

    drawer.classList.remove(
        "cms-drawer--open",
    );

    drawer.setAttribute(
        "aria-hidden",
        "true",
    );

    drawer.setAttribute(
        "inert",
        "",
    );
}

export function getCmsDrawerSection(
    drawer,
    sectionPath,
) {
    return Array.from(
        drawer.querySelectorAll(
            "[data-cms-drawer-section]",
        ),
    ).find(
        (details) =>
            details.dataset.cmsDrawerSection ===
            sectionPath,
    ) ?? null;
}

export function openCmsDrawerSection(
    drawer,
    sectionPath,
) {
    drawer.dispatchEvent(new drawer.ownerDocument.defaultView.Event('cms:show-editing'));
    const sections = Array.from(
        drawer.querySelectorAll(
            "[data-cms-drawer-section]",
        ),
    );

    for (const details of sections) {
        details.open =
            details.dataset.cmsDrawerSection ===
            sectionPath;
    }

    return getCmsDrawerSection(
        drawer,
        sectionPath,
    );
}
