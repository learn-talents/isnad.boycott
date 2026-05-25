//#region backend variables
const GITHUB_TOKEN = "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";
const GITHUB_USERNAME = "durazi";
const GITHUB_REPO = "isnad.boycott";
const GITHUB_FILE = "products_data.json";
const ADMIN_PASSWORD = "isnad313";
const ENV = 'dev'
const BACKEND_SERVER_DEV = 'http://localhost:3000'
const BACKEND_SERVER_PROD = 'https://62z5zux2di.execute-api.eu-west-1.amazonaws.com/prod'

const BACKEND_SERVER = ENV == 'prod' ? BACKEND_SERVER_PROD : BACKEND_SERVER_DEV;

//#endregion


//#region variables
let products = [];
let isAdmin = false;
let adminSearchTerm = '';
let curFilter = 'all', curCat = 'all', curSearch = '';

let keywords = [],
    categories = [],
    countries = [],
    companiesList = [],
    selectedCountriesList = [];

let editingCategoryId = null;
let editingCountryId = null;
//#endregion


// #region save data
function saveKeywordsToLocal() { localStorage.setItem('admin_keywords', JSON.stringify(keywords)); }
function saveCategoriesToLocal() { localStorage.setItem('admin_categories', JSON.stringify(categories)); }
function saveCountriesToLocal() { localStorage.setItem('admin_countries', JSON.stringify(countries)); }
function saveCompaniesToLocal() {
    localStorage.setItem('admin_companies', JSON.stringify(companiesList));
}
//#endregion

function showLoginModal() {
    document.getElementById('loginModal').classList.add('open');
}

function loadAdminData() {
    const savedKeywords = localStorage.getItem('admin_keywords');
    if (savedKeywords) keywords = JSON.parse(savedKeywords);
    const savedCategories = localStorage.getItem('admin_categories');
    if (savedCategories) categories = JSON.parse(savedCategories);
    const savedCountries = localStorage.getItem('admin_countries');
    if (savedCountries) countries = JSON.parse(savedCountries);
    const savedCompanies = localStorage.getItem('admin_companies');
    if (savedCompanies) companiesList = JSON.parse(savedCompanies);

    updateCategoriesSelect();
    renderKeywordsList();
    renderCategoriesList();
    renderCountriesList();
    renderCompaniesList();
    renderSelectedCountries();
}

function updateCategoriesSelect() {
    const select = document.getElementById('productCat');
    if (!select) return;
    select.innerHTML = categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function updateCatBar() {
    const catBar = document.getElementById('catBar');
    if (!catBar) return;

    console.log({ categories })
    catBar.innerHTML = `<button class="ctab on" onclick="setCat(this,'all')">الكل</button>` + categories.map(cat => `<button class="ctab" onclick="setCat(this,'${cat.name}')"><span class="cdot" style="background:${cat.color}"></span>${cat.name}</button>`).join('');
    updateCategoryCounts();
}

function updateCategoryCounts() {
    categories.forEach(cat => {
        console.log({ products })
        const count = products.filter(p => p.cat === cat.name).length;
        const btn = document.querySelector(`.ctab[onclick="setCat(this,'${cat.name}')"]`);
        if (btn) {
            const existingSpan = btn.querySelector('.cat-count');
            if (existingSpan) existingSpan.remove();
            const span = document.createElement('span');
            span.className = 'cat-count';
            span.textContent = count;
            btn.appendChild(span);
        }
    });
    const allBtn = document.querySelector('.ctab[onclick="setCat(this,\'all\')"]');
    if (allBtn) {
        const existingSpan = allBtn.querySelector('.cat-count');
        if (existingSpan) existingSpan.remove();
        const span = document.createElement('span');
        span.className = 'cat-count';
        span.textContent = products.length;
        allBtn.appendChild(span);
    }
}

//#region auto get alternatives
function getAlternativesForProduct(product) {
    if (product.status !== 'مقاطعة') return [];
    const alternatives = products.filter(p =>
        p.status === 'بديل' && p.cat === product.cat
    );
    return alternatives;
}


function getAlternativesHtml(product) {
    const alternatives = getAlternativesForProduct(product);
    if (alternatives.length === 0) return '';
    return alternatives.map(alt => `
    <span class="alternative-link" onclick="event.stopPropagation(); openModal(${alt.id})">${escapeHtml(alt.name)}</span>
  `).join('');
}
//#endregion auto get alternatives

let countrySearchTimeout;
function setupCountrySearch() {
    const input = document.getElementById('countrySearchInput');
    if (!input) return;
    input.addEventListener('input', function () {
        clearTimeout(countrySearchTimeout);
        countrySearchTimeout = setTimeout(() => {
            const query = this.value.toLowerCase();
            const suggestionsDiv = document.getElementById('countrySuggestions');
            const suggestionsList = document.getElementById('countrySuggestionsList');

            if (query.length > 0) {
                const matches = countries.filter(c =>
                    c.nameAr.toLowerCase().includes(query) ||
                    c.nameEn.toLowerCase().includes(query)
                );
                if (matches.length > 0) {
                    suggestionsList.innerHTML = matches.map(c => `
            <div class="suggestion-item" onclick="selectCountry('${c.nameAr}', '${c.nameEn}')">
              <strong>${c.nameAr}</strong> <span style="color:#888">(${c.nameEn})</span>
            </div>
          `).join('');
                    suggestionsDiv.style.display = 'block';
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }, 300);
    });
}

function selectCountry(nameAr, nameEn) {
    if (!selectedCountriesList.find(c => c.nameAr === nameAr)) {
        selectedCountriesList.push({ nameAr: nameAr, nameEn: nameEn });
        renderSelectedCountries();
    }
    document.getElementById('countrySearchInput').value = '';
    document.getElementById('countrySuggestions').style.display = 'none';
}

function renderSelectedCountries() {
    const container = document.getElementById('selectedCountries');
    if (!container) return;
    container.innerHTML = selectedCountriesList.map(c => `
    <span class="selected-country-tag">
      ${c.nameAr}
      <button type="button" onclick="removeCountry('${c.nameAr}')">✕</button>
    </span>
  `).join('');
}

function removeCountry(nameAr) {
    selectedCountriesList = selectedCountriesList.filter(c => c.nameAr !== nameAr);
    renderSelectedCountries();
}

// ===================== إدارة الشركات =====================
let editingCompanyId = null;
let parentCompanySearchTimeout = null;

function companyItemHtml(comp) {
    const archived = comp.isArchived;
    const parentInfo = comp.parentNameAr
        ? `<br><small>تابعة لـ: ${escapeHtml(comp.parentNameAr)}${comp.parentNameEn ? ' (' + escapeHtml(comp.parentNameEn) + ')' : ''}</small>`
        : '';
    return `
    <div class="admin-list-item${archived ? ' archived-item' : ''}" data-company-id="${comp.id}">
      <div class="info">
        <strong style="${archived ? 'text-decoration:line-through;color:#aaa;' : ''}">${escapeHtml(comp.nameAr)}</strong>
        <span style="color:#888"> (${escapeHtml(comp.nameEn || '')})</span>
        ${archived ? '<span style="margin-right:6px;font-size:11px;background:#f0ad4e;color:#fff;padding:2px 6px;border-radius:8px;">مؤرشف</span>' : ''}
        ${parentInfo}
      </div>
      <div>
        ${!archived ? `<button class="btn-secondary" style="background:var(--blue);color:white;margin-left:5px;" onclick="editCompany(${comp.id})">✏️ تعديل</button>` : ''}
        <button class="btn-secondary" style="background:${archived ? '#28a745' : '#f0ad4e'};color:white;margin-left:5px;" onclick="archiveCompany(${comp.id}, ${!archived})">
          ${archived ? '📤 استعادة' : '🗄️ أرشفة'}
        </button>
        <button class="btn-danger" onclick="deleteCompany(${comp.id})">🗑️ حذف</button>
      </div>
    </div>`;
}

function renderCompaniesList() {
    const container = document.getElementById('companiesList');
    if (!container) return;
    container.innerHTML = companiesList.map(companyItemHtml).join('');
}

function editCompany(id) {
    const comp = companiesList.find(c => String(c.id) === String(id));
    if (!comp) return;
    editingCompanyId = comp.id;
    document.getElementById('companyNameAr').value = comp.nameAr;
    document.getElementById('companyNameEn').value = comp.nameEn || '';
    document.getElementById('parentCompanyId').value = comp.parentId || '';
    document.getElementById('parentCompanySearch').value = comp.parentNameAr || '';
    const btn = document.getElementById('saveCompanyBtn');
    if (btn) btn.textContent = '💾 تحديث الشركة';
    const cancelBtn = document.getElementById('cancelEditCompanyBtn');
    if (cancelBtn) cancelBtn.style.display = '';
    showToast('✏️ قم بالتعديل ثم اضغط تحديث الشركة');
}

function cancelEditCompany() {
    editingCompanyId = null;
    document.getElementById('companyNameAr').value = '';
    document.getElementById('companyNameEn').value = '';
    document.getElementById('parentCompanyId').value = '';
    document.getElementById('parentCompanySearch').value = '';
    const btn = document.getElementById('saveCompanyBtn');
    if (btn) btn.textContent = '➕ إضافة شركة';
    const cancelBtn = document.getElementById('cancelEditCompanyBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

function saveCompany() {
    const nameAr = document.getElementById('companyNameAr').value.trim();
    const nameEn = document.getElementById('companyNameEn').value.trim();
    const parentId = document.getElementById('parentCompanyId').value;

    if (!nameAr) { showToast('❌ الرجاء إدخال اسم الشركة'); return; }

    const companyId = editingCompanyId || -1;

    apiHelper.post({
        url: '/companies/setCompany',
        args: {
            company_id: companyId,
            company_name_ar: nameAr,
            company_name_en: nameEn,
            parent_company_id: parentId || null
        }
    }).then(function (result) {
        if (companyId == -1) {
            companiesList.push(result);
        } else {
            const idx = companiesList.findIndex(c => String(c.id) === String(companyId));
            if (idx !== -1) companiesList[idx] = result;
        }
        saveCompaniesToLocal();
        renderCompaniesList();
        refreshProductsCompanyDropdown();
        cancelEditCompany();
        showToast(companyId == -1 ? '✅ تم إضافة الشركة' : '✏️ تم تعديل الشركة');
    }).catch(function () {
        showToast('❌ حدث خطأ أثناء حفظ الشركة');
    });
}

function archiveCompany(id, archive) {
    apiHelper.post({
        url: '/companies/archiveCompany',
        args: { company_id: id, is_archived: archive }
    }).then(function (result) {
        const idx = companiesList.findIndex(c => String(c.id) === String(id));
        if (idx !== -1) companiesList[idx] = result;
        if (!archive && String(editingCompanyId) === String(id)) {
            cancelEditCompany();
        }
        saveCompaniesToLocal();
        renderCompaniesList();
        refreshProductsCompanyDropdown();
        showToast(archive ? '🗄️ تم أرشفة الشركة' : '📤 تم استعادة الشركة');
    }).catch(function () {
        showToast('❌ حدث خطأ أثناء تحديث حالة الشركة');
    });
}

function deleteCompany(id) {
    if (confirm('هل أنت متأكد من حذف هذه الشركة؟')) {
        apiHelper.post({
            url: '/companies/deleteCompany',
            args: { company_id: id }
        }).then(function () {
            companiesList = companiesList.filter(c => String(c.id) !== String(id));
            if (String(editingCompanyId) === String(id)) {
                cancelEditCompany();
            }
            saveCompaniesToLocal();
            renderCompaniesList();
            refreshProductsCompanyDropdown();
            showToast('🗑️ تم حذف الشركة');
        }).catch(function () {
            showToast('❌ حدث خطأ أثناء حذف الشركة');
        });
    }
}

function filterCompanies() {
    const search = document.getElementById('companySearch').value.toLowerCase();
    const container = document.getElementById('companiesList');
    const filtered = companiesList.filter(c =>
        (c.nameAr || '').toLowerCase().includes(search) ||
        (c.nameEn || '').toLowerCase().includes(search)
    );
    container.innerHTML = filtered.map(companyItemHtml).join('');
}

function refreshProductsCompanyDropdown() {
    const dropdown = document.querySelector('.admin-section #companyDropdown');
    if (!dropdown) return;
    const currentVal = dropdown.value;
    dropdown.innerHTML = '';
    companiesList
        .filter(function (c) { return !c.isArchived; })
        .forEach(function (c) {
            const option = document.createElement('option');
            option.value = c.id;
            if (c.nameAr && c.nameEn) {
                option.textContent = c.nameAr + ' - ' + c.nameEn;
            } else {
                option.textContent = c.nameAr || c.nameEn || '';
            }
            dropdown.appendChild(option);
        });
    if (currentVal) dropdown.value = currentVal;
}

// Parent company searchable dropdown (backend search)
function setupParentCompanySearch() {
    const input = document.getElementById('parentCompanySearch');
    if (!input) return;

    input.addEventListener('input', function () {
        clearTimeout(parentCompanySearchTimeout);
        const query = this.value.trim();
        const suggestionsDiv = document.getElementById('parentCompanySuggestions');

        if (query.length === 0) {
            document.getElementById('parentCompanyId').value = '';
            suggestionsDiv.style.display = 'none';
            return;
        }

        parentCompanySearchTimeout = setTimeout(function () {
            apiHelper.post({
                url: '/companies/searchCompanies',
                args: { q: query, exclude_id: editingCompanyId || null }
            }).then(function (results) {
                if (results.length > 0) {
                    suggestionsDiv.innerHTML = results.map(function (c) {
                        const nameAr = escapeHtml(c.nameAr);
                        const nameEn = c.nameEn ? ` <span style="color:#888">(${escapeHtml(c.nameEn)})</span>` : '';
                        return `<div class="suggestion-item" onclick="selectParentCompany(${c.id}, '${c.nameAr.replace(/'/g, "\\'")}')">
                            <strong>${nameAr}</strong>${nameEn}
                        </div>`;
                    }).join('');
                } else {
                    suggestionsDiv.innerHTML = '<div style="padding:8px;color:#888;text-align:center;">لا توجد نتائج</div>';
                }
                suggestionsDiv.style.display = 'block';
            }).catch(function () {
                suggestionsDiv.style.display = 'none';
            });
        }, 300);
    });

    input.addEventListener('blur', function () {
        setTimeout(function () {
            document.getElementById('parentCompanySuggestions').style.display = 'none';
        }, 200);
    });
}

function selectParentCompany(id, nameAr) {
    document.getElementById('parentCompanyId').value = id;
    document.getElementById('parentCompanySearch').value = nameAr;
    document.getElementById('parentCompanySuggestions').style.display = 'none';
}

// ===================== البحث عن الشركات مع اقتراحات (قسم المنتجات) =====================
let companySearchTimeout;
function setupCompanySearch() {
    const input = document.getElementById('companySearchInput');
    if (!input) return;
    input.addEventListener('input', function () {
        clearTimeout(companySearchTimeout);
        companySearchTimeout = setTimeout(() => {
            const query = this.value.toLowerCase();
            const suggestionsDiv = document.getElementById('companySuggestions');
            const suggestionsList = document.getElementById('companySuggestionsList');

            if (query.length > 0) {
                const matches = companiesList.filter(c =>
                    (c.nameAr || '').toLowerCase().includes(query) ||
                    (c.nameEn || '').toLowerCase().includes(query)
                );
                if (matches.length > 0) {
                    suggestionsList.innerHTML = matches.map(c => `
            <div class="suggestion-item" onclick="selectCompany('${(c.nameAr || '').replace(/'/g, "\\'")}')">
              <strong>${escapeHtml(c.nameAr || '')}</strong> <span style="color:#888">${c.nameEn ? `(${escapeHtml(c.nameEn)})` : ''}</span>
            </div>
          `).join('');
                    suggestionsDiv.style.display = 'block';
                } else {
                    suggestionsDiv.style.display = 'none';
                }
            } else {
                suggestionsDiv.style.display = 'none';
            }
        }, 300);
    });
}

function selectCompany(name) {
    document.getElementById('companySearchInput').value = name;
    document.getElementById('productCompany').value = name;
    document.getElementById('companySuggestions').style.display = 'none';
}

// ===================== إدارة الكلمات المفتاحية =====================
function renderKeywordsList() {
    const container = document.getElementById('keywordsList');
    if (!container) return;
    container.innerHTML = keywords.map(kw => `
    <div class="admin-list-item">
      <div class="info">
        <strong>/${kw.name}</strong>
        <div style="font-size:12px;color:#666;margin-top:4px;">${kw.desc.substring(0, 80)}${kw.desc.length > 80 ? '...' : ''}</div>
      </div>
      <div><button class="btn-danger" onclick="deleteKeyword('${kw.id}')">🗑️ حذف</button></div>
    </div>
  `).join('');
}

function addKeyword() {
    const name = document.getElementById('keywordName').value.trim();
    const desc = document.getElementById('keywordDesc').value.trim();
    if (!name) { showToast('❌ الرجاء إدخال الكلمة المفتاحية'); return; }
    const newKeyword = { id: Date.now().toString(), name: name, desc: desc };
    keywords.push(newKeyword);
    saveKeywordsToLocal();
    renderKeywordsList();
    document.getElementById('keywordName').value = '';
    document.getElementById('keywordDesc').value = '';
    showToast('✅ تم إضافة الكلمة المفتاحية');
}

function deleteKeyword(id) {
    if (confirm('هل أنت متأكد من حذف هذه الكلمة المفتاحية؟')) {
        keywords = keywords.filter(k => k.id !== id);
        saveKeywordsToLocal();
        renderKeywordsList();
        showToast('🗑️ تم حذف الكلمة المفتاحية');
    }
}

function filterKeywords() {
    const search = document.getElementById('keywordSearch').value.toLowerCase();
    const container = document.getElementById('keywordsList');
    const filtered = keywords.filter(k => k.name.toLowerCase().includes(search) || k.desc.toLowerCase().includes(search));
    container.innerHTML = filtered.map(kw => `
    <div class="admin-list-item">
      <div class="info"><strong>/${kw.name}</strong><div style="font-size:12px;color:#666;margin-top:4px;">${kw.desc.substring(0, 80)}</div></div>
      <div><button class="btn-danger" onclick="deleteKeyword('${kw.id}')">🗑️ حذف</button></div>
    </div>
  `).join('');
}

//#region  categories
// ===================== إدارة الأقسام =====================
function renderCategoriesList() {
    const container = document.getElementById('categoriesList');
    if (!container) return;
    container.innerHTML = categories.map(cat => `
    <div class="admin-list-item">
      <div class="info"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${cat.color};margin-left:8px;"></span><strong>${cat.name}</strong></div>
      <div>
        <button class="btn-secondary" style="background:var(--blue);color:white;margin-left:5px;" onclick="editCategory('${cat.id}')">✏️ تعديل</button>
        <button class="btn-danger" onclick="deleteCategory('${cat.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('');
}

function editCategory(id) {
    const cat = categories.find(c => String(c.id) === String(id));
    if (!cat) return;
    editingCategoryId = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categoryColor').value = cat.color || '#4a90d9';
    const btn = document.getElementById('addCategoryBtn');
    if (btn) btn.textContent = '💾 تحديث القسم';
    showToast('✏️ قم بالتعديل ثم اضغط تحديث القسم');
}

function addCategory() {
    const name = document.getElementById('categoryName').value.trim();
    const color = document.getElementById('categoryColor').value;
    if (!name) { showToast('❌ الرجاء إدخال اسم القسم'); return; }

    const catId = editingCategoryId || -1;

    apiHelper.post({
        url: '/categories/setCategory',
        args: { category_id: catId, category_name_ar: name, category_color: color }
    }).then(function (result) {
        if (catId == -1) {
            categories.push(result);
        } else {
            const idx = categories.findIndex(c => String(c.id) === String(catId));
            if (idx !== -1) categories[idx] = result;
        }
        editingCategoryId = null;
        saveCategoriesToLocal();
        renderCategoriesList();
        updateCategoriesSelect();
        updateCatBar();
        document.getElementById('categoryName').value = '';
        document.getElementById('categoryColor').value = '#4a90d9';
        const btn = document.getElementById('addCategoryBtn');
        if (btn) btn.textContent = '➕ إضافة قسم';
        showToast(catId == -1 ? '✅ تم إضافة القسم' : '✏️ تم تعديل القسم');
    }).catch(function () {
        showToast('❌ حدث خطأ أثناء حفظ القسم');
    });
}

function deleteCategory(id) {
    if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
        apiHelper.post({
            url: '/categories/deleteCategory',
            args: { category_id: id }
        }).then(function () {
            categories = categories.filter(c => String(c.id) !== String(id));
            if (String(editingCategoryId) === String(id)) {
                editingCategoryId = null;
                document.getElementById('categoryName').value = '';
                document.getElementById('categoryColor').value = '#4a90d9';
                const btn = document.getElementById('addCategoryBtn');
                if (btn) btn.textContent = '➕ إضافة قسم';
            }
            saveCategoriesToLocal();
            renderCategoriesList();
            updateCategoriesSelect();
            updateCatBar();
            showToast('🗑️ تم حذف القسم');
        }).catch(function () {
            showToast('❌ حدث خطأ أثناء حذف القسم');
        });
    }
}

function filterCategories() {
    const search = document.getElementById('categorySearch').value.toLowerCase();
    const container = document.getElementById('categoriesList');
    const filtered = categories.filter(c => c.name.toLowerCase().includes(search));
    container.innerHTML = filtered.map(cat => `
    <div class="admin-list-item">
      <div class="info"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${cat.color};margin-left:8px;"></span><strong>${cat.name}</strong></div>
      <div>
        <button class="btn-secondary" style="background:var(--blue);color:white;margin-left:5px;" onclick="editCategory('${cat.id}')">✏️ تعديل</button>
        <button class="btn-danger" onclick="deleteCategory('${cat.id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('');
}
//#endregion  categories

//#region countries (main menu)
function countryItemHtml(cnt) {
    const archived = cnt.isArchived;
    return `
    <div class="admin-list-item${archived ? ' archived-item' : ''}">
      <div class="info">
        <strong style="${archived ? 'text-decoration:line-through;color:#aaa;' : ''}">${cnt.nameAr}</strong>
        <span style="color:#888"> (${cnt.nameEn})</span>
        ${archived ? '<span style="margin-right:6px;font-size:11px;background:#f0ad4e;color:#fff;padding:2px 6px;border-radius:8px;">مؤرشف</span>' : ''}
      </div>
      <div>
        ${!archived ? `<button class="btn-secondary" style="background:var(--blue);color:white;margin-left:5px;" onclick="editCountry('${cnt.id}')">✏️ تعديل</button>` : ''}
        <button class="btn-secondary" style="background:${archived ? '#28a745' : '#f0ad4e'};color:white;margin-left:5px;" onclick="archiveCountry('${cnt.id}', ${!archived})">
          ${archived ? '📤 استعادة' : '🗄️ أرشفة'}
        </button>
        <button class="btn-danger" onclick="deleteCountry('${cnt.id}')">🗑️ حذف</button>
      </div>
    </div>`;
}

function renderCountriesList() {
    const container = document.getElementById('countriesList');
    if (!container) return;
    container.innerHTML = countries.map(countryItemHtml).join('');
}

function archiveCountry(id, archive) {
    apiHelper.post({
        url: '/countries/archiveCountry',
        args: { country_id: id, is_archived: archive }
    }).then(function (result) {
        const idx = countries.findIndex(c => String(c.id) === String(id));
        if (idx !== -1) countries[idx] = result;
        if (!archive && String(editingCountryId) === String(id)) {
            editingCountryId = null;
            document.getElementById('countryNameAr').value = '';
            document.getElementById('countryNameEn').value = '';
            const btn = document.getElementById('addCountryBtn');
            if (btn) btn.textContent = '➕ إضافة دولة';
        }
        saveCountriesToLocal();
        renderCountriesList();
        showToast(archive ? '🗄️ تم أرشفة الدولة' : '📤 تم استعادة الدولة');
    }).catch(function () {
        showToast('❌ حدث خطأ أثناء تحديث حالة الدولة');
    });
}

function editCountry(id) {
    const cnt = countries.find(c => String(c.id) === String(id));
    if (!cnt) return;
    editingCountryId = cnt.id;
    document.getElementById('countryNameAr').value = cnt.nameAr;
    document.getElementById('countryNameEn').value = cnt.nameEn || '';
    const btn = document.getElementById('addCountryBtn');
    if (btn) btn.textContent = '💾 تحديث الدولة';
    showToast('✏️ قم بالتعديل ثم اضغط تحديث الدولة');
}

function addCountry() {
    const nameAr = document.getElementById('countryNameAr').value.trim();
    const nameEn = document.getElementById('countryNameEn').value.trim();
    if (!nameAr) { showToast('❌ الرجاء إدخال اسم الدولة'); return; }

    const countryId = editingCountryId || -1;

    apiHelper.post({
        url: '/countries/setCountry',
        args: { country_id: countryId, country_name_ar: nameAr, country_name_en: nameEn }
    }).then(function (result) {
        if (countryId == -1) {
            countries.push(result);
        } else {
            const idx = countries.findIndex(c => String(c.id) === String(countryId));
            if (idx !== -1) countries[idx] = result;
        }
        editingCountryId = null;
        saveCountriesToLocal();
        renderCountriesList();
        document.getElementById('countryNameAr').value = '';
        document.getElementById('countryNameEn').value = '';
        const btn = document.getElementById('addCountryBtn');
        if (btn) btn.textContent = '➕ إضافة دولة';
        showToast(countryId == -1 ? '✅ تم إضافة الدولة' : '✏️ تم تعديل الدولة');
    }).catch(function () {
        showToast('❌ حدث خطأ أثناء حفظ الدولة');
    });
}

function deleteCountry(id) {
    if (confirm('هل أنت متأكد من حذف هذه الدولة؟')) {
        apiHelper.post({
            url: '/countries/deleteCountry',
            args: { country_id: id }
        }).then(function () {
            countries = countries.filter(c => String(c.id) !== String(id));
            if (String(editingCountryId) === String(id)) {
                editingCountryId = null;
                document.getElementById('countryNameAr').value = '';
                document.getElementById('countryNameEn').value = '';
                const btn = document.getElementById('addCountryBtn');
                if (btn) btn.textContent = '➕ إضافة دولة';
            }
            saveCountriesToLocal();
            renderCountriesList();
            showToast('🗑️ تم حذف الدولة');
        }).catch(function () {
            showToast('❌ حدث خطأ أثناء حذف الدولة');
        });
    }
}

function filterCountries() {
    const search = document.getElementById('countrySearch').value.toLowerCase();
    const container = document.getElementById('countriesList');
    const filtered = countries.filter(c => c.nameAr.toLowerCase().includes(search) || c.nameEn.toLowerCase().includes(search));
    container.innerHTML = filtered.map(countryItemHtml).join('');
}
//#endregion

// ===================== الكلمات المفتاحية والاقتراحات =====================
function showKeywordSuggestions(input) {
    const text = input.value;
    const lastWord = text.split(' ').pop();
    if (lastWord.startsWith('/')) {
        const keyword = lastWord.substring(1).toLowerCase();
        const matches = keywords.filter(k => k.name.toLowerCase().includes(keyword));
        const suggestionsDiv = document.getElementById('keywordSuggestions');
        const suggestionsList = document.getElementById('suggestionsList');

        if (matches.length > 0) {
            suggestionsList.innerHTML = matches.map(m => `
        <div class="suggestion-item" onclick="insertKeyword('${m.name}', '${m.desc.replace(/'/g, "\\'")}')">
          <strong>/${m.name}</strong>
          <div class="suggestion-desc">${m.desc.substring(0, 80)}...</div>
        </div>
      `).join('');
            suggestionsDiv.style.display = 'block';
        } else {
            suggestionsDiv.style.display = 'none';
        }
    } else {
        document.getElementById('keywordSuggestions').style.display = 'none';
    }
}

function insertKeyword(keyword, description) {
    const textarea = document.getElementById('productReason');
    const text = textarea.value;
    const words = text.split(' ');
    words.pop();
    words.push(description);
    textarea.value = words.join(' ');
    document.getElementById('keywordSuggestions').style.display = 'none';
    textarea.focus();
}

//#region  images
// ===================== معاينة الصورة =====================
function previewImageAndConvert() {
    let file = document.getElementById('productImageFile').files[0];
    if (file) {
        if (file.size > 3 * 1024 * 1024) {
            showToast('❌ حجم الصورة كبير جداً (الحد الأقصى 2 ميجابايت)');
            document.getElementById('productImageFile').value = '';
            return;
        }

        let reader = new FileReader();
        reader.onload = function (e) {
            const previewDiv = document.getElementById('imagePreview');
            const previewImg = document.getElementById('previewImg');
            previewImg.src = e.target.result;
            previewDiv.style.display = 'block';
            // document.getElementById('productImage').value = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearImageUpload() {
    document.getElementById('productImageFile').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('previewImg').src = '';
}

//#endregion

//#region logo
function getCompanyLogo(companyName) {
    const logos = {
        'Apple': 'https://logo.clearbit.com/apple.com',
        'سامسونج': 'https://logo.clearbit.com/samsung.com',
        'LG': 'https://logo.clearbit.com/lg.com',
        'نستله': 'https://logo.clearbit.com/nestle.com',
        'اديداس': 'https://logo.clearbit.com/adidas.com',
        'صافولا': 'https://logo.clearbit.com/savola.com',
        'Unilever': 'https://logo.clearbit.com/unilever.com',
        'P&G': 'https://logo.clearbit.com/pg.com',
        'كوكاكولا': 'https://logo.clearbit.com/coca-cola.com',
        'بيبسي': 'https://logo.clearbit.com/pepsi.com',
    };
    return logos[companyName] || '';
}

function tryLoadLogo() {
    const logoImages = document.querySelectorAll('img[src="LOGO.png"]');
    logoImages.forEach(img => {
        img.onload = () => img.classList.add('loaded');
        img.onerror = () => img.style.display = 'none';
        if (img.complete) {
            if (img.naturalWidth > 0) img.classList.add('loaded');
            else img.style.display = 'none';
        }
    });
}
//#endregion

//#region products
function loadDefaultProducts() {
    return [
        // زيت الطهي - مقاطعة (12 منتج)
        { id: 101, name: "صافولا", nameEn: "Safola", status: "مقاطعة", cat: "زيت الطهي", company: "صافولا", country: "السعودية", image: "", reason: "منتجات صافولا تدعم جهات داعمة", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 102, name: "عافية", nameEn: "Afia", status: "مقاطعة", cat: "زيت الطهي", company: "عافية", country: "السعودية", image: "", reason: "تابعة لصافولا", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 103, name: "العربي", nameEn: "Al Arabi", status: "مقاطعة", cat: "زيت الطهي", company: "صافولا", country: "السعودية", image: "", reason: "تابعة لصافولا", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 104, name: "زهرتي", nameEn: "Zahrati", status: "مقاطعة", cat: "زيت الطهي", company: "صافولا", country: "السعودية", image: "", reason: "تابعة لصافولا", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 105, name: "شمس", nameEn: "Shams", status: "مقاطعة", cat: "زيت الطهي", company: "عافية", country: "السعودية", image: "", reason: "تابعة لعافية", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 106, name: "دلال", nameEn: "Dalal", status: "مقاطعة", cat: "زيت الطهي", company: "عافية", country: "السعودية", image: "", reason: "تابعة لعافية", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 107, name: "افكو", nameEn: "Afco", status: "مقاطعة", cat: "زيت الطهي", company: "افكو", country: "مصر", image: "", reason: "منتجات افكو تدعم جهات داعمة", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 108, name: "الشروق", nameEn: "Al Shorouk", status: "مقاطعة", cat: "زيت الطهي", company: "افكو", country: "مصر", image: "", reason: "تابعة لافكو", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 109, name: "حياة", nameEn: "Hayat", status: "مقاطعة", cat: "زيت الطهي", company: "افكو", country: "مصر", image: "", reason: "تابعة لافكو", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 110, name: "زيت الجميل", nameEn: "Al Jameel", status: "مقاطعة", cat: "زيت الطهي", company: "الجميل", country: "السعودية", image: "", reason: "منتجات الجميل تدعم جهات داعمة", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        { id: 111, name: "مازولا", nameEn: "Mazola", status: "مقاطعة", cat: "زيت الطهي", company: "ACH Food", country: "أمريكا", image: "", reason: "منتج أمريكي", alt: "الحلي، اطايب، جنان", updatedAt: "2025-06-23" },
        // زيت الطهي - بدائل (17 منتج)
        { id: 112, name: "الحلي", nameEn: "Al Heli", status: "بديل", cat: "زيت الطهي", company: "الحلي", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 113, name: "اطايب", nameEn: "Atayeb", status: "بديل", cat: "زيت الطهي", company: "اطايب", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 114, name: "جنان", nameEn: "Jinan", status: "بديل", cat: "زيت الطهي", company: "جنان", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 115, name: "امير", nameEn: "Ameer", status: "بديل", cat: "زيت الطهي", company: "امير", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 116, name: "امينة", nameEn: "Amina", status: "بديل", cat: "زيت الطهي", company: "امينة", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 117, name: "فورتن", nameEn: "Fortune", status: "بديل", cat: "زيت الطهي", company: "فورتن", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 118, name: "سيرين", nameEn: "Sereen", status: "بديل", cat: "زيت الطهي", company: "سيرين", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 119, name: "ابو زهرة", nameEn: "Abu Zahra", status: "بديل", cat: "زيت الطهي", company: "ابو زهرة", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 120, name: "تالين", nameEn: "Talin", status: "بديل", cat: "زيت الطهي", company: "تالين", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 121, name: "زينه", nameEn: "Zeina", status: "بديل", cat: "زيت الطهي", company: "زينه", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 122, name: "دايلي فريش", nameEn: "Daily Fresh", status: "بديل", cat: "زيت الطهي", company: "دايلي فريش", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 123, name: "الدعيسي", nameEn: "Al Da'aisi", status: "بديل", cat: "زيت الطهي", company: "الدعيسي", country: "اليمن", image: "", reason: "بديل ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 124, name: "مازا", nameEn: "Maza", status: "بديل", cat: "زيت الطهي", company: "مازا", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 125, name: "فاتن", nameEn: "Faten", status: "بديل", cat: "زيت الطهي", company: "فاتن", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 126, name: "مرمريز", nameEn: "Marmariz", status: "بديل", cat: "زيت الطهي", company: "مرمريز", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 127, name: "كرامي", nameEn: "Karami", status: "بديل", cat: "زيت الطهي", company: "كرامي", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        { id: 128, name: "النخبة", nameEn: "Prime", status: "بديل", cat: "زيت الطهي", company: "النخبة", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-23" },
        // مزيلات عرق (6 منتجات)
        { id: 201, name: "اديداس", nameEn: "Adidas", status: "مقاطعة", cat: "مزيلات عرق", company: "اديداس", country: "ألمانيا", image: "", reason: "شركة ألمانية داعمة", alt: "هايجين، ديب سينس", updatedAt: "2025-06-03" },
        { id: 202, name: "ريكسونا", nameEn: "Rexona", status: "مقاطعة", cat: "مزيلات عرق", company: "Unilever", country: "بريطانيا", image: "", reason: "منتجات يونيليفر", alt: "هايجين، ديب سينس", updatedAt: "2025-06-03" },
        { id: 203, name: "نيفيا", nameEn: "Nivea", status: "مقاطعة", cat: "مزيلات عرق", company: "Beiersdorf", country: "ألمانيا", image: "", reason: "شركة ألمانية", alt: "هايجين، ديب سينس", updatedAt: "2025-06-03" },
        { id: 204, name: "دوف", nameEn: "Dove", status: "مقاطعة", cat: "مزيلات عرق", company: "Unilever", country: "بريطانيا", image: "", reason: "منتجات يونيليفر", alt: "هايجين، ديب سينس", updatedAt: "2025-06-03" },
        { id: 205, name: "هايجين", nameEn: "Hygiene", status: "بديل", cat: "مزيلات عرق", company: "هايجين", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-03" },
        { id: 206, name: "ديب سينس", nameEn: "Deep Sense", status: "بديل", cat: "مزيلات عرق", company: "ديب سينس", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-06-03" },
        // أجهزة كهربائية (4)
        { id: 301, name: "LG", nameEn: "LG", status: "مقاطعة", cat: "اجهزة كهربائية", company: "LG", country: "كوريا", image: "", reason: "شركة كورية داعمة", alt: "كسترون، زينت", updatedAt: "2026-01-05" },
        { id: 302, name: "سامسونج", nameEn: "Samsung", status: "مقاطعة", cat: "اجهزة كهربائية", company: "سامسونج", country: "كوريا", image: "", reason: "شركة كورية داعمة", alt: "كسترون، زينت", updatedAt: "2026-01-05" },
        { id: 303, name: "كسترون", nameEn: "Kastron", status: "بديل", cat: "اجهزة كهربائية", company: "كسترون", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2026-01-05" },
        { id: 304, name: "زينت", nameEn: "Zenet", status: "بديل", cat: "اجهزة كهربائية", company: "زينت", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2026-01-05" },
        // دجاج (3)
        { id: 401, name: "امريكانا", nameEn: "Americana", status: "مقاطعة", cat: "دجاج", company: "امريكانا", country: "الكويت", image: "", reason: "شركة داعمة", alt: "المزرعة، الزعيم", updatedAt: "2026-02-01" },
        { id: 402, name: "المزرعة", nameEn: "Al Mazraa", status: "بديل", cat: "دجاج", company: "المزرعة", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2026-02-01" },
        { id: 403, name: "الزعيم", nameEn: "Al Zaeem", status: "بديل", cat: "دجاج", company: "الزعيم", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2026-02-01" },
        // ألبان (4)
        { id: 501, name: "نستله", nameEn: "Nestlé", status: "مقاطعة", cat: "ألبان", company: "نستله", country: "سويسرا", image: "", reason: "شركة سويسرية داعمة", alt: "أوال، النور، ندى", updatedAt: "2026-02-01" },
        { id: 502, name: "أوال", nameEn: "Awal", status: "بديل", cat: "ألبان", company: "أوال", country: "البحرين", image: "", reason: "بديل خليجي ممتاز", alt: "", updatedAt: "2026-02-01" },
        { id: 503, name: "النور", nameEn: "Al Noor", status: "بديل", cat: "ألبان", company: "النور", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2026-02-01" },
        { id: 504, name: "ندى", nameEn: "Nada", status: "بديل", cat: "ألبان", company: "ندى", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2026-02-01" },
        // صابون غسيل (3)
        { id: 601, name: "اريال", nameEn: "Ariel", status: "مقاطعة", cat: "صابون غسيل ملابس", company: "P&G", country: "أمريكا", image: "", reason: "منتج أمريكي", alt: "العملاق، ديكسن", updatedAt: "2025-12-15" },
        { id: 602, name: "العملاق", nameEn: "Al Amlaq", status: "بديل", cat: "صابون غسيل ملابس", company: "العملاق", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-12-15" },
        { id: 603, name: "ديكسن", nameEn: "Dickson", status: "بديل", cat: "صابون غسيل ملابس", company: "ديكسن", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-12-15" },
        // تلفزيونات (2)
        { id: 701, name: "سامسونج تي في", nameEn: "Samsung TV", status: "مقاطعة", cat: "تلفزيونات", company: "سامسونج", country: "كوريا", image: "", reason: "شركة كورية", alt: "كسترون تي في", updatedAt: "2025-11-10" },
        { id: 702, name: "كسترون تي في", nameEn: "Kastron TV", status: "بديل", cat: "تلفزيونات", company: "كسترون", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-11-10" },
        // سائل جلي (2)
        { id: 801, name: "فيري", nameEn: "Fairy", status: "مقاطعة", cat: "سائل جلي", company: "P&G", country: "أمريكا", image: "", reason: "منتج أمريكي", alt: "العملاق جلي", updatedAt: "2025-10-26" },
        { id: 802, name: "العملاق جلي", nameEn: "Al Amlaq", status: "بديل", cat: "سائل جلي", company: "العملاق", country: "السعودية", image: "", reason: "بديل محلي ممتاز", alt: "", updatedAt: "2025-10-26" },
        // منظفات ارضية (1)
        { id: 901, name: "ديتول", nameEn: "Dettol", status: "مقاطعة", cat: "منظفات ارضية", company: "Reckitt", country: "بريطانيا", image: "", reason: "منتج بريطاني", alt: "العملاق", updatedAt: "2025-10-26" },
        // حلويات (1)
        { id: 1001, name: "كادبوري", nameEn: "Cadbury", status: "مقاطعة", cat: "حلويات", company: "Mondelez", country: "بريطانيا", image: "", reason: "شركة بريطانية", alt: "ميهمن", updatedAt: "2025-07-01" },
        // هواتف (2)
        { id: 1101, name: "آيفون", nameEn: "iPhone", status: "مقاطعة", cat: "هواتف", company: "Apple", country: "أمريكا", image: "", reason: "شركة أمريكية", alt: "هونر", updatedAt: "2024-12-07" },
        { id: 1102, name: "هونر", nameEn: "Honor", status: "بديل", cat: "هواتف", company: "هونر", country: "الصين", image: "", reason: "بديل مقبول", alt: "", updatedAt: "2024-12-07" }
    ];
}

async function loadProducts() {

    Promise.all([
        apiHelper.post({ url: "/products/getProducts" }),
        apiHelper.post({ url: "/categories/getCategories" }),
        apiHelper.post({ url: "/countries/getCountries" }),
        apiHelper.post({ url: "/companies/getCompanies" }),
    ]).then(function ([productsResult, categoriesResult, countriesResult, getCompaniesResult]) {
        products = productsResult.data;
        categories = categoriesResult;
        countries = countriesResult;
        companiesList = getCompaniesResult;

        updateAllCounters();
        renderProducts();
        updateCatBar();
        renderCategoriesList();
        updateCategoriesSelect();
        renderCountriesList();
        renderCompaniesList();
        if (isAdmin) {
            renderAdminList();
        };
    })

    // apiHelper.post({
    //     url:'/products/getProducts',
    //     onDone: function(data){
    //       products = data;
    //         updateAllCounters();
    //         renderProducts();
    //         updateCatBar();
    //         if(isAdmin) renderAdminList();
    //     }
    // });

    //   try {
    //     // const saved = localStorage.getItem('products_data');
    //     // if (saved) { products = JSON.parse(saved); }
    //     try {
    //       const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/main/${GITHUB_FILE}?t=${Date.now()}`);
    //       if (response.ok) {
    //         const githubProducts = await response.json();
    //         if (githubProducts && githubProducts.length > 0) {
    //           localStorage.setItem('products_data', JSON.stringify(products));
    //         }
    //       }
    //     } catch(e) {}
    //     if (!products || products.length === 0) {
    //       products = loadDefaultProducts();
    //       localStorage.setItem('products_data', JSON.stringify(products));
    //     }
    //   } catch(e) { products = loadDefaultProducts(); }

}

async function saveProductsToGitHub() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
        let sha = null;
        try {
            const getRes = await fetch(url, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
            if (getRes.ok) { const data = await getRes.json(); sha = data.sha; }
        } catch (e) { }
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(products, null, 2))));
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `تحديث المنتجات - ${new Date().toLocaleString('ar')}`, content: content, sha: sha })
        });
        if (response.ok) { localStorage.setItem('products_data', JSON.stringify(products)); showToast("✅ تم حفظ المنتجات"); return true; }
        else { localStorage.setItem('products_data', JSON.stringify(products)); return true; }
    } catch (e) { localStorage.setItem('products_data', JSON.stringify(products)); return true; }
}
function getCurrentDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function getFiltered() {
    return products.filter(p => {
        const matchFilter = curFilter === 'all' || p.status === curFilter;
        const matchCat = curCat === 'all' || p.cat === curCat;
        const matchSearch = !curSearch || p.name.includes(curSearch) || (p.nameEn || '').toLowerCase().includes(curSearch.toLowerCase());
        return matchFilter && matchCat && matchSearch;
    });
}

function updateAllCounters() {

    console.log({ products });
    document.getElementById('cnt-all').textContent = products.length;
    document.getElementById('cnt-r').textContent = products.filter(p => p.status === 'مقاطعة').length;
    document.getElementById('cnt-y').textContent = products.filter(p => p.status === 'اجتناب').length;
    document.getElementById('cnt-g').textContent = products.filter(p => p.status === 'بديل').length;
    document.getElementById('cnt-l').textContent = products.filter(p => p.status === 'الشراء من المحلي أفضل').length;
    document.getElementById('cnt-b').textContent = products.filter(p => p.status === 'لا توجد معلومات كافية').length;
    updateStatsBar();
}

function updateStatsBar() {
    const filtered = getFiltered();
    document.getElementById('sc-total').textContent = filtered.length;
    document.getElementById('sc-boycott').textContent = filtered.filter(p => p.status === 'مقاطعة').length;
    document.getElementById('sc-avoid').textContent = filtered.filter(p => p.status === 'اجتناب').length;
    document.getElementById('sc-alt').textContent = filtered.filter(p => p.status === 'بديل').length;
    document.getElementById('sc-local').textContent = filtered.filter(p => p.status === 'الشراء من المحلي أفضل').length;
    document.getElementById('sc-info').textContent = filtered.filter(p => p.status === 'لا توجد معلومات كافية').length;
}

function renderProducts() {

    console.log({ categories_at_render_products: categories })
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    const list = getFiltered();
    document.getElementById('resultsCount').textContent = curSearch ? `🔍 ${list.length} نتيجة` : '';
    if (!list.length) { grid.innerHTML = '<div class="empty-state">📭 لا توجد منتجات</div>'; return; }
    const statusColors = { مقاطعة: 'red', اجتناب: 'yel', بديل: 'grn', 'الشراء من المحلي أفضل': 'loc', 'لا توجد معلومات كافية': 'blu' };
    const statusEmoji = { مقاطعة: '🔴', اجتناب: '🟡', بديل: '🟢', 'الشراء من المحلي أفضل': '🟤', 'لا توجد معلومات كافية': '🔵' };
    grid.innerHTML = list.map(p => {
        const logoUrl = getCompanyLogo(p.company);
        const hasImage = (p.image && p.image.trim() !== '') || logoUrl;
        const imgSrc = p.image || logoUrl;
        const companyName = p.company || '—';
        return `
    <div class="card" onclick="openModal(${p.id})">
      <div class="card-stripe s-${statusColors[p.status]}"></div>
      <div class="card-img">${p.uuid ? `<img src="${p.image_url}" onerror="this.parentElement.innerHTML='<div class=no-image>${statusEmoji[p.status]}</div>'">` : `<div class="no-image">${statusEmoji[p.status]}</div>`}</div>
      <div class="card-body">
        <div class="card-name-row"><div class="card-name">${escapeHtml(p.name)}</div><div class="card-status-dot ${statusColors[p.status]}"></div></div>
        <div class="card-name-en">${escapeHtml(p.nameEn || '')}</div>
        <div class="card-info"><div class="card-info-row"><span class="lbl">الشركة:</span><span class="company-link" onclick="event.stopPropagation(); showCompanyProducts('${escapeHtml(companyName)}')">${escapeHtml(companyName)}</span></div></div>
        <div class="card-cat">📂 ${escapeHtml(p.cat)}</div>
        <div class="card-updated">📅 آخر تحديث: ${p.updatedAt || getCurrentDate()}</div>
        <button class="card-btn">عرض التفاصيل</button>
      </div>
    </div>`}).join('');
}

function editProduct(id) {
    const p = products.find(p => p.id === id);
    if (!p) return;
    document.getElementById('editId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productNameEn').value = p.nameEn || '';
    document.getElementById('productStatus').value = p.status;
    document.getElementById('productCat').value = p.cat;
    document.getElementById('companySearchInput').value = p.company || '';
    document.getElementById('productCompany').value = p.company || '';
    document.getElementById('productImage').value = p.image || '';
    document.getElementById('productReason').value = p.reason || '';
    document.getElementById('productAlt').value = p.alt || '';
    document.getElementById('productDate').value = p.updatedAt || getCurrentDate();
    const altField = document.getElementById('altField');
    if (p.status === 'مقاطعة') { altField.style.display = 'block'; } else { altField.style.display = 'none'; }
    clearImageUpload();
    showToast('✏️ قم بالتعديل ثم اضغط حفظ');
}

async function deleteProduct(id) {
    if (!isAdmin) return;
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        products = products.filter(p => p.id !== id);
        const saved = await saveProductsToGitHub();
        if (saved) {
            updateAllCounters();
            renderProducts();
            renderAdminList();
            updateCatBar();
            showToast('🗑️ تم حذف المنتج');
        }
    }
}

async function saveProduct() {
    console.log('saveProduct is triggered 2')

    if (!isAdmin) { showToast('❌ يجب تسجيل الدخول أولاً'); return; }
    let id = document.getElementById('editId').value;
    // const status = document.getElementById('productStatus').value;
    // const countriesStr = selectedCountriesList.map(c => c.nameAr).join(', ');
    // const companyName = document.getElementById('productCompany').value;



    let newProduct = {
        id: -1,
        product_name_ar: $('.admin-section #productName').val(),
        product_name_en: $('.admin-section #productNameEn').val(),
        status_id: $('.admin-section #productStatus').val(),
        // cat: document.getElementById('productCat').value, 
        company_id: $('.admin-section #companyDropdown').val(),
        country_id: $('.admin-section #countryDropdown').val(),
        // image_file: document.getElementById('productImage').value,
        product_reason: $('.admin-section #productReason').val(),
        // updatedAt: document.getElementById('productDate').value || getCurrentDate() 
    };


    if (!newProduct.name) { showToast('❌ الرجاء إدخال اسم المنتج'); return; }

    console.log({ newProduct });

    return;

    let isEdit = false;
    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index] = newProduct;
            isEdit = true;
        }
    } else {
        products.unshift(newProduct);
        isEdit = false;
    }

    const saved = await saveProductsToGitHub();
    if (saved) {
        updateAllCounters();
        renderProducts();
        renderAdminList();
        updateCatBar();
        if (isEdit) {
            showToast('✏️ تم التعديل بنجاح');
        } else {
            showToast('✅ تمت الإضافة بنجاح');
        }
    }

    document.getElementById('editId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productNameEn').value = '';
    document.getElementById('companySearchInput').value = '';
    document.getElementById('productCompany').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('productReason').value = '';
    document.getElementById('productAlt').value = '';
    document.getElementById('altField').style.display = 'block';
    selectedCountriesList = [];
    renderSelectedCountries();
    clearImageUpload();

    setTimeout(() => {
        closeAdminPanel();
    }, 1500);
}


//#endregion

function escapeHtml(text) { if (!text) return ''; return text.replace(/[&<>]/g, function (m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }

function setFilter(btn, filter) {
    curFilter = filter;
    document.querySelectorAll('.fpill').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderProducts();
    updateStatsBar();
    document.querySelectorAll('.stat-item').forEach(s => s.classList.remove('active'));
}

function setStatFilter(el, filter) {
    curFilter = filter;
    document.querySelectorAll('.fpill').forEach(b => b.classList.remove('on'));
    const targetPill = Array.from(document.querySelectorAll('.fpill')).find(b => b.innerText.includes(filter === 'all' ? 'الجميع' : filter));
    if (targetPill) targetPill.classList.add('on');
    document.querySelectorAll('.stat-item').forEach(s => s.classList.remove('active'));
    el.classList.add('active');
    renderProducts();
    updateStatsBar();
}

function setCat(btn, cat) {
    curCat = cat;
    document.querySelectorAll('.ctab').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderProducts();
    updateStatsBar();
}

// function renderAdminList() {
//     if (!isAdmin) return;
//     const container = document.getElementById('adminProducts');
//     if (!container) return;
//     let filtered = products;
//     if (adminSearchTerm) filtered = products.filter(p => p.name.includes(adminSearchTerm));
//     container.innerHTML = filtered.map(p => `<div class="admin-list-item"><div class="info"><span class="admin-product-name">${escapeHtml(p.name)}</span><br><small>${p.status} | ${p.cat}</small><br><small>📅 ${p.updatedAt || getCurrentDate()}</small></div><div><button class="btn-secondary" style="background:var(--blue);color:white;margin-left:5px;" onclick="editProduct(${p.id})">✏️ تعديل</button><button class="btn-danger" onclick="deleteProduct(${p.id})">🗑️ حذف</button></div></div>`).join('');
// }

function renderAdminList() {
    if (!isAdmin) return;

    let $container = $('#adminProducts');
    if (!$container.length) return;

    let filtered = products;

    if (adminSearchTerm) {
        filtered = products.filter(p =>
            p.name.includes(adminSearchTerm)
        );
    }

    $.each(filtered, function (index, p){
        let name = escapeHtml(p.name);
        let date = p.updatedAt || getCurrentDate();

        let productItem =  $(`
            <div class="admin-list-item" data-product-id="${p.id}">
                <div class="info">
                    <span class="admin-product-name">${name}</span><br>
                    <small>${p.status} | ${p.cat}</small><br>
                    <small>📅 ${date}</small>
                </div>

                <div>
                    <button class="btn-secondary"
                        style="background:var(--blue);color:white;margin-left:5px;"
                        onclick="editProduct(${p.id})">
                        ✏️ تعديل
                    </button>

                    <button class="btn-danger" onclick="deleteProduct(${p.id})">
                        🗑️ حذف
                    </button>
                </div>
            </div>
        `);

        productItem.appendTo($container);
    });

}

function filterAdminList() {
    adminSearchTerm = document.getElementById('adminSearch').value;
    renderAdminList();
}

function closeAdminPanel() {
    document.getElementById('adminPanel').classList.remove('open');
    document.getElementById('adminOverlay').classList.remove('open');
}

document.getElementById('productStatus')?.addEventListener('change', function () {
    const altField = document.getElementById('altField');
    if (this.value === 'مقاطعة') { altField.style.display = 'block'; } else { altField.style.display = 'none'; }
});

// ===================== صفحة الشركات =====================
function renderCompaniesPage() {
    const container = document.getElementById('companiesGrid');
    if (!container) return;

    const companyStats = {};
    products.forEach(p => {
        const comp = p.company || 'غير محدد';
        companyStats[comp] = (companyStats[comp] || 0) + 1;
    });

    const allCompanies = [...new Set(products.map(p => p.company || 'غير محدد'))];
    const sortedCompanies = allCompanies.sort((a, b) => {
        if (companyStats[a] !== companyStats[b]) {
            return companyStats[b] - companyStats[a];
        }
        return a.localeCompare(b);
    });

    container.innerHTML = sortedCompanies.map(comp => `
    <div class="company-card" onclick="showCompanyProducts('${escapeHtml(comp)}')">
      <div class="company-name">${escapeHtml(comp)}</div>
      <div class="company-count">${companyStats[comp] || 0} منتج</div>
    </div>
  `).join('');
}

// البحث في الشركات (صفحة الشركات)
let companiesSearchTimeout;
function setupCompaniesSearch() {
    const input = document.getElementById('companiesSearchInput');
    if (!input) return;
    input.addEventListener('input', function () {
        clearTimeout(companiesSearchTimeout);
        companiesSearchTimeout = setTimeout(() => {
            const query = this.value.toLowerCase();
            const allCompanies = [...new Set(products.map(p => p.company || 'غير محدد'))];
            let filtered = allCompanies.filter(c => c.toLowerCase().includes(query));

            const companyStats = {};
            products.forEach(p => { companyStats[p.company] = (companyStats[p.company] || 0) + 1; });

            filtered = filtered.sort((a, b) => {
                if (companyStats[a] !== companyStats[b]) {
                    return companyStats[b] - companyStats[a];
                }
                return a.localeCompare(b);
            });

            const container = document.getElementById('companiesGrid');
            if (container) {
                container.innerHTML = filtered.map(comp => `
          <div class="company-card" onclick="showCompanyProducts('${escapeHtml(comp)}')">
            <div class="company-name">${escapeHtml(comp)}</div>
            <div class="company-count">${companyStats[comp] || 0} منتج</div>
          </div>
        `).join('');
            }
        }, 300);
    });
}

// ===================== نافذة المشاركة =====================
// #region share model
let shareProduct = null;

function showShareModal() {
    if (!currentProduct) return;
    shareProduct = currentProduct;
    const statusEmoji = { مقاطعة: '🔴', اجتناب: '🟡', بديل: '🟢', 'الشراء من المحلي أفضل': '🟤', 'لا توجد معلومات كافية': '🔵' };
    const statusClass = { مقاطعة: 'red', اجتناب: 'yellow', بديل: 'green', 'الشراء من المحلي أفضل': 'brown', 'لا توجد معلومات كافية': 'blue' };

    document.getElementById('shareProductName').textContent = shareProduct.name;
    document.getElementById('shareProductStatus').textContent = `${statusEmoji[shareProduct.status]} ${shareProduct.status}`;
    document.getElementById('shareProductStatus').className = `share-status ${statusClass[shareProduct.status]}`;

    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${shareProduct.id}`;
    document.getElementById('shareProductLink').textContent = shareUrl;

    document.getElementById('shareModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('open');
    document.body.style.overflow = '';
}

function copyShareLink() {
    const linkText = document.getElementById('shareProductLink').textContent;
    navigator.clipboard.writeText(linkText);
    showToast('📋 تم نسخ الرابط');
    closeShareModal();
}

function copyShareMessage() {
    if (!shareProduct) return;
    const statusEmoji = { مقاطعة: '🔴', اجتناب: '🟡', بديل: '🟢', 'الشراء من المحلي أفضل': '🟤', 'لا توجد معلومات كافية': '🔵' };
    const shareUrl = `${window.location.origin}${window.location.pathname}?product=${shareProduct.id}`;

    let message = `🛒 ${shareProduct.name}
📋 الحالة: ${statusEmoji[shareProduct.status]} ${shareProduct.status}
📂 القسم: ${shareProduct.cat}
🏢 الشركة: ${shareProduct.company || '—'}
📝 السبب: ${shareProduct.reason || '—'}`;

    // إذا كان المنتج مقاطعة، أضف البدائل من نفس القائمة
    if (shareProduct.status === 'مقاطعة') {
        const alternatives = getAlternativesForProduct(shareProduct);
        if (alternatives.length > 0) {
            const altNames = alternatives.map(alt => alt.name).join('، ');
            message += `\n🔄 البدائل: ${altNames}`;
        }
    }

    message += `\n\n🔗 رابط المنتج: ${shareUrl}`;

    navigator.clipboard.writeText(message);
    showToast('💬 تم نسخ الرسالة مع الرابط');
    closeShareModal();
}
// #endregion


// ===================== نافذة منتجات الشركة =====================
function showCompanyProducts(companyName) {
    const companyProducts = products.filter(p => p.company === companyName);
    const title = document.getElementById('companyProductsTitle');
    title.textContent = `🏢 منتجات شركة ${companyName}`;

    const container = document.getElementById('companyProductsList');
    const statusEmoji = { مقاطعة: '🔴', اجتناب: '🟡', بديل: '🟢', 'الشراء من المحلي أفضل': '🟤', 'لا توجد معلومات كافية': '🔵' };
    const statusClass = { مقاطعة: 'red', اجتناب: 'yellow', بديل: 'green', 'الشراء من المحلي أفضل': 'brown', 'لا توجد معلومات كافية': 'blue' };

    if (companyProducts.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;">📭 لا توجد منتجات لهذه الشركة</div>';
    } else {
        container.innerHTML = companyProducts.map(p => `
      <div class="company-product-card" style="border-right-color: var(--${statusClass[p.status]})" onclick="closeCompanyProductsModal(); openModal(${p.id})">
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="status-badge ${statusClass[p.status]}">${statusEmoji[p.status]} ${p.status}</div>
      </div>
    `).join('');
    }

    document.getElementById('companyProductsModal').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeCompanyProductsModal() {
    const modal = document.getElementById('companyProductsModal');
    if (modal) {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }
}

// ===================== مستمعي الأحداث =====================
const reasonTextarea = document.getElementById('productReason');
if (reasonTextarea) { reasonTextarea.addEventListener('input', function (e) { showKeywordSuggestions(this); }); }
setupCountrySearch();
setupCompanySearch();

// ===================== تبويبات لوحة الإدارة =====================
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', function () {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(`section-${this.dataset.tab}`).classList.add('active');
        if (this.dataset.tab === 'products') {
            refreshProductsCompanyDropdown();
        }
    });
});

let currentProduct = null;

function openModal(id) {
    currentProduct = products.find(p => p.id === id);
    if (!currentProduct) return;
    const statusEmoji = { مقاطعة: '🔴', اجتناب: '🟡', بديل: '🟢', 'الشراء من المحلي أفضل': '🟤', 'لا توجد معلومات كافية': '🔵' };
    const statusColors = { مقاطعة: 'red', اجتناب: 'yel', بديل: 'grn', 'الشراء من المحلي أفضل': 'loc', 'لا توجد معلومات كافية': 'blu' };
    const isAlt = currentProduct.status === 'بديل';
    const isBoycott = currentProduct.status === 'مقاطعة';
    const hasImage = currentProduct.image && currentProduct.image.trim() !== '';
    const logoUrl = getCompanyLogo(currentProduct.company);
    const imgSrc = currentProduct.image || logoUrl;

    document.getElementById('mStripe').style.background = `var(--${statusColors[currentProduct.status]})`;
    document.getElementById('mImg').innerHTML = (hasImage || logoUrl) ? `<img src="${imgSrc}" onerror="this.parentElement.innerHTML='<div class=no-image-modal>${statusEmoji[currentProduct.status]}</div>'">` : `<div class="no-image-modal">${statusEmoji[currentProduct.status]}</div>`;
    document.getElementById('mTitle').textContent = currentProduct.name;
    document.getElementById('mTitleEn').textContent = currentProduct.nameEn || '';
    document.getElementById('mStatus').textContent = currentProduct.status;
    document.getElementById('mCountry').textContent = currentProduct.country_name_ar || '—';

    const companyName = currentProduct.company || '—';
    document.getElementById('mCompany').innerHTML = `<div class="company-full-box" onclick="event.stopPropagation(); showCompanyProducts('${escapeHtml(companyName)}')">${escapeHtml(companyName)}</div>`;

    document.getElementById('mCat').textContent = currentProduct?.categories[0]?.categoy_name_ar || '—';
    document.getElementById('mUpdatedAt').textContent = `📅 آخر تحديث: ${currentProduct.updatedAt || getCurrentDate()}`;

    function makeLinksClickable(text) {
        let urlPattern = /(https?:\/\/[^\s]+)/g;

        return text.replace(urlPattern, function (url) {
            return '<a href="' + url + '" target="_blank">' + url + '</a>';
        });
    }

    let $reason = $('#mReason');

    if (currentProduct.reason) {
        let clickableReason = makeLinksClickable(currentProduct.reason);
        $reason.html(clickableReason);
    } else {
        // $reason.text('لا يوجد سبب محدد');
        $reason.text('-');
    }

    let $alt = $('#mAlt');

    if (currentProduct.alt) {
        let clickableAlt = makeLinksClickable(currentProduct.reason);
        $alt.html(clickableAlt);
    } else {
        $alt.text('-');
    }

    if (isAlt) {
        $reason.addClass('green');
        $alt.addClass('green');
    } else {
        $reason.removeClass('green');
        $alt.removeClass('green');
    }

    const altWrap = document.getElementById('mAltWrap');
    const altElement = document.getElementById('mAlt');

    if (isBoycott) {
        const alternativesHtml = getAlternativesHtml(currentProduct);
        if (alternativesHtml) {
            altElement.innerHTML = alternativesHtml;
            altWrap.style.display = 'block';
        } else {
            altWrap.style.display = 'none';
        }
    } else {
        altWrap.style.display = 'none';
    }
    document.getElementById('mCircle').textContent = statusEmoji[currentProduct.status];
    document.getElementById('modal').classList.add('open');
    document.body.style.overflow = 'hidden';
    const newUrl = `${window.location.origin}${window.location.pathname}?product=${currentProduct.id}`;
    window.history.pushState({ productId: currentProduct.id }, '', newUrl);
}

function closeModal() {
    const modal = document.getElementById('modal');
    const overlay = document.getElementById('modal');
    modal.classList.add('closing');
    if (overlay.parentElement) overlay.parentElement.classList.add('closing');
    setTimeout(() => {
        modal.classList.remove('closing');
        if (overlay.parentElement) overlay.parentElement.classList.remove('closing');
        document.getElementById('modal').classList.remove('open');
        document.body.style.overflow = '';
        const newUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.pushState({}, '', newUrl);
    }, 300);
}

function closeLoginModalOnOutside(event) {
    if (event.target === document.getElementById('loginModal')) {
        document.getElementById('loginModal').classList.remove('open');
    }
}

function checkUrlForProduct() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product');
    if (productId) {
        setTimeout(() => {
            const id = parseInt(productId);
            const product = products.find(p => p.id === id);
            if (product) { openModal(id); }
        }, 800);
    }
}

function editProduct(id) {
    const p = products.find(p => p.id === id);
    if (!p) return;
    document.getElementById('editId').value = p.id;
    document.getElementById('productName').value = p.name;
    document.getElementById('productNameEn').value = p.nameEn || '';
    document.getElementById('productStatus').value = p.status_id;
    document.getElementById('productCat').value = p.cat;
    document.getElementById('companySearchInput').value = p.company || '';
    document.getElementById('productCompany').value = p.company || '';
    document.getElementById('productImage').value = p.image || '';
    document.getElementById('productReason').value = p.reason || '';
    document.getElementById('productAlt').value = p.alt || '';
    document.getElementById('productDate').value = p.updatedAt || getCurrentDate();
    const altField = document.getElementById('altField');
    if (p.status === 'مقاطعة') { altField.style.display = 'block'; } else { altField.style.display = 'none'; }
    clearImageUpload();
    showToast('✏️ قم بالتعديل ثم اضغط حفظ');
}

async function deleteProduct(id) {
    if (!isAdmin) return;
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {

        apiHelper.post({
            url: '/products/deleteProduct',
            args: {
                product_id: id
            }
        }).then(function () {
            let productItem = $(`.admin-list-item[data-product-id="${id}"]`);

            productItem.slideUp(300, function () {
                $(this).remove();
            });

            updateAllCounters();
            renderProducts();
            renderAdminList();
            updateCatBar();
            showToast('🗑️ تم حذف المنتج');
        });
        // products = products.filter(p => p.id !== id);
        // const saved = await saveProductsToGitHub();
        // if (saved) {

        // }
    }
}

async function saveProduct() {
    console.log('saveProduct is triggered 1')

    // if (!isAdmin) { showToast('❌ يجب تسجيل الدخول أولاً'); return; }
    // const id = document.getElementById('editId').value;
    // const status = document.getElementById('productStatus').value;/
    // const countriesStr = selectedCountriesList.map(c => c.nameAr).join(', ');
    // const companyName = document.getElementById('productCompany').value;

    let contryDropdown = $('.admin-section #countryDropdown');
    let country_id = contryDropdown.val() ? parseInt(contryDropdown.val()) : null;

    let companyDropdown = $('.admin-section #companyDropdown');
    let company_id = companyDropdown.val() ? parseInt(companyDropdown.val()) : null;

    let statusDropdown = $('.admin-section #productStatus');
    let status_id = statusDropdown.val() ? parseInt(statusDropdown.val()) : null;

    let product_alt_input = $('.admin-section #productAlt');
    let product_alt = product_alt_input.val();

    let productReasonInput = $('.admin-section #productReason');
    let product_reason = productReasonInput.val();

    let productImage = $('#productImageFile')[0].files.length > 0 ? $('#productImageFile')[0].files[0] : null;

    let formData = new FormData();

    formData.append("product_id", -1);
    formData.append("product_name_ar", $('.admin-section #productName').val());
    formData.append("product_name_en", $('.admin-section #productNameEn').val());

    let categories = [parseInt($('.admin-section #productCat').val())];

    categories.forEach((id, index) => {
        formData.append(`categories_id[${index}]`, id);
    });

    formData.append("company_id", company_id);
    formData.append("country_id", country_id);
    formData.append("product_alt", product_alt);
    formData.append("status_id", status_id);
    formData.append("product_reason", product_reason);

    if(productImage){
        formData.append("image_file", productImage);
    }

    apiHelper.post({
        url: '/products/setProduct',
        isFormData:true,
        args: formData
    }).then(function (res) {
        console.log(res);
    });

    // if (!newProduct.product_name_ar || !newProduct.product_name_en) {
    //     showToast('❌ الرجاء إدخال اسم المنتج');
    //     return;
    // }


    return;
    let isEdit = false;
    if (id) {
        const index = products.findIndex(p => p.id == id);
        if (index !== -1) {
            products[index] = newProduct;
            isEdit = true;
        }
    } else {
        products.unshift(newProduct);
        isEdit = false;
    }

    const saved = await saveProductsToGitHub();
    if (saved) {
        updateAllCounters();
        renderProducts();
        renderAdminList();
        updateCatBar();
        if (isEdit) {
            showToast('✏️ تم التعديل بنجاح');
        } else {
            showToast('✅ تمت الإضافة بنجاح');
        }
    }

    document.getElementById('editId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productNameEn').value = '';
    document.getElementById('companySearchInput').value = '';
    document.getElementById('productCompany').value = '';
    document.getElementById('productImage').value = '';
    document.getElementById('productReason').value = '';
    document.getElementById('productAlt').value = '';
    document.getElementById('altField').style.display = 'block';
    selectedCountriesList = [];
    renderSelectedCountries();
    clearImageUpload();

    setTimeout(() => {
        closeAdminPanel();
    }, 1500);
}


// تحديث صفحة الشركات عند فتحها
function updateCompaniesPage() {
    if (document.getElementById('page-companies').classList.contains('active')) {
        renderCompaniesPage();
    }
}

document.getElementById('searchInput')?.addEventListener('input', function (e) {
    curSearch = e.target.value;
    renderProducts();
    updateStatsBar();
});

document.getElementById('mClose')?.addEventListener('click', closeModal);
document.getElementById('modal')?.addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });

function showPage(p) {
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + p).classList.add('active');
    window.scrollTo(0, 0);
    document.querySelectorAll('.dl').forEach(a => a.classList.remove('on'));
    const dl = document.getElementById('dl-' + p);
    if (dl) dl.classList.add('on');

    if (p === 'companies') {
        renderCompaniesPage();
    }
}

function nav(p) { showPage(p); closeDrawer(); }

function openDrawer() {
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawerOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
    document.body.style.overflow = '';
}

function toggleAdminPanel() {
    if (!isAdmin) { showToast('❌ يجب تسجيل الدخول أولاً'); return; }
    document.getElementById('adminPanel').classList.toggle('open');
    document.getElementById('adminOverlay').classList.toggle('open');

    apiHelper.post({ url: '/products/getAddProductComboBoxes' }).then(function (result) {
        let productStatuses = result.data.statuses;
        let productCountries = result.data.countries;
        let productCategories = result.data.categories;
        let productCompanies = result.data.companies;

        let productStatusDropDown = $('.admin-section #productStatus');

        for (let i = 0; i < productStatuses.length; i++) {
            let option = $('<option></option>').appendTo(productStatusDropDown);

            option.attr('value', productStatuses[i].id);
            option.text(productStatuses[i].status_name_ar);
        }

        let productCategoriesDropDown = $('.admin-section #productCat');

        for (let i = 0; i < productCategories.length; i++) {

            let option = $('<option></option>').appendTo(productCategoriesDropDown);

            option.attr('value', productCategories[i].id)
            option.text(productCategories[i].category_name_ar)

        }


        let companyDropdown = $('.admin-section #companyDropdown');

        for (let i = 0; i < productCompanies.length; i++) {

            let option = $('<option></option>').appendTo(companyDropdown);


            let companyName = '';

            if (productCompanies[i].company_name_ar && productCompanies[i].company_name_en) {
                companyName = productCompanies[i].company_name_ar + " - " + productCompanies[i].company_name_en;
            } else if (productCompanies[i].company_name_ar) {
                companyName = productCompanies[i].company_name_ar;
            } else if (productCompanies[i].company_name_en) {
                companyName = productCompanies[i].company_name_en;
            }

            option.attr('value', productCompanies[i].id);
            option.text(companyName);

        }

        let countryDropdown = $('.admin-section #countryDropdown');

        for (let i = 0; i < productCountries.length; i++) {

            let option = $('<option></option>').appendTo(countryDropdown);

            option.attr('value', productCountries[i].id);
            option.text(productCountries[i].country_name_ar);

        }
        // let productStatusDropDown = document.querySelector('.admin-section #productCat');

        // for (let i = 0; i < productCategories.length; i++) {
        //     let opt = document.createElement('option');
        //     opt.value = productCategories[i].id;
        //     opt.textContent = productCategories[i].category_name_ar;
        //     productStatusDropDown.appendChild(opt);
        // }



        console.log({ result });
    });

    if (isAdmin) renderAdminList();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}



function checkLogin() {

    let loginModal = $('#loginModal');

    let email = loginModal.find('#adminEmail').val();
    let password = loginModal.find('#adminPassword').val();

    apiHelper.post({
        url:'/user/login',
        args: {
            email,password
        }
    }).then(function(result){

        if(result.message == 'Login successful'){
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            sessionStorage.setItem('adminToken', result.token);
            document.getElementById('loginModal').classList.remove('open');
            showToast('✅ تم تسجيل الدخول بنجاح');
            renderAdminList();
            setTimeout(() => toggleAdminPanel(), 500);
        } else {
            let loginError = loginModal.find('#loginError');
            loginError.show();
            setTimeout(() => loginError.hide(), 2000);
        }
    }).catch(function(){
        let loginError = loginModal.find('#loginError');
        loginError.show();
        setTimeout(() => loginError.hide(), 2000);
    });
}

function checkAdminSession() {
    const token = sessionStorage.getItem('adminToken');
    if (!token) return;

    apiHelper.post({ url: '/user/verifyToken' }).then(function (result) {
        if (result.valid) {
            isAdmin = true;
            sessionStorage.setItem('isAdmin', 'true');
            showToast('✅ تم تسجيل الدخول تلقائياً');
        }
    }).catch(function () {
        sessionStorage.removeItem('isAdmin');
        sessionStorage.removeItem('adminToken');
    });
}

function setDefaultDate() {
    const dateInput = document.getElementById('productDate');
    if (dateInput && !dateInput.value) {
        dateInput.value = getCurrentDate();
    }
}

checkAdminSession();
loadProducts();
loadAdminData();
setTimeout(() => { tryLoadLogo(); setDefaultDate(); checkUrlForProduct(); setupCompaniesSearch(); setupParentCompanySearch(); }, 500);
