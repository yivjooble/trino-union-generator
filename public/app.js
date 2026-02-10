// Trino UNION ALL Query Generator - Frontend Application

class TrinoQueryGenerator {
    constructor() {
        this.currentStep = 1;
        this.selectedCatalogs = [];
        this.selectedSchema = null;
        this.selectedTables = [];
        this.tablesColumns = {};
        this.selectedColumns = {};
        this.joins = [];
        this.filters = [];
        this.limit = null;
        this.country = null;
        this.enableCountryPattern = true;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadCatalogs();
    }
    
    bindEvents() {
        // Navigation buttons
        document.getElementById('next-to-step-2').addEventListener('click', () => this.goToStep(2));
        document.getElementById('back-to-step-1').addEventListener('click', () => this.goToStep(1));
        document.getElementById('next-to-step-3').addEventListener('click', () => this.goToStep(3));
        document.getElementById('back-to-step-2').addEventListener('click', () => this.goToStep(2));
        document.getElementById('next-to-step-4').addEventListener('click', () => this.goToStep(4));
        document.getElementById('back-to-step-3').addEventListener('click', () => this.goToStep(3));
        document.getElementById('generate-query').addEventListener('click', () => this.generateQuery());
        document.getElementById('back-to-step-4').addEventListener('click', () => this.goToStep(4));
        document.getElementById('start-over').addEventListener('click', () => this.startOver());
        
        // Country pattern toggle
        document.getElementById('enable-country-pattern').addEventListener('change', (e) => {
            this.enableCountryPattern = e.target.checked;
            document.getElementById('country-selector').style.display = e.target.checked ? 'block' : 'none';
            if (!e.target.checked) {
                this.country = null;
                document.getElementById('selected-country').value = '';
            }
        });
        
        // Country selector
        document.getElementById('selected-country').addEventListener('change', (e) => {
            this.country = e.target.value || null;
        });
        
        // Search inputs
        document.getElementById('catalog-search').addEventListener('input', (e) => this.filterCatalogs(e.target.value));
        document.getElementById('table-search').addEventListener('input', (e) => this.filterTables(e.target.value));
        
        // Schema select
        document.getElementById('schema-select').addEventListener('change', (e) => this.selectSchema(e.target.value));
        
        // Add join/filter buttons
        document.getElementById('add-join').addEventListener('click', () => this.addJoin());
        document.getElementById('add-filter').addEventListener('click', () => this.addFilter());
        
        // Copy button
        document.getElementById('copy-btn').addEventListener('click', () => this.copyQuery());
    }
    
    // Show error message
    showError(message) {
        const container = document.getElementById('error-container');
        container.textContent = message;
        container.style.display = 'block';
    }
    
    // Hide error message
    hideError() {
        document.getElementById('error-container').style.display = 'none';
    }
    
    // Navigate to step
    goToStep(step) {
        this.hideError();
        
        // Validate current step before moving
        if (this.currentStep === 1 && step > 1) {
            if (this.selectedCatalogs.length === 0) {
                this.showError('Please select at least one catalog');
                return;
            }
        }
        
        if (this.currentStep === 2 && step > 2) {
            if (!this.selectedSchema) {
                this.showError('Please select a schema');
                return;
            }
        }
        
        if (this.currentStep === 3 && step > 3) {
            if (this.selectedTables.length === 0) {
                this.showError('Please select at least one table');
                return;
            }
        }
        
        // Update step content visibility
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');
        
        // Update wizard steps
        document.querySelectorAll('.wizard-step').forEach((el, index) => {
            const stepNum = index + 1;
            el.classList.remove('active', 'completed');
            if (stepNum === step) {
                el.classList.add('active');
            } else if (stepNum < step) {
                el.classList.add('completed');
            }
        });
        
        this.currentStep = step;
        
        // Initialize step-specific content
        if (step === 2) this.initStep2();
        if (step === 3) this.initStep3();
        if (step === 4) this.initStep4();
    }
    
    // Load catalogs from API
    async loadCatalogs() {
        try {
            const response = await fetch('/api/catalogs');
            const data = await response.json();
            
            if (data.success) {
                this.renderCatalogs(data.data.catalogs, data.data.countries);
            } else {
                this.showError('Failed to load catalogs: ' + data.error);
            }
        } catch (error) {
            this.showError('Error loading catalogs: ' + error.message);
        }
    }
    
    // Render catalogs list
    renderCatalogs(catalogs, countries) {
        const container = document.getElementById('catalog-list');
        let html = '';
        
        // Add country options as catalogs
        if (countries && countries.length > 0) {
            countries.forEach(country => {
                html += `
                    <label class="checkbox-item">
                        <input type="checkbox" value="${country}" data-type="country">
                        <span>🌍 ${country.toUpperCase()} (Country Code)</span>
                    </label>
                `;
            });
        }
        
        // Add actual catalogs
        if (catalogs && catalogs.length > 0) {
            catalogs.forEach(catalog => {
                html += `
                    <label class="checkbox-item">
                        <input type="checkbox" value="${catalog}" data-type="catalog">
                        <span>📁 ${catalog}</span>
                    </label>
                `;
            });
        }
        
        if (!html) {
            html = '<p style="color: #666;">No catalogs available</p>';
        }
        
        container.innerHTML = html;
        
        // Bind checkbox events
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleCatalogSelect(e));
        });
    }
    
    // Filter catalogs by search
    filterCatalogs(query) {
        const items = document.querySelectorAll('#catalog-list .checkbox-item');
        const lowerQuery = query.toLowerCase();
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(lowerQuery) ? 'flex' : 'none';
        });
    }
    
    // Handle catalog selection
    handleCatalogSelect(event) {
        const checkbox = event.target;
        const value = checkbox.value;
        const type = checkbox.dataset.type;
        
        if (checkbox.checked) {
            this.selectedCatalogs.push({ value, type, catalog: value });
        } else {
            this.selectedCatalogs = this.selectedCatalogs.filter(c => c.value !== value);
        }
        
        this.updateSelectedCatalogsDisplay();
        this.updateNextButton(1);
    }
    
    // Update selected catalogs display
    updateSelectedCatalogsDisplay() {
        const container = document.getElementById('selected-catalogs-list');
        
        if (this.selectedCatalogs.length === 0) {
            container.innerHTML = '<p style="color: #666;">No catalogs selected yet</p>';
            return;
        }
        
        let html = '';
        this.selectedCatalogs.forEach((cat, index) => {
            html += `
                <div class="selected-item">
                    <span>${cat.type === 'country' ? '🌍' : '📁'} ${cat.value}</span>
                    <button class="remove-btn" onclick="app.removeCatalog(${index})">Remove</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // Remove catalog
    removeCatalog(index) {
        const catalog = this.selectedCatalogs[index];
        const checkbox = document.querySelector(`#catalog-list input[value="${catalog.value}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }
        this.selectedCatalogs.splice(index, 1);
        this.updateSelectedCatalogsDisplay();
        this.updateNextButton(1);
    }
    
    // Update next button state
    updateNextButton(step) {
        const btn = document.getElementById(`next-to-step-${step + 1}`);
        if (!btn) return;
        
        if (step === 1) {
            btn.disabled = this.selectedCatalogs.length === 0;
        } else if (step === 2) {
            btn.disabled = !this.selectedSchema;
        } else if (step === 3) {
            btn.disabled = this.selectedTables.length === 0;
        }
    }
    
    // Initialize step 2
    initStep2() {
        document.getElementById('selected-catalog-display').innerHTML = 
            this.selectedCatalogs.map(c => `📁 <strong>${c.value}</strong>`).join(', ') || 
            '<span style="color: #666;">No catalog selected</span>';
        
        this.loadSchemas();
    }
    
    // Load schemas for selected catalog
    async loadSchemas() {
        const catalog = this.selectedCatalogs[0].value;
        const select = document.getElementById('schema-select');
        select.innerHTML = '<option value="">-- Select Schema --</option>';
        
        try {
            const response = await fetch(`/api/catalogs/${catalog}/schemas`);
            const data = await response.json();
            
            if (data.success) {
                data.data.forEach(schema => {
                    const option = document.createElement('option');
                    option.value = schema;
                    option.textContent = schema;
                    select.appendChild(option);
                });
            } else {
                this.showError('Failed to load schemas: ' + data.error);
            }
        } catch (error) {
            this.showError('Error loading schemas: ' + error.message);
        }
    }
    
    // Select schema
    selectSchema(schema) {
        this.selectedSchema = schema;
        
        const display = document.getElementById('selected-schema-display');
        if (schema) {
            display.innerHTML = `<strong>${schema}</strong>`;
            this.updateNextButton(2);
        } else {
            display.innerHTML = '<p style="color: #666;">No schema selected yet</p>';
            document.getElementById('next-to-step-3').disabled = true;
        }
    }
    
    // Initialize step 3
    initStep3() {
        document.getElementById('selected-schema-display-2').innerHTML = 
            `<strong>${this.selectedCatalogs[0].value}</strong>.<strong>${this.selectedSchema}</strong>`;
        
        this.loadTables();
    }
    
    // Load tables for selected schema
    async loadTables() {
        const catalog = this.selectedCatalogs[0].value;
        const schema = this.selectedSchema;
        const container = document.getElementById('table-list');
        
        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        
        try {
            const url = `/api/catalogs/${catalog}/schemas/${schema}/tables${this.country ? `?country=${this.country}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                this.renderTables(data.data);
            } else {
                this.showError('Failed to load tables: ' + data.error);
            }
        } catch (error) {
            this.showError('Error loading tables: ' + error.message);
        }
    }
    
    // Render tables list
    renderTables(tables) {
        const container = document.getElementById('table-list');
        
        if (!tables || tables.length === 0) {
            container.innerHTML = '<p style="color: #666;">No tables found</p>';
            return;
        }
        
        let html = '';
        tables.forEach(table => {
            html += `
                <label class="checkbox-item">
                    <input type="checkbox" value="${table}" data-table="${table}">
                    <span>📊 ${table}</span>
                </label>
            `;
        });
        
        container.innerHTML = html;
        
        // Bind checkbox events
        container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleTableSelect(e));
        });
    }
    
    // Filter tables by search
    filterTables(query) {
        const items = document.querySelectorAll('#table-list .checkbox-item');
        const lowerQuery = query.toLowerCase();
        
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(lowerQuery) ? 'flex' : 'none';
        });
    }
    
    // Handle table selection
    async handleTableSelect(event) {
        const checkbox = event.target;
        const tableName = checkbox.value;
        
        if (checkbox.checked) {
            // Load columns for this table
            await this.loadTableColumns(tableName);
            this.selectedTables.push({
                catalog: this.selectedCatalogs[0].value,
                schema: this.selectedSchema,
                tableName: tableName
            });
        } else {
            this.selectedTables = this.selectedTables.filter(t => t.tableName !== tableName);
            delete this.selectedColumns[tableName];
        }
        
        this.updateSelectedTablesDisplay();
        this.updateColumnSelection();
        this.updateNextButton(3);
    }
    
    // Load columns for a table
    async loadTableColumns(tableName) {
        const catalog = this.selectedCatalogs[0].value;
        const schema = this.selectedSchema;
        
        try {
            const url = `/api/catalogs/${catalog}/schemas/${schema}/columns/${tableName}${this.country ? `?country=${this.country}` : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.success) {
                this.tablesColumns[tableName] = data.data;
            }
        } catch (error) {
            console.error('Error loading columns for', tableName, error);
        }
    }
    
    // Update selected tables display
    updateSelectedTablesDisplay() {
        const container = document.getElementById('selected-tables-list');
        
        if (this.selectedTables.length === 0) {
            container.innerHTML = '<p style="color: #666;">No tables selected yet</p>';
            return;
        }
        
        let html = '';
        this.selectedTables.forEach((table, index) => {
            html += `
                <div class="selected-item">
                    <span>📊 ${table.tableName}</span>
                    <button class="remove-btn" onclick="app.removeTable(${index})">Remove</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // Remove table
    removeTable(index) {
        const table = this.selectedTables[index];
        const checkbox = document.querySelector(`#table-list input[value="${table.tableName}"]`);
        if (checkbox) {
            checkbox.checked = false;
        }
        this.selectedTables.splice(index, 1);
        delete this.selectedColumns[table.tableName];
        this.updateSelectedTablesDisplay();
        this.updateColumnSelection();
        this.updateNextButton(3);
    }
    
    // Update column selection UI
    updateColumnSelection() {
        const container = document.getElementById('column-selection-container');
        
        if (this.selectedTables.length === 0) {
            container.innerHTML = '<p style="color: #666;">Select columns after choosing tables</p>';
            return;
        }
        
        let html = '';
        this.selectedTables.forEach((table, index) => {
            const columns = this.tablesColumns[table.tableName] || [];
            const selectedCols = this.selectedColumns[table.tableName] || [];
            
            html += `
                <div class="dynamic-form" style="margin-bottom: 15px;">
                    <h4>📊 ${table.tableName}</h4>
                    <div class="column-list">
                        ${columns.length > 0 ? columns.map(col => `
                            <label class="column-item">
                                <input type="checkbox" 
                                    value="${col.name}" 
                                    data-table="${table.tableName}"
                                    ${selectedCols.includes(col.name) ? 'checked' : ''}
                                    onchange="app.handleColumnSelect('${table.tableName}', this)">
                                <span>${col.name} <small style="color: #666;">(${col.type})</small></span>
                            </label>
                        `).join('') : '<p style="color: #666;">No columns loaded</p>'}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    // Handle column selection
    handleColumnSelect(tableName, checkbox) {
        if (!this.selectedColumns[tableName]) {
            this.selectedColumns[tableName] = [];
        }
        
        if (checkbox.checked) {
            if (!this.selectedColumns[tableName].includes(checkbox.value)) {
                this.selectedColumns[tableName].push(checkbox.value);
            }
        } else {
            this.selectedColumns[tableName] = this.selectedColumns[tableName].filter(c => c !== checkbox.value);
        }
    }
    
    // Initialize step 4
    initStep4() {
        this.renderJoinOptions();
        this.renderFilterOptions();
        this.updateConfigSummary();
    }
    
    // Render join options
    renderJoinOptions() {
        // Will be rendered dynamically when adding joins
    }
    
    // Add new join
    addJoin() {
        const container = document.getElementById('joins-container');
        
        // If first join, clear the "no joins" message
        if (this.joins.length === 0) {
            container.innerHTML = '';
        }
        
        const joinIndex = this.joins.length;
        const joinNum = joinIndex + 1;
        
        // Build table options
        let tableOptions = '';
        this.selectedTables.forEach((table, index) => {
            tableOptions += `<option value="${index}">${table.tableName}</option>`;
        });
        
        const html = `
            <div class="dynamic-form-row" id="join-${joinIndex}">
                <span>Join ${joinNum}: </span>
                <select class="form-control" data-join="tableIndex">
                    ${tableOptions}
                </select>
                <span>.</span>
                <input type="text" class="form-control" placeholder="column" data-join="sourceColumn" style="flex: 0.5;">
                <span>=</span>
                <select class="form-control" data-join="targetTable">
                    ${tableOptions}
                </select>
                <span>.</span>
                <input type="text" class="form-control" placeholder="column" data-join="targetColumn" style="flex: 0.5;">
                <select class="form-control" data-join="joinType">
                    <option value="INNER">INNER</option>
                    <option value="LEFT">LEFT</option>
                    <option value="RIGHT">RIGHT</option>
                    <option value="FULL">FULL</option>
                </select>
                <button class="btn btn-danger add-remove-btn" onclick="app.removeJoin(${joinIndex})">×</button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        
        // Initialize join data
        this.joins.push({
            tableIndex: 0,
            sourceColumn: '',
            targetTable: 0,
            targetColumn: '',
            joinType: 'INNER'
        });
    }
    
    // Remove join
    removeJoin(index) {
        this.joins.splice(index, 1);
        
        // Re-render joins
        const container = document.getElementById('joins-container');
        if (this.joins.length === 0) {
            container.innerHTML = '<p style="color: #666;">Add joins between tables</p>';
        } else {
            container.innerHTML = '';
            this.joins.forEach((join, idx) => this.addJoin());
        }
        
        this.updateConfigSummary();
    }
    
    // Render filter options
    renderFilterOptions() {
        // Will be rendered dynamically when adding filters
    }
    
    // Add new filter
    addFilter() {
        const container = document.getElementById('filters-container');
        
        // If first filter, clear the "no filters" message
        if (this.filters.length === 0) {
            container.innerHTML = '';
        }
        
        const filterIndex = this.filters.length;
        const filterNum = filterIndex + 1;
        
        // Build table options
        let tableOptions = '';
        this.selectedTables.forEach((table, index) => {
            tableOptions += `<option value="${index}">${table.tableName}</option>`;
        });
        
        const html = `
            <div class="dynamic-form-row" id="filter-${filterIndex}">
                <span>Filter ${filterNum}: </span>
                <select class="form-control" data-filter="tableIndex">
                    ${tableOptions}
                </select>
                <span>.</span>
                <input type="text" class="form-control" placeholder="column" data-filter="column" style="flex: 0.5;">
                <select class="form-control" data-filter="operator">
                    <option value="=">=</option>
                    <option value="!=">!=</option>
                    <option value=">">></option>
                    <option value=">=">>=</option>
                    <option value="<"><</option>
                    <option value="<="><=</option>
                    <option value="LIKE">LIKE</option>
                    <option value="IN">IN</option>
                    <option value="BETWEEN">BETWEEN</option>
                    <option value="IS NULL">IS NULL</option>
                    <option value="IS NOT NULL">IS NOT NULL</option>
                </select>
                <input type="text" class="form-control" placeholder="value" data-filter="value" style="flex: 0.5;">
                <select class="form-control" data-filter="valueType">
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                </select>
                <button class="btn btn-danger add-remove-btn" onclick="app.removeFilter(${filterIndex})">×</button>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
        
        // Initialize filter data
        this.filters.push({
            tableIndex: 0,
            column: '',
            operator: '=',
            value: '',
            valueType: 'string'
        });
    }
    
    // Remove filter
    removeFilter(index) {
        this.filters.splice(index, 1);
        
        // Re-render filters
        const container = document.getElementById('filters-container');
        if (this.filters.length === 0) {
            container.innerHTML = '<p style="color: #666;">Add filters to narrow down results</p>';
        } else {
            container.innerHTML = '';
            this.filters.forEach((filter, idx) => this.addFilter());
        }
        
        this.updateConfigSummary();
    }
    
    // Update configuration summary
    updateConfigSummary() {
        const container = document.getElementById('config-summary');
        
        let summary = [];
        
        if (this.joins.length > 0) {
            summary.push(`<strong>Joins:</strong> ${this.joins.length} join(s) configured`);
        }
        
        if (this.filters.length > 0) {
            summary.push(`<strong>Filters:</strong> ${this.filters.length} filter(s) configured`);
        }
        
        const limitValue = document.getElementById('limit-input').value;
        if (limitValue) {
            summary.push(`<strong>LIMIT:</strong> ${limitValue}`);
        }
        
        if (summary.length === 0) {
            container.innerHTML = '<p style="color: #666;">No configuration added yet</p>';
        } else {
            container.innerHTML = summary.join('<br>');
        }
    }
    
    // Generate query
    async generateQuery() {
        // Collect join data
        this.joins = [];
        document.querySelectorAll('#joins-container .dynamic-form-row[id^="join-"]').forEach(row => {
            this.joins.push({
                tableIndex: parseInt(row.querySelector('[data-join="tableIndex"]').value),
                sourceColumn: row.querySelector('[data-join="sourceColumn"]').value,
                targetTable: parseInt(row.querySelector('[data-join="targetTable"]').value),
                targetColumn: row.querySelector('[data-join="targetColumn"]').value,
                joinType: row.querySelector('[data-join="joinType"]').value
            });
        });
        
        // Collect filter data
        this.filters = [];
        document.querySelectorAll('#filters-container .dynamic-form-row[id^="filter-"]').forEach(row => {
            this.filters.push({
                tableIndex: parseInt(row.querySelector('[data-filter="tableIndex"]').value),
                column: row.querySelector('[data-filter="column"]').value,
                operator: row.querySelector('[data-filter="operator"]').value,
                value: row.querySelector('[data-filter="value"]').value,
                valueType: row.querySelector('[data-filter="valueType"]').value
            });
        });
        
        // Collect limit
        this.limit = document.getElementById('limit-input').value || null;
        
        // Prepare column selections
        const selectColumns = this.selectedTables.map(table => {
            return this.selectedColumns[table.tableName] || [];
        });
        
        // Build request payload
        const payload = {
            tables: this.selectedTables,
            joins: this.joins,
            filters: this.filters,
            limit: this.limit,
            country: this.country,
            selectColumns: selectColumns
        };
        
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('query-preview').textContent = data.data.query;
                this.goToStep(5);
            } else {
                this.showError('Failed to generate query: ' + data.error);
            }
        } catch (error) {
            this.showError('Error generating query: ' + error.message);
        }
    }
    
    // Copy query to clipboard
    async copyQuery() {
        const query = document.getElementById('query-preview').textContent;
        const btn = document.getElementById('copy-btn');
        
        try {
            await navigator.clipboard.writeText(query);
            btn.textContent = '✅ Copied!';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.textContent = '📋 Copy';
                btn.classList.remove('copied');
            }, 2000);
        } catch (error) {
            this.showError('Failed to copy: ' + error.message);
        }
    }
    
    // Start over
    startOver() {
        this.currentStep = 1;
        this.selectedCatalogs = [];
        this.selectedSchema = null;
        this.selectedTables = [];
        this.tablesColumns = {};
        this.selectedColumns = {};
        this.joins = [];
        this.filters = [];
        this.limit = null;
        this.country = null;
        
        // Reset UI
        document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
        document.getElementById('step-1').classList.add('active');
        
        document.querySelectorAll('.wizard-step').forEach((el, index) => {
            el.classList.remove('active', 'completed');
            if (index === 0) el.classList.add('active');
        });
        
        // Reset form elements
        document.querySelectorAll('#catalog-list input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.getElementById('catalog-search').value = '';
        document.getElementById('selected-country').value = '';
        document.getElementById('enable-country-pattern').checked = true;
        
        this.updateSelectedCatalogsDisplay();
        this.updateSelectedTablesDisplay();
        this.updateConfigSummary();
        document.getElementById('limit-input').value = '';
        
        this.joins = [];
        this.filters = [];
        document.getElementById('joins-container').innerHTML = '<p style="color: #666;">Add joins between tables</p>';
        document.getElementById('filters-container').innerHTML = '<p style="color: #666;">Add filters to narrow down results</p>';
        document.getElementById('column-selection-container').innerHTML = '<p style="color: #666;">Select columns after choosing tables</p>';
        
        this.loadCatalogs();
        
        this.updateNextButton(1);
        this.updateNextButton(2);
        this.updateNextButton(3);
    }
}

// Initialize application
const app = new TrinoQueryGenerator();
