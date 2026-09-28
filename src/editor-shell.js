import { getCmsStatusSurface } from './status-surface.js';

export function createCmsEditorShell({ documentObject = document, contentMode = 'draft' } = {}) {
    const shell = documentObject.createElement('section');
    shell.className = 'cms-editor-shell';
    shell.dataset.cmsEditorShell = '';
    shell.dataset.cmsEditorState = 'idle';
    shell.dataset.cmsContentMode = contentMode;
    shell.setAttribute('aria-label', 'Editor status');
    getCmsStatusSurface(shell);
    return shell;
}
