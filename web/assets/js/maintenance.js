// Shows a maintenance modal across pages when the global flag is enabled.
(function () {
    const DEFAULT_MAINTENANCE_MODE = false;
    const DEFAULT_CONFIG_URL = 'assets/data/maintenance.json';
    const DISMISS_KEY = 'maintenanceModalDismissed';

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
            return { enabled: globalFlag };
        }

        try {
            const response = await fetch(DEFAULT_CONFIG_URL, { cache: 'no-store' });
            if (!response.ok) {
                return { enabled: DEFAULT_MAINTENANCE_MODE };
            }
            const data = await response.json();
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

    async function showMaintenanceModal() {
        if (window.location.pathname.includes('404')) {
            return;
        }

        if (wasDismissedThisSession()) {
            return;
        }

        const config = await getMaintenanceConfig();
        if (!config.enabled) {
            return;
        }

        ensureModalMarkup(config);
        const modalElement = document.getElementById('maintenanceModal');
        if (!modalElement) {
            return;
        }

        const onDismiss = () => {
            modalElement.removeEventListener('hidden.bs.modal', onDismiss);
            markDismissedThisSession();
        };

        if (window.modalManager && typeof window.modalManager.showModal === 'function') {
            modalElement.addEventListener('hidden.bs.modal', onDismiss, { once: true });
            window.modalManager.showModal(modalElement, { backdrop: true, keyboard: true });
            return;
        }

        if (window.bootstrap && window.bootstrap.Modal) {
            modalElement.addEventListener('hidden.bs.modal', onDismiss, { once: true });
            const instance = window.bootstrap.Modal.getOrCreateInstance(modalElement, {
                backdrop: true,
                keyboard: true
            });
            instance.show();
            return;
        }

        const fallbackText = `${config.title || 'Undergoing Maintenance'}: ${config.message || 'The Book Project is currently undergoing maintenance.'} Disclaimer: ${config.disclaimer || 'Some features may be unavailable.'}`;
        alert(fallbackText);
        markDismissedThisSession();
    }

    document.addEventListener('DOMContentLoaded', showMaintenanceModal);
})();
