function createSearchableSelect(wrapId, hiddenId, placeholder) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return null;

    wrap.innerHTML = `
        <div class="ss-box">
            <input type="text" class="ss-input" placeholder="${placeholder}" autocomplete="off">
            <button type="button" class="ss-clear" style="display:none;" title="مسح">✕</button>
        </div>
        <div class="ss-list" style="display:none;"></div>`;

    const input = wrap.querySelector('.ss-input');
    const clearBtn = wrap.querySelector('.ss-clear');
    const list = wrap.querySelector('.ss-list');
    const hiddenInput = hiddenId ? document.getElementById(hiddenId) : null;

    let _options = [];
    let _selectedValue = null;

    function renderList(query) {
        const q = (query || '').toLowerCase();
        const filtered = q ? _options.filter(o => o.label.toLowerCase().includes(q)) : _options;
        list.innerHTML = filtered.length
            ? filtered.map(o => `<div class="ss-option${String(o.value) === String(_selectedValue) ? ' selected' : ''}" data-value="${o.value}" data-label="${String(o.label).replace(/"/g, '&quot;')}">${escapeHtml(o.label)}</div>`).join('')
            : '<div class="ss-empty">لا توجد نتائج</div>';
        list.querySelectorAll('.ss-option').forEach(function(el) {
            el.addEventListener('mousedown', function(e) {
                e.preventDefault();
                doSelect(this.dataset.value, this.dataset.label);
            });
        });
        list.style.display = 'block';
    }

    function doSelect(value, label) {
        _selectedValue = value;
        input.value = label;
        if (hiddenInput) {
            hiddenInput.value = value;
            hiddenInput.dispatchEvent(new Event('change'));
        }
        clearBtn.style.display = '';
        list.style.display = 'none';
    }

    function doClear() {
        _selectedValue = null;
        input.value = '';
        if (hiddenInput) {
            hiddenInput.value = '';
            hiddenInput.dispatchEvent(new Event('change'));
        }
        clearBtn.style.display = 'none';
        list.style.display = 'none';
    }

    input.addEventListener('focus', function() { renderList(this.value); });
    input.addEventListener('input', function() {
        _selectedValue = null;
        if (hiddenInput) hiddenInput.value = '';
        clearBtn.style.display = this.value ? '' : 'none';
        renderList(this.value);
    });
    input.addEventListener('blur', function() {
        setTimeout(function() { list.style.display = 'none'; }, 150);
    });
    clearBtn.addEventListener('click', doClear);

    return {
        setOptions: function(opts) { _options = opts; },
        addOption: function(opt) { _options.push(opt); },
        selectValue: function(value) {
            const opt = _options.find(o => String(o.value) === String(value));
            if (opt) doSelect(String(opt.value), opt.label);
        },
        getValue: function() { return _selectedValue; },
        clear: doClear
    };
}

let apiHelper = {
    post: function ({ url, args, isFormData = false }) {
        let options = {
            method: "POST",
            headers: {}
        };

        if (isFormData) {
            options.body = args;
        } else {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(args);
        }

        const token = sessionStorage.getItem('adminToken');
        if (token) {
            options.headers["Authorization"] = `Bearer ${token}`;
        }

        return fetch(BACKEND_SERVER + url, options)
            .then(async (response) => {
                if (!response.ok) {
                    throw await response.text();
                }
                return response.json();
            });
    }
};

