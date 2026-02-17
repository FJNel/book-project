// Shows a maintenance modal across pages when the global flag is enabled.
(function () {
    const DEFAULT_MAINTENANCE_MODE = false;
    const DEFAULT_CONFIG_URL = 'assets/data/maintenance.json';
    const DISMISS_KEY = 'maintenanceModalDismissed';
    const maintenanceDeferred = {};
    if (!window.maintenanceModalPromise) {
        window.maintenanceModalPromise = new Promise((resolve) => {
            maintenanceDeferred.resolve = resolve;
            window.maintenanceModalResolve = resolve;
        });
    } else if (typeof window.maintenanceModalResolve === 'function') {
        maintenanceDeferred.resolve = window.maintenanceModalResolve;
    }
    function resolveMaintenance(payload) {
        const resolver = maintenanceDeferred.resolve || window.maintenanceModalResolve;
        if (resolver) {
            resolver(payload);
            maintenanceDeferred.resolve = null;
            window.maintenanceModalResolve = null;
        }
    }

    function getBoolean(value) {
        return typeof value === 'boolean' ? value : null;
    }

    function getMaintenanceFlagFromGlobals() {
        if (window.APP_FLAGS && typeof window.APP_FLAGS.maintenance === 'boolean') {
            return window.APP_FLAGS.maintenance;
        }
        if (typeof window.MAINTENANCE_MODE === 'boolean') {
            return window.MAINTENANCE_MODE;
        }
        return null;
    }

    async function getMaintenanceConfig() {
        const globalFlag = getMaintenanceFlagFromGlobals();
        if (globalFlag !== null) {
            console.log('[Maintenance] Using global flag:', globalFlag);
            return { enabled: globalFlag };
        }

        try {
            const response = await fetch(DEFAULT_CONFIG_URL, { cache: 'no-store' });
            if (!response.ok) {
                console.warn('[Maintenance] Config request failed with status:', response.status);
                return { enabled: DEFAULT_MAINTENANCE_MODE };
            }
            const data = await response.json();
            console.log('[Maintenance] Loaded config:', data);
            return {
                enabled: getBoolean(data.enabled) ?? DEFAULT_MAINTENANCE_MODE,
                title: typeof data.title === 'string' ? data.title : null,
                message: typeof data.message === 'string' ? data.message : null,
                disclaimer: typeof data.disclaimer === 'string' ? data.disclaimer : null
            };
        } catch (error) {
            console.warn('[Maintenance] Failed to load maintenance config:', error);
            return { enabled: DEFAULT_MAINTENANCE_MODE };
        }
    }

    function ensureModalMarkup({ title, message, disclaimer } = {}) {
        if (document.getElementById('maintenanceModal')) {
            return;
        }

        const safeTitle = title || 'Undergoing Maintenance';
        const safeMessage = message || 'The Book Project is currently undergoing maintenance.';
        const safeDisclaimer = disclaimer || 'You can continue using the site, but some features may be unavailable or unreliable.';

        const modalWrapper = document.createElement('div');
        modalWrapper.innerHTML = `
            <div class="modal fade" id="maintenanceModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h4 class="modal-title">${safeTitle}</h4>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="mb-2">${safeMessage}</p>
                            <p class="mb-0"><strong>Disclaimer:</strong> ${safeDisclaimer}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Continue</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modalWrapper.firstElementChild);
    }

    function wasDismissedThisSession() {
        try {
            return sessionStorage.getItem(DISMISS_KEY) === 'true';
        } catch (error) {
            return false;
        }
    }

    function markDismissedThisSession() {
        try {
            sessionStorage.setItem(DISMISS_KEY, 'true');
        } catch (error) {
            // Ignore storage errors.
        }
    }

    async function waitForModalManagerIdle({ timeoutMs = 15000 } = {}) {
        const modalManager = window.modalManager;
        if (!modalManager || typeof modalManager.getActiveModalId !== 'function') return null;
        const activeId = modalManager.getActiveModalId();
        if (!activeId || activeId === 'maintenanceModal') return null;
        return new Promise((resolve) => {
            let settled = false;
            const done = (value) => {
                if (settled) return;
                settled = true;
                document.removeEventListener('hidden.bs.modal', onHidden, true);
                clearTimeout(timer);
                resolve(value);
            };
            const onHidden = () => {
                const nextActiveId = modalManager.getActiveModalId();
                if (!nextActiveId || nextActiveId === 'maintenanceModal') {
                    done(null);
                }
            };
            const timer = setTimeout(() => done(activeId), timeoutMs);
            document.addEventListener('hidden.bs.modal', onHidden, true);
        });
    }

    async function showMaintenanceModal() {
        console.log('[Maintenance] Checking maintenance status.');
        if (window.location.pathname.includes('404')) {
            console.log('[Maintenance] Skipping on 404 page.');
            resolveMaintenance({ shown: false, reason: '404' });
            return;
        }

        if (wasDismissedThisSession()) {
            console.log('[Maintenance] Modal dismissed for this session. Skipping display.');
            resolveMaintenance({ shown: false, reason: 'dismissed' });
            return;
        }

        const config = await getMaintenanceConfig();
        if (!config.enabled) {
            console.log('[Maintenance] Maintenance mode disabled.');
            resolveMaintenance({ shown: false, reason: 'disabled' });
            return;
        }
        console.log('[Maintenance] Maintenance mode enabled. Showing modal.');

        ensureModalMarkup(config);
        const modalElement = document.getElementById('maintenanceModal');
        if (!modalElement) {
            return;
        }

        const onDismiss = () => {
            modalElement.removeEventListener('hidden.bs.modal', onDismiss);
            markDismissedThisSession();
            console.log('[Maintenance] Modal dismissed; recorded for session.');
            resolveMaintenance({ shown: true, dismissed: true });
        };

        if (window.modalManager && typeof window.modalManager.showModal === 'function') {
            const stackedParentId = await waitForModalManagerIdle();
            modalElement.addEventListener('hidden.bs.modal', onDismiss, { once: true });
            modalElement.addEventListener('hidden.bs.modal', () => {
                window.modalStack?.pop('maintenanceModal');
            }, { once: true });
            console.log('[Maintenance] Showing modal via modalManager.');
            if (stackedParentId && window.modalStack?.push) {
                await window.modalStack.push(stackedParentId, 'maintenanceModal', { backdrop: true, keyboard: true });
                return;
            }
            window.modalManager.showModal(modalElement, { backdrop: true, keyboard: true });
            return;
        }

        if (window.bootstrap && window.bootstrap.Modal) {
            modalElement.addEventListener('hidden.bs.modal', onDismiss, { once: true });
            const instance = window.bootstrap.Modal.getOrCreateInstance(modalElement, {
                backdrop: true,
                keyboard: true
            });
            console.log('[Maintenance] Showing modal via Bootstrap.');
            instance.show();
            return;
        }

        const fallbackText = `${config.title || 'Undergoing Maintenance'}: ${config.message || 'The Book Project is currently undergoing maintenance.'} Disclaimer: ${config.disclaimer || 'Some features may be unavailable.'}`;
        console.warn('[Maintenance] Using fallback alert for maintenance modal.');
        alert(fallbackText);
        markDismissedThisSession();
        console.log('[Maintenance] Fallback alert used; recorded dismissal.');
        resolveMaintenance({ shown: true, dismissed: true, fallback: true });
    }

    async function waitForAppInitialization() {
        const initPromise = window.appInitializationPromise;
        if (initPromise && typeof initPromise.then === 'function') {
            try {
                await initPromise;
            } catch (error) {
                console.warn('[Maintenance] App initialization promise rejected.', error);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', async () => {
        await waitForAppInitialization();
        console.log('[Maintenance] App initialization complete, evaluating maintenance modal.');
        await showMaintenanceModal();
    });
})();
