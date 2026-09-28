// Presentation only: existing action elements retain their listeners and state.
export function installCmsDrawerNavigation(drawer) {
    const trigger = drawer.querySelector('[data-cms-menu-toggle]');
    const menu = drawer.querySelector('[data-cms-menu]');
    const sections = drawer.querySelector('[data-cms-drawer-sections]');
    const history = drawer.querySelector('[data-cms-history-view]');
    const back = drawer.querySelector('[data-cms-history-back]');
    const historyAction = drawer.querySelector('[data-cms-history-open]');
    const content = drawer.querySelector('[data-cms-drawer-content]');
    let editingScrollTop = 0;
    let historyScrollTop = 0;
    function closeMenu(restoreFocus = false) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) trigger.focus();
    }
    function dispatchHistoryEvent(name) {
        const EventConstructor = drawer.ownerDocument.defaultView?.Event;
        if (!EventConstructor) return;
        history.querySelector('[data-cms-history-content]')
            ?.dispatchEvent(new EventConstructor(name, { bubbles: true }));
    }
    function showEditing() {
        const wasHistoryVisible = !history.hidden;
        if (wasHistoryVisible) historyScrollTop = content?.scrollTop ?? 0;
        history.hidden = true;
        sections.hidden = false;
        drawer.dataset.cmsDrawerView = 'editing';
        if (content) content.scrollTop = editingScrollTop;
        if (wasHistoryVisible) dispatchHistoryEvent('cms:history-close');
    }
    trigger.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        trigger.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) menu.querySelector('button:not(:disabled), input:not(:disabled)')?.focus();
    });
    menu.addEventListener('click', event => {
        if (!menu.hidden && event.target.closest('button')) closeMenu(true);
    });
    drawer.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
            event.stopPropagation();
            event.preventDefault();
            closeMenu(true);
        }
    });
    drawer.ownerDocument.addEventListener('click', event => {
        if (!menu.hidden && !menu.contains(event.target) && !trigger.contains(event.target)) closeMenu();
    });
    drawer.addEventListener('focusout', event => {
        if (!menu.hidden && event.relatedTarget && !menu.contains(event.relatedTarget) && event.relatedTarget !== trigger) closeMenu();
    });
    historyAction.addEventListener('click', () => {
        closeMenu();
        editingScrollTop = content?.scrollTop ?? 0;
        sections.hidden = true;
        history.hidden = false;
        drawer.dataset.cmsDrawerView = 'history';
        if (content) content.scrollTop = historyScrollTop;
        back.focus();
        dispatchHistoryEvent('cms:history-open');
    });
    back.addEventListener('click', () => { showEditing(); trigger.focus(); });
    drawer.addEventListener('cms:history-reset-scroll', () => {
        historyScrollTop = 0;
        if (!history.hidden && content) content.scrollTop = 0;
    });
    drawer.addEventListener('cms:show-editing', showEditing);
    drawer.querySelector('[data-cms-drawer-close]').addEventListener('click', () => {
        closeMenu();
        showEditing();
    });
    showEditing();
}
