// Shared add-record modals (Book Type, Author, Publisher, Series, Storage Location).
(function () {
    if (window.sharedAddModals) return;

    const log = (...args) => console.log('[Shared Add Modals]', ...args);
    const warn = (...args) => console.warn('[Shared Add Modals]', ...args);
    const errorLog = (...args) => console.error('[Shared Add Modals]', ...args);

    const events = new EventTarget();
    const addBook = window.addBook;

    const localUtils = (() => {
        const byId = (id) => document.getElementById(id);
        const setHelpText = (el, message, isError = false) => {
            if (!el) return;
            el.textContent = message || '';
            el.classList.toggle('text-danger', Boolean(message) && isError);
        };
        const clearHelpText = (el) => setHelpText(el, '', false);
        const showAlertWithDetails = (alertEl, title, details) => {
            if (!alertEl) return;
            const safeTitle = title || 'Alert';
            const errors = Array.isArray(details)
                ? details.filter(Boolean)
                : (details ? [details] : []);
            if (typeof window.renderApiErrorAlert === 'function') {
                window.renderApiErrorAlert(alertEl, { message: safeTitle, errors }, safeTitle);
                return;
            }
            const detailText = errors.length ? errors.join(' ') : '';
            const content = detailText
                ? `<span><strong>${safeTitle}</strong>: ${detailText}</span>`
                : `<span><strong>${safeTitle}</strong></span>`;
            alertEl.innerHTML = content;
            alertEl.classList.remove('d-none');
        };
        const hideAlert = (alertEl) => {
            if (!alertEl) return;
            if (typeof window.clearApiAlert === 'function') {
                window.clearApiAlert(alertEl);
                return;
            }
            alertEl.classList.add('d-none');
            alertEl.innerHTML = '';
        };
        const attachButtonSpinner = (button) => {
            if (!button) return null;
            if (button.querySelector('.spinner-border')) {
                return {
                    spinner: button.querySelector('.spinner-border'),
                    label: button.textContent.trim() || 'Submit'
                };
            }
            const label = button.textContent.trim() || 'Submit';
            button.textContent = '';
            const spinner = document.createElement('span');
            spinner.className = 'spinner-border spinner-border-sm d-none';
            spinner.setAttribute('role', 'status');
            spinner.setAttribute('aria-hidden', 'true');
            button.appendChild(spinner);
            button.appendChild(document.createTextNode(' '));
            button.appendChild(document.createTextNode(label));
            return { spinner, label };
        };
        const setButtonLoading = (button, spinner, isLoading) => {
            if (!button || !spinner) return;
            spinner.classList.toggle('d-none', !isLoading);
            button.disabled = isLoading;
        };
        const toggleDisabled = (elements, disabled) => {
            if (!elements) return;
            elements.forEach((el) => {
                if (el) el.disabled = disabled;
            });
        };
        const bindModalLock = (modalEl, state) => {
            if (!modalEl || modalEl.dataset.lockBound === 'true') return;
            modalEl.dataset.lockBound = 'true';
            modalEl.addEventListener('hide.bs.modal', () => {
                if (state.locked) {
                    state.locked = false;
                    console.warn('[Shared Modals] Modal hide triggered while locked; allowing hide to proceed.', { id: modalEl.id });
                }
            });
        };
        const setModalLocked = (modalEl, locked) => {
            if (!modalEl) return;
            modalEl.dataset.locked = locked ? 'true' : 'false';
            const closeButtons = modalEl.querySelectorAll('[data-bs-dismiss="modal"], .btn-close');
            closeButtons.forEach((btn) => {
                btn.disabled = locked;
            });
        };
        const parsePartialDateInput = (value) => {
            if (!value || !value.trim()) return { value: null };
            if (!window.partialDateParser || typeof window.partialDateParser.parsePartialDate !== 'function') {
                return { error: 'Date parser is unavailable.' };
            }
            const parsed = window.partialDateParser.parsePartialDate(value.trim());
            if (!parsed || !parsed.text) return { error: 'Please enter a valid date.' };
            return { value: parsed };
        };
        const setPartialDateHelp = (inputEl, helpEl) => {
            if (!inputEl || !helpEl) return;
            const raw = inputEl.value.trim();
            if (!raw) {
                clearHelpText(helpEl);
                return;
            }
            const parsed = parsePartialDateInput(raw);
            if (parsed.error) {
                setHelpText(helpEl, parsed.error, true);
                return;
            }
            setHelpText(helpEl, `This date will be saved as: ${parsed.value.text}`, false);
        };
        const normalizeUrl = (value) => {
            if (!value) return null;
            const raw = value.trim();
            if (!raw || /\s/.test(raw)) return null;
            const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
            try {
                const url = new URL(withScheme);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
                return url.href;
            } catch (error) {
                return null;
            }
        };
        const truncateText = (value, maxLength = 120) => {
            if (!value) return '';
            const text = String(value).trim();
            if (!text) return '';
            if (text.length <= maxLength) return text;
            return `${text.slice(0, maxLength - 1)}…`;
        };
        const formatPartialDateDisplay = (value) => {
            if (!value) return '';
            if (typeof value === 'object' && value.text) return String(value.text).trim();
            const raw = String(value).trim();
            if (!raw) return '';
            if (window.partialDateParser && typeof window.partialDateParser.parsePartialDate === 'function') {
                const parsed = window.partialDateParser.parsePartialDate(raw);
                if (parsed && parsed.text) return String(parsed.text).trim();
            }
            return raw;
        };
        const formatBooleanLabel = (value) => (value ? 'Yes' : 'No');
        const describeChange = (fieldLabel, fromValue, toValue, { formatter, maxLength = 120 } = {}) => {
            const format = (value) => {
                const formatted = formatter ? formatter(value) : value;
                return truncateText(formatted, maxLength);
            };
            const from = format(fromValue);
            const to = format(toValue);
            if (from === to) return null;
            if (!from && to) return `Adding ${fieldLabel}: '${to}'.`;
            if (from && !to) return `Clearing ${fieldLabel} (was '${from}').`;
            return `Changing ${fieldLabel} from '${from}' to '${to}'.`;
        };
        const cacheModalValues = (modalId, fields) => {
            const store = window.sharedAddModals?.cache || (window.sharedAddModals.cache = {});
            if (!modalId) return;
            store[modalId] = store[modalId] || {};
            fields.forEach((field) => {
                if (!field || !field.id) return;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    store[modalId][field.id] = field.checked;
                } else {
                    store[modalId][field.id] = field.value;
                }
            });
        };
        const restoreModalValues = (modalId, fields) => {
            const store = window.sharedAddModals?.cache || {};
            const cache = store[modalId];
            if (!cache) return;
            fields.forEach((field) => {
                if (!field || !field.id) return;
                if (!(field.id in cache)) return;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    field.checked = Boolean(cache[field.id]);
                } else {
                    field.value = cache[field.id];
                }
            });
        };
        const clearModalValues = (modalId, fields) => {
            const store = window.sharedAddModals?.cache || (window.sharedAddModals.cache = {});
            if (modalId) store[modalId] = {};
            fields.forEach((field) => {
                if (!field) return;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    field.checked = false;
                } else {
                    field.value = '';
                }
            });
        };
        return {
            byId,
            setHelpText,
            clearHelpText,
            showAlertWithDetails,
            hideAlert,
            attachButtonSpinner,
            setButtonLoading,
            toggleDisabled,
            bindModalLock,
            setModalLocked,
            parsePartialDateInput,
            setPartialDateHelp,
            normalizeUrl,
            truncateText,
            formatPartialDateDisplay,
            formatBooleanLabel,
            describeChange,
            cacheModalValues,
            restoreModalValues,
            clearModalValues
        };
    })();

    const utils = addBook?.utils || localUtils;

    const modalMarkup = `
<div class="modal fade" role="dialog" tabindex="-1" data-bs-backdrop="static" id="addBookTypeModal" aria-labelledby="addBookTypeModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title" id="addBookTypeModalLabel">Create a New Book Type</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-none" role="alert" id="threeBookTypeErrorAlert"></div>
        <form id="threeAddBookTypeForm">
                    <div class="mb-3"><label class="form-label" for="threeEdtBookTypeName"><strong>Book Type Name</strong></label><label class="form-label text-danger" for="threeEdtBookTypeName"><strong>*</strong></label><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" class="bi bi-info-circle text-muted ms-1" data-bs-toggle="tooltip" data-bss-tooltip="" title="Enter a clear name for this book type, such as Hardcover or Softcover.">
                                                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"></path>
                                                                        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"></path>
                                                                </svg><input class="form-control" type="text" id="threeEdtBookTypeName" name="bookTypeName" autocomplete="off" required="" minlength="2" maxlength="100"><small class="form-text" id="threeBookTypeNameHelp"></small></div>
                    <div class="mb-0"><label class="form-label" for="threeRdtBookTypeDescription"><strong>Description</strong></label><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" class="bi bi-info-circle text-muted ms-1" data-bs-toggle="tooltip" data-bss-tooltip="" title="Describe the physical format and any special notes for this book type.">
                                                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"></path>
                                                                        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"></path>
                                                                </svg><textarea class="form-control" id="threeRdtBookTypeDescription" name="bookTypeDescription" autocomplete="off" spellcheck="true" minlength="2" maxlength="500"></textarea><small class="form-text" id="threeBookTypeDescriptionHelp"></small></div>
        </form>
                <small class="text-muted d-block mt-3" id="threeBookTypeChangeSummary"></small>
      </div>
    <div class="modal-footer"><button class="btn btn-outline-secondary" id="threeBtnResetBookType" type="button">Reset</button><button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancel</button><button class="btn btn-primary" id="threeBtnSaveBookType" type="button" disabled>Add Book Type</button></div>
    </div>
  </div>
</div>
<div class="modal fade" role="dialog" tabindex="-1" data-bs-backdrop="static" id="addAuthorModal" aria-labelledby="addAuthorModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title" id="addAuthorModalLabel">Add a New Author</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-none" role="alert" id="fourAuthorErrorAlert"></div>
        <form id="fourAddAuthorForm">
                    <div class="mb-3"><label class="form-label" for="fourEdtAuthorDisplayName"><strong>Display Name</strong></label><label class="form-label text-danger" for="fourEdtAuthorDisplayName"><strong>*</strong></label><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16" class="bi bi-info-circle text-muted ms-1" data-bs-toggle="tooltip" data-bss-tooltip="" title="The name shown in your collection (for example, a pen name or organization).">
                                                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"></path>
                                                                        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"></path>
                                                                </svg><input class="form-control" type="text" id="fourEdtAuthorDisplayName" name="authorDisplayName" autocomplete="off" required="" minlength="2" maxlength="150"><small class="form-text" id="fourAuthorDisplayNameHelp"></small></div>
          <div class="row">
            <div class="col-12 col-md-6">
              <div class="mb-3"><label class="form-label" for="fourEdtAuthorFirstName"><strong>First Name(s)</strong></label><input class="form-control" type="text" id="fourEdtAuthorFirstName" name="authorFirstName" autocomplete="off" minlength="2" maxlength="150"><small class="form-text" id="fourAuthorFirstNameHelp"></small></div>
            </div>
            <div class="col-12 col-md-6">
              <div class="mb-3"><label class="form-label" for="fourEdtAuthorLastName"><strong>Last Name</strong></label><input class="form-control" type="text" id="fourEdtAuthorLastName" name="authorLastName" autocomplete="off" minlength="2" maxlength="100"><small class="form-text" id="fourAuthorLastNameHelp"></small></div>
            </div>
          </div>
          <div class="row">
            <div class="col-12 col-md-6">
              <div class="mb-3"><label class="form-label" for="fourEdtAuthorBirthDate"><strong>Birth Date</strong></label><input class="form-control" type="text" id="fourEdtAuthorBirthDate" name="authorBirthDate" autocomplete="off" maxlength="50"><small class="form-text" id="fourAuthorBirthDateHelp"></small></div>
              <div class="form-check form-switch mb-3">
                <input class="form-check-input" type="checkbox" id="fourChkAuthorDeceased" data-bs-toggle="collapse" data-bs-target="#authorDeathDateWrap" aria-expanded="false" aria-controls="authorDeathDateWrap" autocomplete="off">
                <label class="form-check-label" for="fourChkAuthorDeceased">Author is deceased</label>
              </div>
            </div>
            <div class="col-12 col-md-6">
              <div class="collapse mb-3 mb-md-0" id="authorDeathDateWrap">
                <label class="form-label" for="fourEdtAuthorDeathDate"><strong>Death Date</strong></label><input class="form-control" type="text" id="fourEdtAuthorDeathDate" name="authorDeathDate" autocomplete="off" maxlength="50"><small class="form-text" id="fourAuthorDeathDateHelp"></small>
              </div>
            </div>
          </div>
          <div class="mb-0"><label class="form-label" for="fourRdtAuthorBio"><strong>Short Bio</strong></label><textarea class="form-control" id="fourRdtAuthorBio" name="authorBio" autocomplete="off" spellcheck="true" minlength="2" maxlength="1000"></textarea><small class="form-text" id="fourAuthorBioHelp"></small></div>
        </form>
                <small class="text-muted d-block mt-3" id="fourAuthorChangeSummary"></small>
      </div>
    <div class="modal-footer"><button class="btn btn-outline-secondary" id="fourBtnResetAuthor" type="button">Reset</button><button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancel</button><button class="btn btn-primary" id="fourBtnSaveAuthor" type="button" disabled><span class="spinner-border spinner-border-sm d-none" role="status" aria-hidden="true"></span> Add Author</button></div>
    </div>
  </div>
</div>
<div class="modal fade" role="dialog" tabindex="-1" data-bs-backdrop="static" id="addPublisherModal" aria-labelledby="addPublisherModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title" id="addPublisherModalLabel">Add a New Publisher</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-none" role="alert" id="fivePublisherErrorAlert"></div>
        <form id="fiveAddPublisherForm">
          <div class="mb-3"><label class="form-label" for="fiveEdtPublisherName"><strong>Publisher Name</strong></label><label class="form-label text-danger" for="fiveEdtPublisherName"><strong>*</strong></label><input class="form-control" type="text" id="fiveEdtPublisherName" name="publisherName" autocomplete="off" required="" minlength="2" maxlength="150"><small class="form-text" id="fivePublisherNameHelp"></small></div>
          <div class="row">
            <div class="col-12 col-md-6">
              <div class="mb-3"><label class="form-label" for="fiveEdtPublisherFoundedDate"><strong>Founded Date</strong></label><input class="form-control" type="text" id="fiveEdtPublisherFoundedDate" name="publisherFoundedDate" autocomplete="off" maxlength="50"><small class="form-text" id="fivePublisherFoundedDateHelp"></small></div>
            </div>
          </div>
          <div class="mb-3"><label class="form-label" for="fiveEdtPublisherWebsite"><strong>Website</strong></label><input class="form-control" type="url" id="fiveEdtPublisherWebsite" name="publisherWebsite" inputmode="url" autocomplete="off"><small class="form-text" id="fivePublisherWebsiteHelp"></small></div>
          <div class="mb-0"><label class="form-label" for="fiveRdtPublisherNotes"><strong>Notes</strong></label><textarea class="form-control" id="fiveRdtPublisherNotes" name="publisherNotes" autocomplete="off" spellcheck="true" minlength="2" maxlength="1000"></textarea><small class="form-text" id="fivePublisherNotesHelp"></small></div>
        </form>
                <small class="text-muted d-block mt-3" id="fivePublisherChangeSummary"></small>
      </div>
    <div class="modal-footer"><button class="btn btn-outline-secondary" id="fiveBtnResetPublisher" type="button">Reset</button><button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancel</button><button class="btn btn-primary" id="fiveBtnSavePublisher" type="button" disabled>Add Publisher</button></div>
    </div>
  </div>
</div>
<div class="modal fade" role="dialog" tabindex="-1" data-bs-backdrop="static" id="addSeriesModal" aria-labelledby="addSeriesModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title" id="addSeriesModalLabel">Add a New Series</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-none" role="alert" id="sixSeriesErrorAlert"></div>
        <p class="text-muted mb-3">Series start and end dates are automatically derived from the books you add to the series.</p>
        <form id="sixAddSeriesForm">
          <div class="mb-3"><label class="form-label" for="sixEdtSeriesName"><strong>Series Name</strong></label><label class="form-label text-danger" for="sixEdtSeriesName"><strong>*</strong></label><input class="form-control" type="text" id="sixEdtSeriesName" name="seriesName" autocomplete="off" required="" minlength="2" maxlength="150"><small class="form-text" id="sixSeriesNameHelp"></small></div>
          <div class="mb-3"><label class="form-label" for="sixEdtSeriesWebsite"><strong>Series Website</strong></label><input class="form-control" type="url" id="sixEdtSeriesWebsite" name="seriesWebsite" inputmode="url" autocomplete="off"><small class="form-text" id="sixSeriesWebsiteHelp"></small></div>
          <div class="mb-0"><label class="form-label" for="sixRdtSeriesDescription"><strong>Description</strong></label><textarea class="form-control" id="sixRdtSeriesDescription" name="seriesDescription" autocomplete="off" spellcheck="true" minlength="2" maxlength="1000"></textarea><small class="form-text" id="sixSeriesDescriptionHelp"></small></div>
        </form>
                <small class="text-muted d-block mt-3" id="sixSeriesChangeSummary"></small>
      </div>
    <div class="modal-footer"><button class="btn btn-outline-secondary" id="sixBtnResetSeries" type="button">Reset</button><button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancel</button><button class="btn btn-primary" id="sixBtnSaveSeries" type="button" disabled>Add Series</button></div>
    </div>
  </div>
</div>
<div class="modal fade" role="dialog" tabindex="-1" data-bs-backdrop="static" id="addLocationModal" aria-labelledby="addLocationModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title" id="addLocationModalLabel">Add a New Storage Location</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-danger d-none" role="alert" id="eightLocationErrorAlert"></div>
        <form id="eightAddLocationForm">
          <div class="mb-3" id="eightLocationTypeGroup">
            <label class="form-label"><strong>Location Type</strong></label>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="locationType" id="eightRdoLocationBase" value="base" checked="" data-bs-toggle="collapse" data-bs-target="#eightBaseLocationFields" aria-controls="eightBaseLocationFields" autocomplete="off">
              <label class="form-check-label" for="eightRdoLocationBase">New base location</label>
            </div>
            <div class="form-check">
              <input class="form-check-input" type="radio" name="locationType" id="eightRdoLocationNested" value="nested" data-bs-toggle="collapse" data-bs-target="#eightNestedLocationFields" aria-controls="eightNestedLocationFields" autocomplete="off">
              <label class="form-check-label" for="eightRdoLocationNested">Nested under an existing location</label>
            </div>
          </div>
          <div class="collapse show" id="eightBaseLocationFields" data-bs-parent="#eightLocationTypeGroup">
            <div class="mb-3"><label class="form-label" for="eightEdtLocationNameBase"><strong>Location Name</strong></label><label class="form-label text-danger" for="eightEdtLocationNameBase"><strong>*</strong></label><input class="form-control" type="text" id="eightEdtLocationNameBase" name="locationNameBase" autocomplete="off" required="" minlength="2" maxlength="200"><small class="form-text" id="eightLocationBaseNameHelp"></small></div>
            <div class="mb-0"><label class="form-label" for="eightRdtLocationNotesBase"><strong>Notes</strong></label><textarea class="form-control" id="eightRdtLocationNotesBase" name="locationNotesBase" autocomplete="off" spellcheck="true" minlength="2" maxlength="500"></textarea><small class="form-text" id="eightLocationBaseNotesHelp"></small></div>
          </div>
          <div class="collapse" id="eightNestedLocationFields" data-bs-parent="#eightLocationTypeGroup">
            <div class="mb-3"><label class="form-label" for="eightCmbParentLocation"><strong>Parent Location</strong></label><label class="form-label text-danger" for="eightCmbParentLocation"><strong>*</strong></label><select class="form-select" id="eightCmbParentLocation" name="parentLocation" autocomplete="off"></select><small class="form-text" id="eightLocationParentHelp"></small></div>
            <div class="mb-3"><label class="form-label" for="eightEdtLocationNameNested"><strong>Location Name</strong></label><label class="form-label text-danger" for="eightEdtLocationNameNested"><strong>*</strong></label><input class="form-control" type="text" id="eightEdtLocationNameNested" name="locationNameNested" autocomplete="off" required="" minlength="2" maxlength="200"><small class="form-text" id="eightLocationNestedNameHelp"></small></div>
            <div class="mb-0"><label class="form-label" for="eightRdtLocationNotesNested"><strong>Notes</strong></label><textarea class="form-control" id="eightRdtLocationNotesNested" name="locationNotesNested" autocomplete="off" spellcheck="true" minlength="2" maxlength="500"></textarea><small class="form-text" id="eightLocationNestedNotesHelp"></small></div>
          </div>
        </form>
                <small class="text-muted d-block mt-3" id="eightLocationChangeSummary"></small>
      </div>
    <div class="modal-footer"><button class="btn btn-outline-secondary" id="eightBtnResetLocation" type="button">Reset</button><button class="btn btn-outline-secondary" data-bs-dismiss="modal" type="button">Cancel</button><button class="btn btn-primary" id="eightBtnSaveLocation" type="button" disabled>Add Location</button></div>
    </div>
  </div>
</div>
`;

    function ensureMarkup() {
        const host = document.getElementById('sharedAddRecordModals');
        if (!host) return;
        if (host.dataset.loaded === 'true') return;
        host.innerHTML = modalMarkup;
        host.dataset.loaded = 'true';
    }

    function showModal(target, options) {
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (!element) return;
        if (window.modalManager && typeof window.modalManager.showModal === 'function') {
            window.modalManager.showModal(element, options);
            return;
        }
        window.bootstrap?.Modal.getOrCreateInstance(element, options || {}).show();
    }

    function hideModal(target) {
        const element = typeof target === 'string' ? document.getElementById(target) : target;
        if (!element) return;
        if (window.modalManager && typeof window.modalManager.hideModal === 'function') {
            window.modalManager.hideModal(element);
            return;
        }
        const instance = window.bootstrap?.Modal.getInstance(element);
        if (instance) instance.hide();
    }

    function dispatchEvent(name, detail) {
        events.dispatchEvent(new CustomEvent(name, { detail }));
        if (addBook?.events) {
            addBook.events.dispatchEvent(new CustomEvent(name, { detail }));
        }
    }

    function setupBookTypeModal() {
        const modalEl = utils.byId('addBookTypeModal');
        if (!modalEl || modalEl.dataset.bound === 'true') return;
        modalEl.dataset.bound = 'true';
        const nameInput = utils.byId('threeEdtBookTypeName');
        const descInput = utils.byId('threeRdtBookTypeDescription');
        const nameHelp = utils.byId('threeBookTypeNameHelp');
        const descHelp = utils.byId('threeBookTypeDescriptionHelp');
        const errorAlert = utils.byId('threeBookTypeErrorAlert');
        const changeSummary = utils.byId('threeBookTypeChangeSummary');
        const saveButton = utils.byId('threeBtnSaveBookType');
        const resetButton = utils.byId('threeBtnResetBookType');
        const spinnerState = utils.attachButtonSpinner(saveButton);
        const modalState = { locked: false };
        const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

        const setMode = (mode, original) => {
            bookTypeMode = { mode, original: original || null };
            const title = modalEl.querySelector('.modal-title');
            if (title) title.textContent = mode === 'edit' ? 'Edit Book Type' : 'Create a New Book Type';
            if (saveButton) setButtonLabel(saveButton, mode === 'edit' ? 'Save changes' : 'Add Book Type');
            if (resetButton) resetButton.textContent = mode === 'edit' ? 'Revert' : 'Reset';
            if (mode === 'edit' && original) {
                nameInput.value = (original.name || '').trim();
                descInput.value = (original.description || '').trim();
            }
        };

        utils.bindModalLock(modalEl, modalState);
        setMode('add');

        const getCurrentValues = () => ({
            name: nameInput.value.trim(),
            description: descInput.value.trim()
        });

        const getOriginalValues = () => ({
            name: (bookTypeMode.original?.name || '').trim(),
            description: (bookTypeMode.original?.description || '').trim()
        });

        const buildChangeList = () => {
            if (bookTypeMode.mode !== 'edit') return [];
            const current = getCurrentValues();
            const original = getOriginalValues();
            const changes = [];
            const nameChange = utils.describeChange('name', original.name, current.name);
            const descriptionChange = utils.describeChange('description', original.description, current.description, { maxLength: 160 });
            if (nameChange) changes.push(nameChange);
            if (descriptionChange) changes.push(descriptionChange);
            return changes;
        };

        const updateChangeSummary = (changes = buildChangeList()) => {
            if (!changeSummary) return;
            if (bookTypeMode.mode !== 'edit') {
                changeSummary.textContent = '';
                return;
            }
            changeSummary.textContent = changes.length ? changes.join(' ') : 'No changes yet.';
        };

        const isValidForSave = () => {
            const errors = [];
            const name = nameInput.value.trim();
            if (!name || name.length < 2 || name.length > 100 || !namePattern.test(name)) {
                errors.push('name');
            }
            if (descInput.value.trim().length > 500) {
                errors.push('description');
            }
            return errors.length === 0;
        };

        const refreshSaveState = () => {
            const changes = buildChangeList();
            if (bookTypeMode.mode === 'edit') updateChangeSummary(changes);
            const isValid = isValidForSave();
            const hasChanges = bookTypeMode.mode !== 'edit' || changes.length > 0;
            if (saveButton) saveButton.disabled = modalState.locked || !isValid || !hasChanges;
        };

        const validate = () => {
            utils.hideAlert(errorAlert);
            const errors = [];
            const name = nameInput.value.trim();
            if (!name) {
                errors.push('Book Type Name is required.');
            } else if (name.length < 2 || name.length > 100) {
                errors.push('Book Type Name must be between 2 and 100 characters.');
            } else if (!namePattern.test(name)) {
                errors.push('Book Type Name contains unsupported characters.');
            }
            if (descInput.value.trim().length > 500) {
                errors.push('Description must be 500 characters or fewer.');
            }
            if (errors.length) {
                utils.showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
                return false;
            }
            return true;
        };

        const setLocked = (locked) => {
            const actionName = `${modalEl.id || 'shared-modal'} save`;
            if (locked) {
                window.modalLock?.lock(modalEl, actionName);
            } else {
                window.modalLock?.unlock(modalEl, 'finally');
            }
            modalState.locked = locked;
            utils.setModalLocked(modalEl, locked);
            utils.toggleDisabled([nameInput, descInput, resetButton], locked);
            if (spinnerState) utils.setButtonLoading(saveButton, spinnerState.spinner, locked);
            refreshSaveState();
        };

        const save = async () => {
            if (!validate()) return;
            setLocked(true);
            const payload = { name: nameInput.value.trim(), description: descInput.value.trim() || null };
            log('Saving book type.', { mode: bookTypeMode.mode, payload: { name: payload.name } });
            try {
                const response = await apiFetch('/booktype', {
                    method: bookTypeMode.mode === 'edit' ? 'PUT' : 'POST',
                    body: JSON.stringify(bookTypeMode.mode === 'edit'
                        ? { id: bookTypeMode.original?.id, ...payload }
                        : payload)
                });
                const data = await response.json().catch(() => ({}));
                log('Book type response parsed.', { ok: response.ok, status: response.status });
                if (!response.ok) {
                    utils.showAlertWithDetails(errorAlert, data.message || 'Failed to add book type.', data.errors || []);
                    return;
                }
                const created = data.data || {};
                dispatchEvent('booktype:created', {
                    id: created.id,
                    name: created.name || payload.name,
                    description: created.description || payload.description
                });
                utils.clearModalValues('addBookTypeModal', [nameInput, descInput]);
                utils.hideAlert(errorAlert);
                hideModal(modalEl);
            } catch (error) {
                utils.showAlertWithDetails(errorAlert, 'Unable to save book type. Please try again.');
            } finally {
                setLocked(false);
            }
        };

        const reset = () => {
            if (bookTypeMode.mode === 'edit') {
                nameInput.value = (bookTypeMode.original?.name || '').trim();
                descInput.value = (bookTypeMode.original?.description || '').trim();
            } else {
                utils.clearModalValues('addBookTypeModal', [nameInput, descInput]);
            }
            utils.clearHelpText(nameHelp);
            utils.clearHelpText(descHelp);
            utils.hideAlert(errorAlert);
            refreshSaveState();
        };

        nameInput.addEventListener('input', () => {
            const value = nameInput.value.trim();
            if (!value) {
                utils.setHelpText(nameHelp, 'This field is required.', true);
                return;
            }
            if (value.length < 2 || value.length > 100 || !namePattern.test(value)) {
                utils.setHelpText(nameHelp, 'Book Type Name must be 2-100 characters and valid.', true);
                return;
            }
            utils.clearHelpText(nameHelp);
            refreshSaveState();
        });
        descInput.addEventListener('input', () => {
            if (descInput.value.trim().length > 500) {
                utils.setHelpText(descHelp, 'Description must be 500 characters or fewer.', true);
            } else {
                utils.clearHelpText(descHelp);
            }
            refreshSaveState();
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            utils.cacheModalValues('addBookTypeModal', [nameInput, descInput]);
        });
        modalEl.addEventListener('shown.bs.modal', () => {
            utils.restoreModalValues('addBookTypeModal', [nameInput, descInput]);
            utils.hideAlert(errorAlert);
            if (!nameInput.value.trim()) {
                utils.setHelpText(nameHelp, 'This field is required.', true);
            }
            refreshSaveState();
        });
        saveButton.addEventListener('click', save);
        resetButton.addEventListener('click', reset);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (bookTypeMode.mode === 'edit') {
                bookTypeMode = { mode: 'add', original: null };
                setMode('add');
            }
        });

        modalEl.addEventListener('shared:bookTypeMode', (event) => {
            const mode = event.detail?.mode || 'add';
            const original = event.detail?.original || null;
            setMode(mode, original);
        });
    }

    function setupPublisherModal() {
        const modalEl = utils.byId('addPublisherModal');
        if (!modalEl || modalEl.dataset.bound === 'true') return;
        modalEl.dataset.bound = 'true';
        const nameInput = utils.byId('fiveEdtPublisherName');
        const foundedInput = utils.byId('fiveEdtPublisherFoundedDate');
        const websiteInput = utils.byId('fiveEdtPublisherWebsite');
        const notesInput = utils.byId('fiveRdtPublisherNotes');
        const foundedHelp = utils.byId('fivePublisherFoundedDateHelp');
        const nameHelp = utils.byId('fivePublisherNameHelp');
        const websiteHelp = utils.byId('fivePublisherWebsiteHelp');
        const notesHelp = utils.byId('fivePublisherNotesHelp');
        const errorAlert = utils.byId('fivePublisherErrorAlert');
        const changeSummary = utils.byId('fivePublisherChangeSummary');
        const saveButton = utils.byId('fiveBtnSavePublisher');
        const resetButton = utils.byId('fiveBtnResetPublisher');
        const spinnerState = utils.attachButtonSpinner(saveButton);
        const modalState = { locked: false };
        const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

        const setMode = (mode, original) => {
            publisherMode = { mode, original: original || null };
            if (modalEl) {
                const title = modalEl.querySelector('.modal-title');
                if (title) title.textContent = mode === 'edit' ? 'Edit Publisher' : 'Add a New Publisher';
            }
            if (saveButton) setButtonLabel(saveButton, mode === 'edit' ? 'Save changes' : 'Add Publisher');
            if (resetButton) resetButton.textContent = mode === 'edit' ? 'Revert' : 'Reset';
        };

        const getCurrentValues = () => ({
            name: nameInput.value.trim(),
            foundedDate: foundedInput.value.trim(),
            website: utils.normalizeUrl(websiteInput.value.trim()) || '',
            notes: notesInput.value.trim()
        });

        const getOriginalValues = () => ({
            name: (publisherMode.original?.name || '').trim(),
            foundedDate: (publisherMode.original?.foundedDate || '').trim(),
            website: utils.normalizeUrl((publisherMode.original?.website || '').trim()) || '',
            notes: (publisherMode.original?.notes || '').trim()
        });

        const buildChangeList = () => {
            if (publisherMode.mode !== 'edit') return [];
            const current = getCurrentValues();
            const original = getOriginalValues();
            const changes = [];
            const nameChange = utils.describeChange('name', original.name, current.name);
            if (nameChange) changes.push(nameChange);
            const foundedChange = utils.describeChange('founded date', original.foundedDate, current.foundedDate, {
                formatter: utils.formatPartialDateDisplay
            });
            if (foundedChange) changes.push(foundedChange);
            const websiteChange = utils.describeChange('website', original.website, current.website);
            if (websiteChange) changes.push(websiteChange);
            const notesChange = utils.describeChange('notes', original.notes, current.notes, { maxLength: 160 });
            if (notesChange) changes.push(notesChange);
            return changes;
        };

        const updateChangeSummary = (changes = buildChangeList()) => {
            if (!changeSummary) return;
            if (publisherMode.mode !== 'edit') {
                changeSummary.textContent = '';
                return;
            }
            changeSummary.textContent = changes.length
                ? changes.join(' ')
                : 'No changes yet.';
        };

        const isValidForSave = () => {
            const errors = [];
            const name = nameInput.value.trim();
            if (!name || name.length < 2 || name.length > 150 || !namePattern.test(name)) {
                errors.push('name');
            }
            if (foundedInput.value.trim()) {
                const parsed = utils.parsePartialDateInput(foundedInput.value);
                if (parsed.error) errors.push('foundedDate');
            }
            const websiteRaw = websiteInput.value.trim();
            if (websiteRaw && !utils.normalizeUrl(websiteRaw)) {
                errors.push('website');
            }
            if (notesInput.value.trim().length > 1000) {
                errors.push('notes');
            }
            return errors.length === 0;
        };

        const refreshSaveState = () => {
            const changes = buildChangeList();
            if (publisherMode.mode === 'edit') updateChangeSummary(changes);
            const isValid = isValidForSave();
            const hasChanges = publisherMode.mode !== 'edit' || changes.length > 0;
            if (saveButton) saveButton.disabled = modalState.locked || !isValid || !hasChanges;
        };

        utils.bindModalLock(modalEl, modalState);

        const validate = () => {
            utils.hideAlert(errorAlert);
            const errors = [];
            const name = nameInput.value.trim();
            if (!name) {
                errors.push('Publisher Name is required.');
            } else if (name.length < 2 || name.length > 150) {
                errors.push('Publisher Name must be between 2 and 150 characters.');
            } else if (!namePattern.test(name)) {
                errors.push('Publisher Name contains unsupported characters.');
            }
            if (foundedInput.value.trim()) {
                const parsed = utils.parsePartialDateInput(foundedInput.value);
                if (parsed.error) errors.push(parsed.error);
            }
            const websiteRaw = websiteInput.value.trim();
            if (websiteRaw && !utils.normalizeUrl(websiteRaw)) {
                errors.push('Website must be a valid URL starting with http:// or https://');
            }
            if (notesInput.value.trim().length > 1000) {
                errors.push('Notes must be 1000 characters or fewer.');
            }
            if (errors.length) {
                utils.showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
                return false;
            }
            return true;
        };

        const setLocked = (locked) => {
            const actionName = `${modalEl.id || 'shared-modal'} save`;
            if (locked) {
                window.modalLock?.lock(modalEl, actionName);
            } else {
                window.modalLock?.unlock(modalEl, 'finally');
            }
            modalState.locked = locked;
            utils.setModalLocked(modalEl, locked);
            utils.toggleDisabled([nameInput, foundedInput, websiteInput, notesInput, resetButton], locked);
            if (spinnerState) utils.setButtonLoading(saveButton, spinnerState.spinner, locked);
            refreshSaveState();
        };

        const save = async () => {
            if (!validate()) return;
            setLocked(true);
            const foundedParsed = utils.parsePartialDateInput(foundedInput.value.trim());
            const payload = {
                name: nameInput.value.trim(),
                foundedDate: foundedParsed.value || null,
                website: utils.normalizeUrl(websiteInput.value.trim()) || null,
                notes: notesInput.value.trim() || null
            };
            log('Saving publisher.', { mode: publisherMode.mode, payload: { name: payload.name } });
            try {
                const response = await apiFetch('/publisher', {
                    method: publisherMode.mode === 'edit' ? 'PUT' : 'POST',
                    body: JSON.stringify(publisherMode.mode === 'edit'
                        ? { id: publisherMode.original?.id, ...payload }
                        : payload)
                });
                const data = await response.json().catch(() => ({}));
                log('Publisher response parsed.', { ok: response.ok, status: response.status });
                if (!response.ok) {
                    utils.showAlertWithDetails(errorAlert, data.message || 'Failed to add publisher.', data.errors || []);
                    return;
                }
                const created = data.data || {};
                if (publisherMode.mode === 'edit') {
                    dispatchEvent('publisher:updated', {
                        id: created.id || publisherMode.original?.id,
                        name: created.name || payload.name,
                        foundedDate: created.foundedDate || payload.foundedDate,
                        website: created.website || payload.website,
                        notes: created.notes || payload.notes
                    });
                } else {
                    dispatchEvent('publisher:created', {
                        id: created.id,
                        name: created.name || payload.name,
                        foundedDate: created.foundedDate || payload.foundedDate,
                        website: created.website || payload.website,
                        notes: created.notes || payload.notes
                    });
                }
                utils.clearModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
                utils.hideAlert(errorAlert);
                hideModal(modalEl);
            } catch (error) {
                utils.showAlertWithDetails(errorAlert, 'Unable to save publisher. Please try again.');
            } finally {
                setLocked(false);
            }
        };

        const reset = () => {
            if (publisherMode.mode === 'edit') {
                const original = publisherMode.original || {};
                nameInput.value = original.name || '';
                foundedInput.value = original.foundedDate || '';
                websiteInput.value = original.website || '';
                notesInput.value = original.notes || '';
            } else {
                utils.clearModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
            }
            utils.clearHelpText(nameHelp);
            utils.clearHelpText(foundedHelp);
            utils.clearHelpText(websiteHelp);
            utils.clearHelpText(notesHelp);
            utils.hideAlert(errorAlert);
            refreshSaveState();
        };

        foundedInput.addEventListener('input', () => utils.setPartialDateHelp(foundedInput, foundedHelp));
        nameInput.addEventListener('input', () => {
            const value = nameInput.value.trim();
            if (!value) return utils.setHelpText(nameHelp, 'This field is required.', true);
            if (value.length < 2 || value.length > 150 || !namePattern.test(value)) {
                return utils.setHelpText(nameHelp, 'Publisher Name must be 2-150 characters and valid.', true);
            }
            utils.clearHelpText(nameHelp);
            refreshSaveState();
        });
        websiteInput.addEventListener('input', () => {
            const value = websiteInput.value.trim();
            if (!value) return utils.clearHelpText(websiteHelp);
            if (!utils.normalizeUrl(value)) {
                return utils.setHelpText(websiteHelp, 'Website must be a valid URL starting with http:// or https://', true);
            }
            utils.setHelpText(websiteHelp, `Will be saved as: ${utils.normalizeUrl(value)}`, false);
            refreshSaveState();
        });
        notesInput.addEventListener('input', () => {
            if (notesInput.value.trim().length > 1000) {
                utils.setHelpText(notesHelp, 'Notes must be 1000 characters or fewer.', true);
            } else {
                utils.clearHelpText(notesHelp);
            }
            refreshSaveState();
        });
        foundedInput.addEventListener('input', refreshSaveState);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (publisherMode.mode === 'add') {
                utils.cacheModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
            }
        });
        modalEl.addEventListener('shown.bs.modal', () => {
            if (publisherMode.mode === 'edit') {
                const original = publisherMode.original || {};
                nameInput.value = original.name || '';
                foundedInput.value = original.foundedDate || '';
                websiteInput.value = original.website || '';
                notesInput.value = original.notes || '';
            } else {
                utils.restoreModalValues('addPublisherModal', [nameInput, foundedInput, websiteInput, notesInput]);
            }
            utils.hideAlert(errorAlert);
            utils.setPartialDateHelp(foundedInput, foundedHelp);
            if (!nameInput.value.trim()) {
                utils.setHelpText(nameHelp, 'This field is required.', true);
            }
            refreshSaveState();
        });
        saveButton.addEventListener('click', save);
        resetButton.addEventListener('click', reset);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (publisherMode.mode === 'edit') {
                publisherMode = { mode: 'add', original: null };
                setMode('add');
                if (changeSummary) changeSummary.textContent = '';
            }
        });

        modalEl.addEventListener('shared:publisherMode', (event) => {
            const mode = event.detail?.mode || 'add';
            const original = event.detail?.original || null;
            setMode(mode, original);
        });
    }

    function setupAuthorModal() {
        const modalEl = utils.byId('addAuthorModal');
        if (!modalEl || modalEl.dataset.bound === 'true') return;
        modalEl.dataset.bound = 'true';
        const displayNameInput = utils.byId('fourEdtAuthorDisplayName');
        const firstNameInput = utils.byId('fourEdtAuthorFirstName');
        const lastNameInput = utils.byId('fourEdtAuthorLastName');
        const birthDateInput = utils.byId('fourEdtAuthorBirthDate');
        const deathDateInput = utils.byId('fourEdtAuthorDeathDate');
        const deceasedToggle = utils.byId('fourChkAuthorDeceased');
        const bioInput = utils.byId('fourRdtAuthorBio');
        const deathDateWrap = utils.byId('authorDeathDateWrap');

        const birthHelp = utils.byId('fourAuthorBirthDateHelp');
        const deathHelp = utils.byId('fourAuthorDeathDateHelp');
        const displayNameHelp = utils.byId('fourAuthorDisplayNameHelp');
        const firstNameHelp = utils.byId('fourAuthorFirstNameHelp');
        const lastNameHelp = utils.byId('fourAuthorLastNameHelp');
        const bioHelp = utils.byId('fourAuthorBioHelp');
        const errorAlert = utils.byId('fourAuthorErrorAlert');
        const changeSummary = utils.byId('fourAuthorChangeSummary');

        const saveButton = utils.byId('fourBtnSaveAuthor');
        const resetButton = utils.byId('fourBtnResetAuthor');

        const spinnerState = utils.attachButtonSpinner(saveButton);
        const modalState = { locked: false };
        const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

        const setMode = (mode, original) => {
            authorMode = { mode, original: original || null };
            if (modalEl) {
                const title = modalEl.querySelector('.modal-title');
                if (title) title.textContent = mode === 'edit' ? 'Edit Author' : 'Add a New Author';
            }
            if (saveButton) setButtonLabel(saveButton, mode === 'edit' ? 'Save changes' : 'Add Author');
            if (resetButton) resetButton.textContent = mode === 'edit' ? 'Revert' : 'Reset';
        };

        const getCurrentValues = () => ({
            displayName: displayNameInput.value.trim(),
            firstNames: firstNameInput.value.trim(),
            lastName: lastNameInput.value.trim(),
            birthDate: birthDateInput.value.trim(),
            deceased: Boolean(deceasedToggle.checked),
            deathDate: deathDateInput.value.trim(),
            bio: bioInput.value.trim()
        });

        const getOriginalValues = () => ({
            displayName: (authorMode.original?.displayName || '').trim(),
            firstNames: (authorMode.original?.firstNames || '').trim(),
            lastName: (authorMode.original?.lastName || '').trim(),
            birthDate: (authorMode.original?.birthDate || '').trim(),
            deceased: Boolean(authorMode.original?.deceased),
            deathDate: (authorMode.original?.deathDate || '').trim(),
            bio: (authorMode.original?.bio || '').trim()
        });

        const buildChangeList = () => {
            if (authorMode.mode !== 'edit') return [];
            const current = getCurrentValues();
            const original = getOriginalValues();
            const changes = [];
            const displayNameChange = utils.describeChange('display name', original.displayName, current.displayName);
            if (displayNameChange) changes.push(displayNameChange);
            const firstNamesChange = utils.describeChange('first name(s)', original.firstNames, current.firstNames);
            if (firstNamesChange) changes.push(firstNamesChange);
            const lastNameChange = utils.describeChange('last name', original.lastName, current.lastName);
            if (lastNameChange) changes.push(lastNameChange);
            const birthDateChange = utils.describeChange('birth date', original.birthDate, current.birthDate, {
                formatter: utils.formatPartialDateDisplay
            });
            if (birthDateChange) changes.push(birthDateChange);
            if (current.deceased !== original.deceased) {
                const deceasedChange = utils.describeChange(
                    'deceased status',
                    utils.formatBooleanLabel(original.deceased),
                    utils.formatBooleanLabel(current.deceased)
                );
                if (deceasedChange) changes.push(deceasedChange);
            }
            const deathDateChange = utils.describeChange('death date', original.deathDate, current.deathDate, {
                formatter: utils.formatPartialDateDisplay
            });
            if (deathDateChange) changes.push(deathDateChange);
            const bioChange = utils.describeChange('short bio', original.bio, current.bio, { maxLength: 160 });
            if (bioChange) changes.push(bioChange);
            return changes;
        };

        const updateChangeSummary = (changes = buildChangeList()) => {
            if (!changeSummary) return;
            if (authorMode.mode !== 'edit') {
                changeSummary.textContent = '';
                return;
            }
            changeSummary.textContent = changes.length
                ? changes.join(' ')
                : 'No changes yet.';
        };

        const isValidForSave = () => {
            const errors = [];
            const displayName = displayNameInput.value.trim();
            if (!displayName || displayName.length < 2 || displayName.length > 150 || !namePattern.test(displayName)) {
                errors.push('displayName');
            }
            const firstNames = firstNameInput.value.trim();
            if (firstNames && (firstNames.length < 2 || firstNames.length > 150 || !namePattern.test(firstNames))) {
                errors.push('firstNames');
            }
            const lastName = lastNameInput.value.trim();
            if (lastName && (lastName.length < 2 || lastName.length > 100 || !namePattern.test(lastName))) {
                errors.push('lastName');
            }
            if (birthDateInput.value.trim()) {
                const parsed = utils.parsePartialDateInput(birthDateInput.value);
                if (parsed.error) errors.push('birthDate');
            }
            if (deathDateInput.value.trim() && !deceasedToggle.checked) {
                errors.push('deathDate');
            }
            if (deceasedToggle.checked && deathDateInput.value.trim()) {
                const parsed = utils.parsePartialDateInput(deathDateInput.value);
                if (parsed.error) errors.push('deathDateInvalid');
            }
            if (bioInput.value.trim().length > 1000) {
                errors.push('bio');
            }
            return errors.length === 0;
        };

        const refreshSaveState = () => {
            const changes = buildChangeList();
            if (authorMode.mode === 'edit') updateChangeSummary(changes);
            const isValid = isValidForSave();
            const hasChanges = authorMode.mode !== 'edit' || changes.length > 0;
            if (saveButton) saveButton.disabled = modalState.locked || !isValid || !hasChanges;
        };

        const setDeathDateVisibility = (show) => {
            if (!deathDateWrap) return;
            if (window.bootstrap && window.bootstrap.Collapse) {
                const instance = window.bootstrap.Collapse.getOrCreateInstance(deathDateWrap, { toggle: false });
                if (show) instance.show(); else instance.hide();
                return;
            }
            deathDateWrap.classList.toggle('show', show);
        };

        const applyDeceasedState = () => {
            const show = Boolean(deceasedToggle?.checked);
            setDeathDateVisibility(show);
        };

        utils.bindModalLock(modalEl, modalState);

        const validate = () => {
            let valid = true;
            utils.hideAlert(errorAlert);
            utils.clearHelpText(birthHelp);
            utils.clearHelpText(deathHelp);
            const errors = [];

            const displayName = displayNameInput.value.trim();
            if (!displayName) {
                errors.push('Display Name is required.');
                valid = false;
            } else if (displayName.length < 2 || displayName.length > 150 || !namePattern.test(displayName)) {
                errors.push('Display Name must be between 2 and 150 characters.');
                valid = false;
            }

            const firstNames = firstNameInput.value.trim();
            if (firstNames && (firstNames.length < 2 || firstNames.length > 150 || !namePattern.test(firstNames))) {
                errors.push('First Name(s) must be between 2 and 150 characters.');
                valid = false;
            }

            const lastName = lastNameInput.value.trim();
            if (lastName && (lastName.length < 2 || lastName.length > 100 || !namePattern.test(lastName))) {
                errors.push('Last Name must be between 2 and 100 characters.');
                valid = false;
            }

            if (birthDateInput.value.trim()) {
                const parsed = utils.parsePartialDateInput(birthDateInput.value);
                if (parsed.error) {
                    utils.setHelpText(birthHelp, parsed.error, true);
                    valid = false;
                }
            }

            if (deathDateInput.value.trim() && !deceasedToggle.checked) {
                utils.setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
                valid = false;
            }
            if (deceasedToggle.checked && deathDateInput.value.trim()) {
                const parsed = utils.parsePartialDateInput(deathDateInput.value);
                if (parsed.error) {
                    utils.setHelpText(deathHelp, parsed.error, true);
                    valid = false;
                }
            }

            const bio = bioInput.value.trim();
            if (bio.length > 1000) {
                errors.push('Bio must be 1000 characters or fewer.');
                valid = false;
            }

            if (errors.length) {
                utils.showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
            }
            return valid;
        };

        const setLocked = (locked) => {
            const actionName = `${modalEl.id || 'shared-modal'} save`;
            if (locked) {
                window.modalLock?.lock(modalEl, actionName);
            } else {
                window.modalLock?.unlock(modalEl, 'finally');
            }
            modalState.locked = locked;
            utils.setModalLocked(modalEl, locked);
            utils.toggleDisabled([
                displayNameInput,
                firstNameInput,
                lastNameInput,
                birthDateInput,
                deathDateInput,
                deceasedToggle,
                bioInput,
                resetButton
            ], locked);
            if (spinnerState) utils.setButtonLoading(saveButton, spinnerState.spinner, locked);
            refreshSaveState();
        };

        const save = async () => {
            if (!validate()) return;
            setLocked(true);
            const birthParsed = utils.parsePartialDateInput(birthDateInput.value.trim());
            const deathParsed = utils.parsePartialDateInput(deathDateInput.value.trim());
            const payload = {
                displayName: displayNameInput.value.trim(),
                firstNames: firstNameInput.value.trim() || null,
                lastName: lastNameInput.value.trim() || null,
                birthDate: birthParsed.value || null,
                deceased: deceasedToggle.checked,
                deathDate: deceasedToggle.checked ? (deathParsed.value || null) : null,
                bio: bioInput.value.trim() || null
            };
            log('Saving author.', { mode: authorMode.mode, payload: { displayName: payload.displayName } });
            try {
                const response = await apiFetch('/author', {
                    method: authorMode.mode === 'edit' ? 'PUT' : 'POST',
                    body: JSON.stringify(authorMode.mode === 'edit'
                        ? { id: authorMode.original?.id, ...payload }
                        : payload)
                });
                const data = await response.json().catch(() => ({}));
                log('Author response parsed.', { ok: response.ok, status: response.status });
                if (!response.ok) {
                    utils.showAlertWithDetails(errorAlert, data.message || 'Failed to add author.', data.errors || []);
                    return;
                }
                const created = data.data || {};
                if (authorMode.mode === 'edit') {
                    dispatchEvent('author:updated', {
                        id: created.id || authorMode.original?.id,
                        displayName: created.displayName || payload.displayName,
                        firstNames: created.firstNames || payload.firstNames,
                        lastName: created.lastName || payload.lastName,
                        birthDate: created.birthDate || payload.birthDate,
                        deathDate: created.deathDate || payload.deathDate,
                        deceased: created.deceased ?? payload.deceased,
                        bio: created.bio || payload.bio
                    });
                } else {
                    dispatchEvent('author:created', {
                        id: created.id,
                        displayName: created.displayName || payload.displayName
                    });
                }
                utils.clearModalValues('addAuthorModal', [
                    displayNameInput,
                    firstNameInput,
                    lastNameInput,
                    birthDateInput,
                    deathDateInput,
                    deceasedToggle,
                    bioInput
                ]);
                utils.hideAlert(errorAlert);
                hideModal(modalEl);
            } catch (error) {
                utils.showAlertWithDetails(errorAlert, 'Unable to save author. Please try again.');
            } finally {
                setLocked(false);
            }
        };

        const reset = () => {
            if (authorMode.mode === 'edit') {
                const original = authorMode.original || {};
                displayNameInput.value = original.displayName || '';
                firstNameInput.value = original.firstNames || '';
                lastNameInput.value = original.lastName || '';
                birthDateInput.value = original.birthDate || '';
                deceasedToggle.checked = Boolean(original.deceased);
                deathDateInput.value = original.deathDate || '';
                bioInput.value = original.bio || '';
            } else {
                utils.clearModalValues('addAuthorModal', [
                    displayNameInput,
                    firstNameInput,
                    lastNameInput,
                    birthDateInput,
                    deathDateInput,
                    deceasedToggle,
                    bioInput
                ]);
            }
            utils.clearHelpText(displayNameHelp);
            utils.clearHelpText(firstNameHelp);
            utils.clearHelpText(lastNameHelp);
            utils.clearHelpText(birthHelp);
            utils.clearHelpText(deathHelp);
            utils.clearHelpText(bioHelp);
            utils.hideAlert(errorAlert);
            applyDeceasedState();
            refreshSaveState();
        };

        birthDateInput.addEventListener('input', () => utils.setPartialDateHelp(birthDateInput, birthHelp));
        deathDateInput.addEventListener('input', () => {
            if (!deceasedToggle.checked && deathDateInput.value.trim()) {
                utils.setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
                return;
            }
            utils.setPartialDateHelp(deathDateInput, deathHelp);
            refreshSaveState();
        });
        deceasedToggle.addEventListener('change', () => {
            if (!deceasedToggle.checked && deathDateInput.value.trim()) {
                utils.setHelpText(deathHelp, 'Mark the author as deceased to set a death date.', true);
                return;
            }
            utils.setPartialDateHelp(deathDateInput, deathHelp);
            applyDeceasedState();
            refreshSaveState();
        });
        displayNameInput.addEventListener('input', () => {
            const value = displayNameInput.value.trim();
            if (!value) return utils.setHelpText(displayNameHelp, 'This field is required.', true);
            if (value.length < 2 || value.length > 150 || !namePattern.test(value)) {
                return utils.setHelpText(displayNameHelp, 'Display Name must be 2-150 characters and valid.', true);
            }
            utils.clearHelpText(displayNameHelp);
            refreshSaveState();
        });
        firstNameInput.addEventListener('input', () => {
            const value = firstNameInput.value.trim();
            if (!value) return utils.clearHelpText(firstNameHelp);
            if (value.length < 2 || value.length > 150 || !namePattern.test(value)) {
                return utils.setHelpText(firstNameHelp, 'First Name(s) must be 2-150 characters and valid.', true);
            }
            utils.clearHelpText(firstNameHelp);
            refreshSaveState();
        });
        lastNameInput.addEventListener('input', () => {
            const value = lastNameInput.value.trim();
            if (!value) return utils.clearHelpText(lastNameHelp);
            if (value.length < 2 || value.length > 100 || !namePattern.test(value)) {
                return utils.setHelpText(lastNameHelp, 'Last Name must be 2-100 characters and valid.', true);
            }
            utils.clearHelpText(lastNameHelp);
            refreshSaveState();
        });
        bioInput.addEventListener('input', () => {
            if (bioInput.value.trim().length > 1000) {
                utils.setHelpText(bioHelp, 'Bio must be 1000 characters or fewer.', true);
            } else {
                utils.clearHelpText(bioHelp);
            }
            refreshSaveState();
        });
        birthDateInput.addEventListener('input', refreshSaveState);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (authorMode.mode === 'add') {
                utils.cacheModalValues('addAuthorModal', [
                    displayNameInput,
                    firstNameInput,
                    lastNameInput,
                    birthDateInput,
                    deathDateInput,
                    deceasedToggle,
                    bioInput
                ]);
            }
        });
        modalEl.addEventListener('shown.bs.modal', () => {
            if (authorMode.mode === 'edit') {
                const original = authorMode.original || {};
                displayNameInput.value = original.displayName || '';
                firstNameInput.value = original.firstNames || '';
                lastNameInput.value = original.lastName || '';
                birthDateInput.value = original.birthDate || '';
                deceasedToggle.checked = Boolean(original.deceased);
                deathDateInput.value = original.deathDate || '';
                bioInput.value = original.bio || '';
            } else {
                utils.restoreModalValues('addAuthorModal', [
                    displayNameInput,
                    firstNameInput,
                    lastNameInput,
                    birthDateInput,
                    deathDateInput,
                    deceasedToggle,
                    bioInput
                ]);
            }
            utils.hideAlert(errorAlert);
            utils.setPartialDateHelp(birthDateInput, birthHelp);
            utils.setPartialDateHelp(deathDateInput, deathHelp);
            if (!displayNameInput.value.trim()) {
                utils.setHelpText(displayNameHelp, 'This field is required.', true);
            }
            applyDeceasedState();
            refreshSaveState();
        });
        saveButton.addEventListener('click', save);
        resetButton.addEventListener('click', reset);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (authorMode.mode === 'edit') {
                authorMode = { mode: 'add', original: null };
                setMode('add');
                if (changeSummary) changeSummary.textContent = '';
            }
        });

        modalEl.addEventListener('shared:authorMode', (event) => {
            const mode = event.detail?.mode || 'add';
            const original = event.detail?.original || null;
            setMode(mode, original);
        });
    }

    let bookTypeMode = { mode: 'add', original: null };
    let authorMode = { mode: 'add', original: null };
    let publisherMode = { mode: 'add', original: null };
    let seriesMode = { mode: 'add', original: null };
    let locationMode = { mode: 'add', original: null };

    function setButtonLabel(button, label) {
        if (!button) return;
        Array.from(button.childNodes)
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .forEach((node) => button.removeChild(node));
        button.appendChild(document.createTextNode(` ${label}`));
    }

    function setupSeriesModal() {
        const modalEl = utils.byId('addSeriesModal');
        if (!modalEl || modalEl.dataset.bound === 'true') return;
        modalEl.dataset.bound = 'true';
        const nameInput = utils.byId('sixEdtSeriesName');
        const websiteInput = utils.byId('sixEdtSeriesWebsite');
        const descInput = utils.byId('sixRdtSeriesDescription');
        const nameHelp = utils.byId('sixSeriesNameHelp');
        const websiteHelp = utils.byId('sixSeriesWebsiteHelp');
        const descHelp = utils.byId('sixSeriesDescriptionHelp');
        const errorAlert = utils.byId('sixSeriesErrorAlert');
        const changeSummary = utils.byId('sixSeriesChangeSummary');
        const saveButton = utils.byId('sixBtnSaveSeries');
        const resetButton = utils.byId('sixBtnResetSeries');
        const spinnerState = utils.attachButtonSpinner(saveButton);
        const modalState = { locked: false };
        const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;

        const setMode = (mode, original) => {
            seriesMode = { mode, original: original || null };
            if (modalEl) {
                const title = modalEl.querySelector('.modal-title');
                if (title) title.textContent = mode === 'edit' ? 'Edit Series' : 'Add a New Series';
            }
            if (saveButton) setButtonLabel(saveButton, mode === 'edit' ? 'Save changes' : 'Add Series');
            if (resetButton) resetButton.textContent = mode === 'edit' ? 'Revert' : 'Reset';
        };

        const getCurrentValues = () => ({
            name: nameInput.value.trim(),
            website: utils.normalizeUrl(websiteInput.value.trim()) || '',
            description: descInput.value.trim()
        });

        const getOriginalValues = () => ({
            name: (seriesMode.original?.name || '').trim(),
            website: utils.normalizeUrl((seriesMode.original?.website || '').trim()) || '',
            description: (seriesMode.original?.description || '').trim()
        });

        const buildChangeList = () => {
            if (seriesMode.mode !== 'edit') return [];
            const current = getCurrentValues();
            const original = getOriginalValues();
            const changes = [];
            const nameChange = utils.describeChange('name', original.name, current.name);
            if (nameChange) changes.push(nameChange);
            const websiteChange = utils.describeChange('website', original.website, current.website);
            if (websiteChange) changes.push(websiteChange);
            const descriptionChange = utils.describeChange('description', original.description, current.description, { maxLength: 160 });
            if (descriptionChange) changes.push(descriptionChange);
            return changes;
        };

        const updateChangeSummary = (changes = buildChangeList()) => {
            if (!changeSummary) return;
            if (seriesMode.mode !== 'edit') {
                changeSummary.textContent = '';
                return;
            }
            changeSummary.textContent = changes.length
                ? changes.join(' ')
                : 'No changes yet.';
        };

        const isValidForSave = () => {
            const errors = [];
            const name = nameInput.value.trim();
            if (!name || name.length < 2 || name.length > 150 || !namePattern.test(name)) {
                errors.push('name');
            }
            const websiteRaw = websiteInput.value.trim();
            if (websiteRaw && !utils.normalizeUrl(websiteRaw)) {
                errors.push('website');
            }
            if (descInput.value.trim().length > 1000) {
                errors.push('description');
            }
            return errors.length === 0;
        };

        const refreshSaveState = () => {
            const changes = buildChangeList();
            if (seriesMode.mode === 'edit') updateChangeSummary(changes);
            const isValid = isValidForSave();
            const hasChanges = seriesMode.mode !== 'edit' || changes.length > 0;
            if (saveButton) saveButton.disabled = modalState.locked || !isValid || !hasChanges;
        };

        utils.bindModalLock(modalEl, modalState);

        const validate = () => {
            utils.hideAlert(errorAlert);
            const errors = [];
            const name = nameInput.value.trim();
            if (!name) {
                errors.push('Series Name is required.');
            } else if (name.length < 2 || name.length > 150) {
                errors.push('Series Name must be between 2 and 150 characters.');
            } else if (!namePattern.test(name)) {
                errors.push('Series Name contains unsupported characters.');
            }
            const websiteRaw = websiteInput.value.trim();
            if (websiteRaw && !utils.normalizeUrl(websiteRaw)) {
                errors.push('Series Website must be a valid URL starting with http:// or https://');
            }
            if (descInput.value.trim().length > 1000) {
                errors.push('Description must be 1000 characters or fewer.');
            }
            if (errors.length) {
                utils.showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
                return false;
            }
            return true;
        };

        const setLocked = (locked) => {
            const actionName = `${modalEl.id || 'shared-modal'} save`;
            if (locked) {
                window.modalLock?.lock(modalEl, actionName);
            } else {
                window.modalLock?.unlock(modalEl, 'finally');
            }
            modalState.locked = locked;
            utils.setModalLocked(modalEl, locked);
            utils.toggleDisabled([nameInput, websiteInput, descInput, resetButton], locked);
            if (spinnerState) utils.setButtonLoading(saveButton, spinnerState.spinner, locked);
            refreshSaveState();
        };

        const save = async () => {
            if (!validate()) return;
            setLocked(true);
            const payload = {
                name: nameInput.value.trim(),
                website: utils.normalizeUrl(websiteInput.value.trim()) || null,
                description: descInput.value.trim() || null
            };
            log('Saving series.', { mode: seriesMode.mode, payload: { name: payload.name } });
            try {
                const response = await apiFetch('/bookseries', {
                    method: seriesMode.mode === 'edit' ? 'PUT' : 'POST',
                    body: JSON.stringify(seriesMode.mode === 'edit'
                        ? { id: seriesMode.original?.id, ...payload }
                        : payload)
                });
                const data = await response.json().catch(() => ({}));
                log('Series response parsed.', { ok: response.ok, status: response.status });
                if (!response.ok) {
                    utils.showAlertWithDetails(errorAlert, data.message || 'Failed to add series.', data.errors || []);
                    return;
                }
                const created = data.data || {};
                if (seriesMode.mode === 'edit') {
                    dispatchEvent('series:updated', {
                        id: created.id || seriesMode.original?.id,
                        name: created.name || payload.name,
                        description: created.description || payload.description,
                        website: created.website || payload.website
                    });
                } else {
                    dispatchEvent('series:created', {
                        id: created.id,
                        name: created.name || payload.name,
                        description: created.description || payload.description,
                        website: created.website || payload.website
                    });
                }
                utils.clearModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
                utils.hideAlert(errorAlert);
                hideModal(modalEl);
            } catch (error) {
                utils.showAlertWithDetails(errorAlert, 'Unable to save series. Please try again.');
            } finally {
                setLocked(false);
            }
        };

        const reset = () => {
            if (seriesMode.mode === 'edit') {
                const original = seriesMode.original || {};
                nameInput.value = original.name || '';
                websiteInput.value = original.website || '';
                descInput.value = original.description || '';
            } else {
                utils.clearModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
            }
            utils.clearHelpText(nameHelp);
            utils.clearHelpText(websiteHelp);
            utils.clearHelpText(descHelp);
            utils.hideAlert(errorAlert);
            refreshSaveState();
        };

        nameInput.addEventListener('input', () => {
            const value = nameInput.value.trim();
            if (!value) return utils.setHelpText(nameHelp, 'This field is required.', true);
            if (value.length < 2 || value.length > 150 || !namePattern.test(value)) {
                return utils.setHelpText(nameHelp, 'Series Name must be 2-150 characters and valid.', true);
            }
            utils.clearHelpText(nameHelp);
            refreshSaveState();
        });
        websiteInput.addEventListener('input', () => {
            const value = websiteInput.value.trim();
            if (!value) {
                utils.clearHelpText(websiteHelp);
                refreshSaveState();
                return;
            }
            if (!utils.normalizeUrl(value)) {
                return utils.setHelpText(websiteHelp, 'Series Website must be a valid URL starting with http:// or https://', true);
            }
            utils.setHelpText(websiteHelp, `Will be saved as: ${utils.normalizeUrl(value)}`, false);
            refreshSaveState();
        });
        descInput.addEventListener('input', () => {
            if (descInput.value.trim().length > 1000) {
                utils.setHelpText(descHelp, 'Description must be 1000 characters or fewer.', true);
            } else {
                utils.clearHelpText(descHelp);
            }
            refreshSaveState();
        });

        modalEl.addEventListener('hidden.bs.modal', () => {
            utils.cacheModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
        });
        modalEl.addEventListener('shown.bs.modal', () => {
            if (seriesMode.mode === 'edit') {
                const original = seriesMode.original || {};
                nameInput.value = original.name || '';
                websiteInput.value = original.website || '';
                descInput.value = original.description || '';
            } else {
                utils.restoreModalValues('addSeriesModal', [nameInput, websiteInput, descInput]);
            }
            utils.hideAlert(errorAlert);
            if (!nameInput.value.trim()) {
                utils.setHelpText(nameHelp, 'This field is required.', true);
            }
            refreshSaveState();
        });
        saveButton.addEventListener('click', save);
        resetButton.addEventListener('click', reset);

        modalEl.addEventListener('hidden.bs.modal', () => {
            if (seriesMode.mode === 'edit') {
                seriesMode = { mode: 'add', original: null };
                setMode('add');
                if (changeSummary) changeSummary.textContent = '';
            }
        });

        modalEl.addEventListener('shared:seriesMode', (event) => {
            const mode = event.detail?.mode || 'add';
            const original = event.detail?.original || null;
            setMode(mode, original);
        });
    }

    function setupLocationModal() {
        const modalEl = utils.byId('addLocationModal');
        if (!modalEl || modalEl.dataset.bound === 'true') return;
        modalEl.dataset.bound = 'true';
        const baseRadio = utils.byId('eightRdoLocationBase');
        const nestedRadio = utils.byId('eightRdoLocationNested');
        const baseNameInput = utils.byId('eightEdtLocationNameBase');
        const baseNotesInput = utils.byId('eightRdtLocationNotesBase');
        const parentSelect = utils.byId('eightCmbParentLocation');
        const nestedNameInput = utils.byId('eightEdtLocationNameNested');
        const nestedNotesInput = utils.byId('eightRdtLocationNotesNested');
        const baseFields = utils.byId('eightBaseLocationFields');
        const nestedFields = utils.byId('eightNestedLocationFields');

        const errorAlert = utils.byId('eightLocationErrorAlert');
        const saveButton = utils.byId('eightBtnSaveLocation');
        const resetButton = utils.byId('eightBtnResetLocation');

        const spinnerState = utils.attachButtonSpinner(saveButton);
        const modalState = { locked: false };
        const namePattern = /^[A-Za-z0-9 .,'":;!?()&\/-]+$/;
        let cachedLocations = [];

        const setMode = (mode, original) => {
            locationMode = { mode, original: original || null };
            if (modalEl) {
                const title = modalEl.querySelector('.modal-title');
                if (title) title.textContent = mode === 'edit' ? 'Edit Storage Location' : 'Add a New Location';
            }
            if (saveButton) setButtonLabel(saveButton, mode === 'edit' ? 'Save changes' : 'Add Location');
            if (resetButton) resetButton.textContent = mode === 'edit' ? 'Revert' : 'Reset';
        };

        const getCurrentValues = () => {
            const isBase = baseRadio.checked;
            return {
                name: isBase ? baseNameInput.value.trim() : nestedNameInput.value.trim(),
                notes: isBase ? baseNotesInput.value.trim() : nestedNotesInput.value.trim(),
                parentId: isBase ? null : Number.parseInt(parentSelect.value, 10) || null
            };
        };

        const getOriginalValues = () => ({
            name: (locationMode.original?.name || '').trim(),
            notes: (locationMode.original?.notes || '').trim(),
            parentId: locationMode.original?.parentId ?? null
        });

        const buildChangeList = () => {
            if (locationMode.mode !== 'edit') return [];
            const current = getCurrentValues();
            const original = getOriginalValues();
            const changes = [];
            const nameChange = utils.describeChange('name', original.name, current.name);
            if (nameChange) changes.push(nameChange);
            const notesChange = utils.describeChange('notes', original.notes, current.notes, { maxLength: 160 });
            if (notesChange) changes.push(notesChange);
            return changes;
        };

        const updateChangeSummary = (changes = buildChangeList()) => {
            const changeSummary = utils.byId('eightLocationChangeSummary');
            if (!changeSummary) return;
            if (locationMode.mode !== 'edit') {
                changeSummary.textContent = '';
                return;
            }
            changeSummary.textContent = changes.length
                ? changes.join(' ')
                : 'No changes yet.';
        };

        const isValidForSave = () => {
            const errors = [];
            if (baseRadio.checked) {
                const name = baseNameInput.value.trim();
                if (!name || name.length < 2 || name.length > 150 || !namePattern.test(name)) {
                    errors.push('name');
                }
                if (baseNotesInput.value.trim().length > 2000) {
                    errors.push('notes');
                }
            } else {
                const parentId = parentSelect.value;
                if (!parentId || parentId === 'none') {
                    errors.push('parent');
                }
                const name = nestedNameInput.value.trim();
                if (!name || name.length < 2 || name.length > 150 || !namePattern.test(name)) {
                    errors.push('name');
                }
                if (nestedNotesInput.value.trim().length > 2000) {
                    errors.push('notes');
                }
            }
            return errors.length === 0;
        };

        const refreshSaveState = () => {
            const changes = buildChangeList();
            if (locationMode.mode === 'edit') updateChangeSummary(changes);
            const isValid = isValidForSave();
            const hasChanges = locationMode.mode !== 'edit' || changes.length > 0;
            if (saveButton) saveButton.disabled = modalState.locked || !isValid || !hasChanges;
        };

        const baseNameHelp = utils.byId('eightLocationBaseNameHelp');
        const baseNotesHelp = utils.byId('eightLocationBaseNotesHelp');
        const parentHelp = utils.byId('eightLocationParentHelp');
        const nestedNameHelp = utils.byId('eightLocationNestedNameHelp');
        const nestedNotesHelp = utils.byId('eightLocationNestedNotesHelp');

        utils.bindModalLock(modalEl, modalState);

        [baseRadio, nestedRadio].forEach((radio) => {
            if (!radio) return;
            radio.removeAttribute('data-bs-toggle');
            radio.removeAttribute('data-bs-target');
            radio.removeAttribute('aria-controls');
        });

        [baseFields, nestedFields].forEach((section) => {
            if (!section) return;
            section.removeAttribute('data-bs-parent');
        });

        function populateParents(locations) {
            if (!parentSelect) return;
            parentSelect.innerHTML = '<option value="none" selected> Select parent location...</option>';
            (locations || []).forEach((loc) => {
                const option = document.createElement('option');
                option.value = String(loc.id);
                option.textContent = loc.path || loc.name;
                parentSelect.appendChild(option);
            });
        }

        function hasBaseLocations(locations) {
            return (locations || []).some((loc) => loc && (loc.parentId === null || loc.parentId === undefined));
        }

        function setCollapseVisibility(collapseEl, show) {
            if (!collapseEl) return;
            collapseEl.classList.toggle('show', show);
            collapseEl.style.display = show ? 'block' : 'none';
            collapseEl.style.height = show ? 'auto' : '0px';
        }

        function updateInlineHelp() {
            if (baseRadio.checked) {
                const name = baseNameInput.value.trim();
                if (!name) {
                    utils.setHelpText(baseNameHelp, 'This field is required.', true);
                } else if (name.length < 2 || name.length > 150) {
                    utils.setHelpText(baseNameHelp, 'Location Name must be between 2 and 150 characters.', true);
                } else if (!namePattern.test(name)) {
                    utils.setHelpText(baseNameHelp, 'Location Name contains unsupported characters.', true);
                } else {
                    utils.clearHelpText(baseNameHelp);
                }

                if (baseNotesInput.value.trim().length > 2000) {
                    utils.setHelpText(baseNotesHelp, 'Notes must be 2000 characters or fewer.', true);
                } else {
                    utils.clearHelpText(baseNotesHelp);
                }
                utils.clearHelpText(parentHelp);
                utils.clearHelpText(nestedNameHelp);
                utils.clearHelpText(nestedNotesHelp);
                refreshSaveState();
                return;
            }

            const parentId = parentSelect.value;
            if (!parentId || parentId === 'none') {
                utils.setHelpText(parentHelp, 'This field is required.', true);
            } else {
                utils.clearHelpText(parentHelp);
            }

            const name = nestedNameInput.value.trim();
            if (!name) {
                utils.setHelpText(nestedNameHelp, 'This field is required.', true);
            } else if (name.length < 2 || name.length > 150) {
                utils.setHelpText(nestedNameHelp, 'Location Name must be between 2 and 150 characters.', true);
            } else if (!namePattern.test(name)) {
                utils.setHelpText(nestedNameHelp, 'Location Name contains unsupported characters.', true);
            } else {
                utils.clearHelpText(nestedNameHelp);
            }

            if (nestedNotesInput.value.trim().length > 2000) {
                utils.setHelpText(nestedNotesHelp, 'Notes must be 2000 characters or fewer.', true);
            } else {
                utils.clearHelpText(nestedNotesHelp);
            }
            utils.clearHelpText(baseNameHelp);
            utils.clearHelpText(baseNotesHelp);
            refreshSaveState();
        }

        function applyLocationMode() {
            const isEdit = locationMode.mode === 'edit' && locationMode.original;
            const allowNested = hasBaseLocations(cachedLocations);
            nestedRadio.disabled = !allowNested || isEdit;
            baseRadio.disabled = isEdit;
            if (!allowNested) {
                nestedRadio.checked = false;
                baseRadio.checked = true;
                utils.setHelpText(parentHelp, 'Add a base storage location before creating nested locations.', true);
            } else if (!nestedRadio.checked) {
                utils.clearHelpText(parentHelp);
            }

            if (isEdit) {
                const isBaseOriginal = locationMode.original.parentId === null || locationMode.original.parentId === undefined;
                baseRadio.checked = isBaseOriginal;
                nestedRadio.checked = !isBaseOriginal;
            }

            const isBase = baseRadio.checked;
            setCollapseVisibility(baseFields, isBase);
            setCollapseVisibility(nestedFields, !isBase);
            utils.toggleDisabled([baseNameInput, baseNotesInput], !isBase);
            utils.toggleDisabled([parentSelect, nestedNameInput, nestedNotesInput], isBase);
            if (isEdit && parentSelect) parentSelect.disabled = true;
            updateInlineHelp();
        }

        function validate() {
            utils.hideAlert(errorAlert);
            const errors = [];
            const isBase = baseRadio.checked;

            if (isBase) {
                const name = baseNameInput.value.trim();
                if (!name) errors.push('Location Name is required.');
                else if (name.length < 2 || name.length > 150) errors.push('Location Name must be between 2 and 150 characters.');
                else if (!namePattern.test(name)) errors.push('Location Name contains unsupported characters.');
                const hasDuplicateBase = name
                    ? cachedLocations.some((loc) => (loc.parentId === null || loc.parentId === undefined)
                        && loc.name
                        && loc.name.trim().toLowerCase() === name.toLowerCase()
                        && (!locationMode.original || loc.id !== locationMode.original.id))
                    : false;
                if (hasDuplicateBase) errors.push('A base storage location with this name already exists.');
                if (baseNotesInput.value.trim().length > 2000) errors.push('Notes must be 2000 characters or fewer.');
            } else {
                const parentId = parentSelect.value;
                if (!parentId || parentId === 'none') errors.push('Parent Location is required for nested locations.');
                const name = nestedNameInput.value.trim();
                if (!name) errors.push('Location Name is required.');
                else if (name.length < 2 || name.length > 150) errors.push('Location Name must be between 2 and 150 characters.');
                else if (!namePattern.test(name)) errors.push('Location Name contains unsupported characters.');
                if (nestedNotesInput.value.trim().length > 2000) errors.push('Notes must be 2000 characters or fewer.');
            }
            if (errors.length) {
                utils.showAlertWithDetails(errorAlert, 'Please fix the following:', errors);
                return false;
            }
            return true;
        }

        const setLocked = (locked) => {
            const actionName = `${modalEl.id || 'shared-modal'} save`;
            if (locked) {
                window.modalLock?.lock(modalEl, actionName);
            } else {
                window.modalLock?.unlock(modalEl, 'finally');
            }
            modalState.locked = locked;
            utils.setModalLocked(modalEl, locked);
            utils.toggleDisabled([
                baseRadio,
                nestedRadio,
                baseNameInput,
                baseNotesInput,
                parentSelect,
                nestedNameInput,
                nestedNotesInput,
                resetButton
            ], locked);
            if (spinnerState) utils.setButtonLoading(saveButton, spinnerState.spinner, locked);
            refreshSaveState();
        };

        const save = async () => {
            if (!validate()) return;
            setLocked(true);
            const isBase = baseRadio.checked;
            const payload = {
                name: isBase ? baseNameInput.value.trim() : nestedNameInput.value.trim(),
                parentId: isBase ? null : Number.parseInt(parentSelect.value, 10),
                notes: isBase ? (baseNotesInput.value.trim() || null) : (nestedNotesInput.value.trim() || null)
            };
            log('Saving storage location.', { mode: locationMode.mode, payload: { name: payload.name, parentId: payload.parentId } });
            try {
                const response = await apiFetch(
                    locationMode.mode === 'edit' ? `/storagelocation/${locationMode.original?.id}` : '/storagelocation',
                    {
                        method: locationMode.mode === 'edit' ? 'PUT' : 'POST',
                        body: JSON.stringify(locationMode.mode === 'edit'
                            ? { name: payload.name, notes: payload.notes }
                            : payload)
                    }
                );
                const data = await response.json().catch(() => ({}));
                log('Storage location response parsed.', { ok: response.ok, status: response.status });
                if (!response.ok) {
                    utils.showAlertWithDetails(errorAlert, data.message || 'Failed to add location.', data.errors || []);
                    return;
                }
                const created = data.data || {};
                const detail = {
                    id: created.id || locationMode.original?.id,
                    name: created.name || payload.name,
                    path: created.path || payload.name,
                    notes: created.notes || payload.notes,
                    parentId: created.parentId ?? payload.parentId
                };
                if (locationMode.mode === 'edit') {
                    dispatchEvent('location:updated', detail);
                    cachedLocations = cachedLocations.map((loc) => (loc.id === detail.id ? { ...loc, ...detail } : loc));
                } else {
                    dispatchEvent('location:created', detail);
                    cachedLocations = cachedLocations.concat(detail);
                }
                utils.clearModalValues('addLocationModal', [
                    baseNameInput,
                    baseNotesInput,
                    parentSelect,
                    nestedNameInput,
                    nestedNotesInput,
                    baseRadio,
                    nestedRadio
                ]);
                utils.hideAlert(errorAlert);
                hideModal(modalEl);
            } catch (error) {
                utils.showAlertWithDetails(errorAlert, 'Unable to save location. Please try again.');
            } finally {
                setLocked(false);
            }
        };

        const reset = () => {
            if (locationMode.mode === 'edit' && locationMode.original) {
                const original = locationMode.original;
                const isBaseOriginal = original.parentId === null || original.parentId === undefined;
                baseRadio.checked = isBaseOriginal;
                nestedRadio.checked = !isBaseOriginal;
                baseNameInput.value = isBaseOriginal ? (original.name || '') : '';
                baseNotesInput.value = isBaseOriginal ? (original.notes || '') : '';
                parentSelect.value = !isBaseOriginal && original.parentId ? String(original.parentId) : 'none';
                nestedNameInput.value = !isBaseOriginal ? (original.name || '') : '';
                nestedNotesInput.value = !isBaseOriginal ? (original.notes || '') : '';
                applyLocationMode();
            } else {
                utils.clearModalValues('addLocationModal', [
                    baseNameInput,
                    baseNotesInput,
                    parentSelect,
                    nestedNameInput,
                    nestedNotesInput,
                    baseRadio,
                    nestedRadio
                ]);
                baseRadio.checked = true;
                applyLocationMode();
            }
            utils.hideAlert(errorAlert);
            refreshSaveState();
        };

        baseRadio.addEventListener('change', applyLocationMode);
        nestedRadio.addEventListener('change', applyLocationMode);
        baseRadio.addEventListener('click', applyLocationMode);
        nestedRadio.addEventListener('click', applyLocationMode);
        baseNameInput.addEventListener('input', updateInlineHelp);
        baseNotesInput.addEventListener('input', updateInlineHelp);
        parentSelect.addEventListener('change', updateInlineHelp);
        nestedNameInput.addEventListener('input', updateInlineHelp);
        nestedNotesInput.addEventListener('input', updateInlineHelp);
        baseNameInput.addEventListener('input', refreshSaveState);
        baseNotesInput.addEventListener('input', refreshSaveState);
        nestedNameInput.addEventListener('input', refreshSaveState);
        nestedNotesInput.addEventListener('input', refreshSaveState);

        modalEl.addEventListener('hidden.bs.modal', () => {
            utils.cacheModalValues('addLocationModal', [
                baseNameInput,
                baseNotesInput,
                parentSelect,
                nestedNameInput,
                nestedNotesInput,
                baseRadio,
                nestedRadio
            ]);
        });

        modalEl.addEventListener('shown.bs.modal', async () => {
            let locations = [];
            try {
                if (addBook?.state?.locations) {
                    locations = addBook.state.locations;
                } else if (window.sharedAddModalsConfig?.getLocations) {
                    const result = await window.sharedAddModalsConfig.getLocations();
                    locations = Array.isArray(result) ? result : [];
                }
            } catch (error) {
                locations = [];
            }
            cachedLocations = locations;
            populateParents(cachedLocations);
            const cache = window.sharedAddModals?.cache?.addLocationModal;
            const hasCache = cache && Object.keys(cache).length > 0;
            utils.restoreModalValues('addLocationModal', [
                baseNameInput,
                baseNotesInput,
                parentSelect,
                nestedNameInput,
                nestedNotesInput,
                baseRadio,
                nestedRadio
            ]);
            if (locationMode.mode === 'edit' && locationMode.original) {
                const original = locationMode.original;
                const isBaseOriginal = original.parentId === null || original.parentId === undefined;
                baseRadio.checked = isBaseOriginal;
                nestedRadio.checked = !isBaseOriginal;
                baseNameInput.value = isBaseOriginal ? (original.name || '') : '';
                baseNotesInput.value = isBaseOriginal ? (original.notes || '') : '';
                if (!isBaseOriginal && parentSelect) {
                    const hasOption = Array.from(parentSelect.options).some((opt) => opt.value === String(original.parentId));
                    if (hasOption) parentSelect.value = String(original.parentId);
                }
                nestedNameInput.value = !isBaseOriginal ? (original.name || '') : '';
                nestedNotesInput.value = !isBaseOriginal ? (original.notes || '') : '';
            } else if (!hasCache) {
                const defaultParentId = window.sharedAddModalsConfig?.defaultLocationParentId ?? null;
                if (defaultParentId && parentSelect) {
                    const hasOption = Array.from(parentSelect.options).some((opt) => opt.value === String(defaultParentId));
                    if (hasOption) {
                        nestedRadio.checked = true;
                        baseRadio.checked = false;
                        parentSelect.value = String(defaultParentId);
                    }
                } else {
                    baseRadio.checked = true;
                    nestedRadio.checked = false;
                }
            }
            utils.hideAlert(errorAlert);
            applyLocationMode();
            refreshSaveState();
            if (window.sharedAddModalsConfig && 'defaultLocationParentId' in window.sharedAddModalsConfig) {
                window.sharedAddModalsConfig.defaultLocationParentId = null;
            }
        });

        saveButton.addEventListener('click', save);
        resetButton.addEventListener('click', reset);
    }

    function init() {
        ensureMarkup();
        if (typeof window.initializeTooltips === 'function') {
            window.initializeTooltips();
        }
        const safeSetup = (label, fn) => {
            try {
                fn();
                log(`Initialized ${label} modal.`);
            } catch (error) {
                errorLog(`Failed to initialize ${label} modal.`, error);
            }
        };
        safeSetup('book type', setupBookTypeModal);
        safeSetup('author', setupAuthorModal);
        safeSetup('publisher', setupPublisherModal);
        safeSetup('series', setupSeriesModal);
        safeSetup('location', setupLocationModal);
    }

    function open(type, options = {}) {
        ensureMarkup();
        init();
        const map = {
            booktype: 'addBookTypeModal',
            author: 'addAuthorModal',
            publisher: 'addPublisherModal',
            series: 'addSeriesModal',
            location: 'addLocationModal'
        };
        const target = map[String(type || '').toLowerCase()];
        if (!target) return;
        if (String(type || '').toLowerCase() === 'series') {
            const modalEl = document.getElementById('addSeriesModal');
            if (modalEl) {
                modalEl.dispatchEvent(new CustomEvent('shared:seriesMode', {
                    detail: {
                        mode: options.mode === 'edit' ? 'edit' : 'add',
                        original: options.initial || null
                    }
                }));
            }
        }
        if (String(type || '').toLowerCase() === 'author') {
            const modalEl = document.getElementById('addAuthorModal');
            if (modalEl) {
                modalEl.dispatchEvent(new CustomEvent('shared:authorMode', {
                    detail: {
                        mode: options.mode === 'edit' ? 'edit' : 'add',
                        original: options.initial || null
                    }
                }));
            }
        }
        if (String(type || '').toLowerCase() === 'publisher') {
            const modalEl = document.getElementById('addPublisherModal');
            if (modalEl) {
                modalEl.dispatchEvent(new CustomEvent('shared:publisherMode', {
                    detail: {
                        mode: options.mode === 'edit' ? 'edit' : 'add',
                        original: options.initial || null
                    }
                }));
            }
        }
        if (String(type || '').toLowerCase() === 'location') {
            const modalEl = document.getElementById('addLocationModal');
            if (modalEl) {
                modalEl.dispatchEvent(new CustomEvent('shared:locationMode', {
                    detail: {
                        mode: options.mode === 'edit' ? 'edit' : 'add',
                        original: options.initial || null
                    }
                }));
            }
        }
        if (String(type || '').toLowerCase() === 'booktype') {
            const modalEl = document.getElementById('addBookTypeModal');
            if (modalEl) {
                modalEl.dispatchEvent(new CustomEvent('shared:bookTypeMode', {
                    detail: {
                        mode: options.mode === 'edit' ? 'edit' : 'add',
                        original: options.initial || null
                    }
                }));
            }
        }
        showModal(target, { backdrop: 'static', keyboard: false });
    }

    window.sharedAddModals = {
        events,
        init,
        open
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
