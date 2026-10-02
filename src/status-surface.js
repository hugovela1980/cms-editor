// Display models only; the source controllers still own all workflow state.
const surfaces = new WeakMap();
let detailSequence = 0;
let inlineDetailSequence = 0;

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
    const strip = documentObject.createElement('div');
    strip.className = 'cms-status-strip';
    strip.dataset.cmsStatusStrip = '';
    const progress = documentObject.createElement('span');
    progress.className = 'cms-status-strip__spinner';
    progress.dataset.cmsStatusProgress = '';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Operation in progress');
    progress.hidden = true;
    const copy = documentObject.createElement('div');
    copy.className = 'cms-status-strip__copy';
    const message = documentObject.createElement('p');
    message.className = 'cms-editor-shell__feedback';
    message.dataset.cmsEditorFeedback = '';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    message.setAttribute('aria-atomic', 'true');
    const supporting = documentObject.createElement('p');
    supporting.className = 'cms-status-strip__supporting';
    supporting.dataset.cmsStatusSupporting = '';
    supporting.hidden = true;
    copy.append(message, supporting);
    const actions = documentObject.createElement('div');
    actions.className = 'cms-status-strip__actions';
    const action = documentObject.createElement('button');
    action.type = 'button';
    action.className = 'cms-status-link';
    action.dataset.cmsStatusAction = '';
    action.hidden = true;
    const more = documentObject.createElement('button');
    more.type = 'button';
    more.className = 'cms-status-link';
    more.dataset.cmsStatusMore = '';
    more.hidden = true;
    more.textContent = 'See more…';
    const inlineDetails = documentObject.createElement('div');
    inlineDetails.id = `cms-status-inline-details-${++inlineDetailSequence}`;
    inlineDetails.className = 'cms-status-strip__details';
    inlineDetails.dataset.cmsStatusInlineDetails = '';
    inlineDetails.setAttribute('aria-label', 'Publication progress');
    inlineDetails.hidden = true;
    const inlineList = documentObject.createElement('ol');
    inlineList.className = 'cms-publication-progress';
    inlineDetails.append(inlineList);
    actions.append(action, more);
    strip.append(progress, copy, actions, inlineDetails);
    shell.replaceChildren(strip);
    const sources = new Map();
    let selected;
    let detailModel;
    let inlineDetailModel;
    let inlineDetailId = null;
    let inlineExpanded = false;
    function showModalDetails() {
        if (!detailModel) return;
        const context = [...(detailModel.detail.context ?? [])];
        for (const model of sources.values()) {
            if (model !== detailModel && model.detail) context.push(model.detail.explanation);
        }
        showCmsStatusDetails({ documentObject, ...detailModel.detail, context,
            action: detailModel.action ? { ...detailModel.action, label: detailModel.action.detailLabel ?? detailModel.action.label } : null });
    }
    function renderInlineDetails() {
        inlineList.replaceChildren();
        for (const step of inlineDetailModel?.inlineDetails.steps ?? []) {
            const item = documentObject.createElement('li');
            item.className = 'cms-publication-progress__step';
            item.dataset.cmsPublicationStage = step.stage;
            item.dataset.cmsPublicationState = step.state;
            item.setAttribute(
                'aria-label',
                `${step.label}: ${step.state === 'active' ? 'current' : step.state}`,
            );
            if (step.state === 'active') item.setAttribute('aria-current', 'step');
            const marker = documentObject.createElement('span');
            marker.className = 'cms-publication-progress__marker';
            marker.setAttribute('aria-hidden', 'true');
            marker.textContent = ({ completed: '✓', active: '●', pending: '○' })[step.state] ?? '○';
            const label = documentObject.createElement('span');
            label.textContent = step.label;
            item.append(marker, label);
            inlineList.append(item);
        }
        inlineDetails.hidden = !inlineExpanded || !inlineDetailModel;
        more.textContent = inlineExpanded && inlineDetailModel ? 'Show less' : 'See more…';
        more.setAttribute('aria-expanded', String(Boolean(inlineExpanded && inlineDetailModel)));
        if (inlineDetailModel) more.setAttribute('aria-controls', inlineDetails.id);
        else more.removeAttribute('aria-controls');
    }
    action.addEventListener('click', () => selected?.action?.run());
    more.addEventListener('click', () => {
        if (inlineDetailModel) {
            inlineExpanded = !inlineExpanded;
            renderInlineDetails();
            return;
        }
        showModalDetails();
    });
    const surface = {
        set(source, model) {
            if (model) sources.set(source, model);
            else sources.delete(source);
            const ordered = [...sources.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
            selected = ordered[0];
            detailModel = ordered.find(model => model.detail);
            inlineDetailModel = selected?.inlineDetails ? selected : null;
            const nextInlineDetailId = inlineDetailModel?.inlineDetails.id ?? null;
            if (nextInlineDetailId !== inlineDetailId) {
                inlineDetailId = nextInlineDetailId;
                inlineExpanded = false;
            }
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
            more.hidden = !inlineDetailModel && !detailModel;
            renderInlineDetails();
        },
    };
    surfaces.set(shell, surface);
    surface.set('initial', { message: 'Ready', priority: -1 });
    return surface;
}
