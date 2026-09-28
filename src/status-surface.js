// Display models only; the source controllers still own all workflow state.
const surfaces = new WeakMap();
let detailSequence = 0;

export function showCmsStatusDetails({ documentObject, title, explanation, context = [], action = null }) {
    const opener = documentObject.activeElement;
    const dialog = documentObject.createElement('dialog');
    dialog.className = 'cms-save-confirmation cms-status-details';
    const titleId = `cms-status-details-${++detailSequence}`;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.innerHTML = `<form method="dialog" class="cms-save-confirmation__panel">
        <h2 id="${titleId}"></h2><p data-cms-status-explanation></p>
        <div data-cms-status-context></div>
        <div class="cms-save-confirmation__actions">
            <button type="submit" autofocus>Close</button>
            <button type="button" data-cms-status-primary hidden></button>
        </div></form>`;
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('[data-cms-status-explanation]').textContent = explanation;
    for (const text of context) {
        const paragraph = documentObject.createElement('p');
        paragraph.textContent = text;
        dialog.querySelector('[data-cms-status-context]').append(paragraph);
    }
    const finish = () => {
        dialog.remove();
        if (opener?.isConnected) opener.focus();
    };
    const close = () => { if (typeof dialog.close === 'function') dialog.close(); finish(); };
    dialog.addEventListener('close', finish, { once: true });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); close(); });
    const primary = dialog.querySelector('[data-cms-status-primary]');
    if (action) {
        primary.hidden = false;
        primary.textContent = action.label;
        primary.addEventListener('click', () => { close(); action.run(); });
    }
    documentObject.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else {
        // Same native-confirm fallback as the existing save/publish dialogs.
        const windowObject = documentObject.defaultView;
        const text = [title, explanation, ...context].join('\n\n');
        if (action ? windowObject.confirm(`${text}\n\n${action.label}?`) : (windowObject.alert(text), false)) action.run();
        finish();
    }
    return dialog;
}

export function getCmsStatusSurface(shell) {
    if (!shell) return { set() {} };
    if (surfaces.has(shell)) return surfaces.get(shell);
    const documentObject = shell.ownerDocument;
    shell.innerHTML = `<div class="cms-status-strip" data-cms-status-strip>
        <span class="cms-status-strip__spinner" data-cms-status-progress role="progressbar" aria-label="Operation in progress" hidden></span>
        <div class="cms-status-strip__copy">
            <p class="cms-editor-shell__feedback" data-cms-editor-feedback role="status" aria-live="polite" aria-atomic="true"></p>
            <p class="cms-status-strip__supporting" data-cms-status-supporting hidden></p>
        </div>
        <div class="cms-status-strip__actions">
            <button type="button" class="cms-status-link" data-cms-status-action hidden></button>
            <button type="button" class="cms-status-link" data-cms-status-more hidden>See more…</button>
        </div>
    </div>`;
    const message = shell.querySelector('[data-cms-editor-feedback]');
    const progress = shell.querySelector('[data-cms-status-progress]');
    const supporting = shell.querySelector('[data-cms-status-supporting]');
    const action = shell.querySelector('[data-cms-status-action]');
    const more = shell.querySelector('[data-cms-status-more]');
    const sources = new Map();
    let selected;
    let detailModel;
    function details() {
        if (!detailModel) return;
        const context = [...(detailModel.detail.context ?? [])];
        for (const model of sources.values()) {
            if (model !== detailModel && model.detail) context.push(model.detail.explanation);
        }
        showCmsStatusDetails({ documentObject, ...detailModel.detail, context,
            action: detailModel.action ? { ...detailModel.action, label: detailModel.action.detailLabel ?? detailModel.action.label } : null });
    }
    action.addEventListener('click', () => selected?.action?.run());
    more.addEventListener('click', details);
    const surface = {
        set(source, model) {
            if (model) sources.set(source, model);
            else sources.delete(source);
            const ordered = [...sources.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
            selected = ordered[0];
            detailModel = ordered.find(model => model.detail);
            message.textContent = selected?.message ?? 'Ready';
            progress.hidden = !selected?.progress;
            shell.setAttribute('aria-busy', selected?.progress ? 'true' : 'false');
            supporting.textContent = selected?.supporting ?? '';
            supporting.hidden = !selected?.supporting;
            const severity = selected?.severity ?? 'info';
            shell.dataset.cmsStatusSeverity = severity;
            message.setAttribute('role', severity === 'error' ? 'alert' : 'status');
            message.setAttribute('aria-live', severity === 'error' ? 'assertive' : 'polite');
            action.hidden = !selected?.action;
            action.textContent = selected?.action?.label ?? '';
            more.hidden = !detailModel;
        },
    };
    surfaces.set(shell, surface);
    surface.set('initial', { message: 'Ready', priority: -1 });
    return surface;
}
