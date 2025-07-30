// Global variables
let currentCSVData = null;
let csvHeaders = [];
let enrichedResults = [];
let isProcessing = false;
let startTime = null;

// Initialize extension
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await checkLinkedInSession();
    setupDropZone();
    setupEventListeners();
});

// Setup all event listeners
function setupEventListeners() {
    // Settings toggle
    document.querySelector('.settings-toggle').addEventListener('click', toggleSettings);

    // Settings buttons
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
    
    // Custom delay toggle
    document.getElementById('delaySpeed').addEventListener('change', toggleCustomDelay);

    // Session check
    document.getElementById('checkSessionBtn').addEventListener('click', checkLinkedInSession);

    // File input
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);

    // Configuration validation
    document.getElementById('validateConfigBtn').addEventListener('click', validateConfiguration);
    
    // Sales Navigator toggle
    document.getElementById('enableSalesNavigator').addEventListener('change', toggleSalesNavigator);
    
    // Pitch configuration validation
    document.getElementById('validatePitchConfigBtn').addEventListener('click', validatePitchConfiguration);

    // Processing
    document.getElementById('startProcessingBtn').addEventListener('click', startProcessing);

    // Results
    document.getElementById('downloadResultsBtn').addEventListener('click', downloadResults);
    document.getElementById('previewResultsBtn').addEventListener('click', showResults);

    // Drop zone click
    document.getElementById('dropZone').addEventListener('click', selectFile);
}

// Settings Management
function toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    panel.classList.toggle('show');
}

async function loadSettings() {
    try {
        const settings = await chrome.storage.local.get([
            'geminiApiKey', 
            'openaiApiKey', 
            'delaySpeed', 
            'customDelay', 
            'scrollSpeed'
        ]);
        
        if (settings.geminiApiKey) {
            document.getElementById('geminiApiKey').value = settings.geminiApiKey;
        }
        if (settings.openaiApiKey) {
            document.getElementById('openaiApiKey').value = settings.openaiApiKey;
        }
        if (settings.delaySpeed) {
            document.getElementById('delaySpeed').value = settings.delaySpeed;
            if (settings.delaySpeed === 'custom') {
                document.getElementById('customDelay').style.display = 'block';
                if (settings.customDelay) {
                    document.getElementById('customDelay').value = settings.customDelay;
                }
            }
        }
        if (settings.scrollSpeed) {
            document.getElementById('scrollSpeed').value = settings.scrollSpeed;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        const settings = {
            geminiApiKey: document.getElementById('geminiApiKey').value.trim(),
            openaiApiKey: document.getElementById('openaiApiKey').value.trim(),
            delaySpeed: document.getElementById('delaySpeed').value,
            customDelay: document.getElementById('customDelay').value,
            scrollSpeed: document.getElementById('scrollSpeed').value
        };

        if (!settings.geminiApiKey && !settings.openaiApiKey) {
            showStatus('Please provide at least one AI API key', 'error');
            return;
        }

        // Validate custom delay if selected
        if (settings.delaySpeed === 'custom') {
            const delay = parseInt(settings.customDelay);
            if (!delay || delay < 10 || delay > 300) {
                showStatus('Custom delay must be between 10 and 300 seconds', 'error');
                return;
            }
        }

        await chrome.storage.local.set(settings);
        showStatus('Settings saved successfully!', 'success');
        setTimeout(() => toggleSettings(), 1500);
    } catch (error) {
        console.error('Error saving settings:', error);
        showStatus('Error saving settings', 'error');
    }
}

function toggleCustomDelay() {
    const delaySpeed = document.getElementById('delaySpeed').value;
    const customDelayInput = document.getElementById('customDelay');
    
    if (delaySpeed === 'custom') {
        customDelayInput.style.display = 'block';
    } else {
        customDelayInput.style.display = 'none';
    }
}

// LinkedIn Session Management
async function checkLinkedInSession() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_LINKEDIN_SESSION'
        });

        const statusEl = document.getElementById('sessionStatus');

        if (response.success) {
            statusEl.innerHTML = '✅ LinkedIn session active';
            statusEl.className = 'status-indicator status-success';
            updateStepStatus(1, 'completed');
            updateStepStatus(2, 'active');
        } else {
            statusEl.innerHTML = '❌ ' + response.message;
            statusEl.className = 'status-indicator status-error';
            updateStepStatus(1, 'active');
        }
    } catch (error) {
        console.error('Error checking LinkedIn session:', error);
        const statusEl = document.getElementById('sessionStatus');
        statusEl.innerHTML = '❌ Error checking session';
        statusEl.className = 'status-indicator status-error';
    }
}

// File Upload Management
function setupDropZone() {
    const dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'text/csv') {
            handleFile(files[0]);
        } else {
            showStatus('Please drop a valid CSV file', 'error');
        }
    });
}

function selectFile() {
    document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    try {
        const text = await file.text();
        parseCSV(text, file.name);

        const dropZone = document.getElementById('dropZone');
        const dropZoneContent = document.getElementById('dropZoneContent');

        dropZone.classList.add('has-file');
        dropZoneContent.innerHTML = `✅ ${file.name} loaded<br><small>Click to change file</small>`;

        updateStepStatus(2, 'completed');
        updateStepStatus(3, 'active');

    } catch (error) {
        console.error('Error reading file:', error);
        showStatus('Error reading CSV file', 'error');
    }
}

function parseCSV(text, filename) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
        showStatus('CSV file must have at least a header and one data row', 'error');
        return;
    }

    // Improved CSV parsing function that handles quotes and commas properly
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        // Add the last field
        result.push(current.trim());
        return result;
    }

    // Parse headers
    csvHeaders = parseCSVLine(lines[0]);
    console.log('Parsed headers:', csvHeaders);

    // Parse data rows
    currentCSVData = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) { // Skip empty lines
            const values = parseCSVLine(lines[i]);
            const row = {};
            csvHeaders.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            currentCSVData.push(row);
        }
    }

    showCSVPreview();
    populateColumnSelectors();

    console.log(`Parsed ${currentCSVData.length} rows with headers:`, csvHeaders);
}

function showCSVPreview() {
    const preview = document.getElementById('csvPreview');
    let html = `<h4>CSV Preview (${currentCSVData.length} rows)</h4><table><thead><tr>`;

    csvHeaders.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Show first 3 rows
    currentCSVData.slice(0, 3).forEach(row => {
        html += '<tr>';
        csvHeaders.forEach(header => {
            html += `<td>${row[header] || ''}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    preview.innerHTML = html;
    preview.classList.remove('hidden');
}

function populateColumnSelectors() {
    const selectors = ['nameColumn', 'linkedinColumn', 'companyColumn', 'salesNavigatorColumn'];

    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        if (!select) return; // Skip if element doesn't exist
        
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        csvHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            select.appendChild(option);
        });

        // Auto-suggest based on column names
        autoSuggestColumn(select, selectorId);
    });

    document.getElementById('columnMapping').classList.remove('hidden');
}

function autoSuggestColumn(select, selectorId) {
    const suggestions = {
        nameColumn: [
            'fullname', 'full_name', 'name', 'firstname', 'first_name',
            'contact_name', 'lead_name', 'person_name', 'client_name'
        ],
        linkedinColumn: [
            'linkedin', 'profile', 'linkedin_url', 'linkedin_profile',
            'profile_url', 'linkedinprofileurl', 'profileurl', 'li_url'
        ],
        companyColumn: [
            'company', 'organization', 'company_name', 'companyname',
            'org', 'employer', 'business', 'firm'
        ],
        salesNavigatorColumn: [
            'sales_navigator', 'salesnavigator', 'sales_nav', 'salesnav',
            'navigator_url', 'sales_linkedin', 'sn_url', 'sales_profile'
        ]
    };

    const targetSuggestions = suggestions[selectorId] || [];

    // First try exact matches
    for (const header of csvHeaders) {
        const lowerHeader = header.toLowerCase().replace(/[^a-z]/g, '');
        for (const suggestion of targetSuggestions) {
            if (lowerHeader === suggestion.replace(/[^a-z]/g, '')) {
                select.value = header;
                return;
            }
        }
    }

    // Then try partial matches
    for (const header of csvHeaders) {
        const lowerHeader = header.toLowerCase();
        for (const suggestion of targetSuggestions) {
            if (lowerHeader.includes(suggestion) || suggestion.includes(lowerHeader.replace(/[^a-z]/g, ''))) {
                select.value = header;
                return;
            }
        }
    }

    // For LinkedIn column, check data content
    if (selectorId === 'linkedinColumn' && !select.value && currentCSVData.length > 0) {
        for (const header of csvHeaders) {
            const hasLinkedInData = currentCSVData.slice(0, 5).some(row => {
                const value = (row[header] || '').toLowerCase();
                return value.includes('linkedin.com/in/') || value.includes('linkedin.com/pub/');
            });
            if (hasLinkedInData) {
                select.value = header;
                return;
            }
        }
    }
}

function validateConfiguration() {
    const required = ['nameColumn', 'linkedinColumn'];
    let isValid = true;

    required.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            field.style.borderColor = '#dc2626';
            isValid = false;
        } else {
            field.style.borderColor = '#10b981';
        }
    });

    if (isValid) {
        updateStepStatus(3, 'completed');
        updateStepStatus(4, 'active');
        document.getElementById('pitchCustomization').classList.remove('hidden');
        showStatus('Column configuration validated successfully', 'success');
    } else {
        showStatus('Please fill in all required fields', 'error');
    }
}

// Sales Navigator toggle function
function toggleSalesNavigator() {
    const checkbox = document.getElementById('enableSalesNavigator');
    const options = document.getElementById('salesNavigatorOptions');
    
    if (checkbox.checked) {
        options.classList.remove('hidden');
    } else {
        options.classList.add('hidden');
        // Clear the sales navigator column selection
        document.getElementById('salesNavigatorColumn').value = '';
    }
}

// Pitch configuration validation
function validatePitchConfiguration() {
    const required = ['serviceType', 'industryFocus'];
    let isValid = true;

    required.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            field.style.borderColor = '#dc2626';
            isValid = false;
        } else {
            field.style.borderColor = '#10b981';
        }
    });

    if (isValid) {
        updateStepStatus(4, 'completed');
        updateStepStatus(5, 'active');
        document.getElementById('startProcessingBtn').disabled = false;
        showStatus('Pitch configuration validated successfully', 'success');
    } else {
        showStatus('Please fill in all required fields', 'error');
    }
}

// Lead Processing
async function startProcessing() {
    if (isProcessing) return;

    try {
        isProcessing = true;
        document.getElementById('startProcessingBtn').disabled = true;
        document.getElementById('progressSection').classList.remove('hidden');

        const config = {
            nameColumn: document.getElementById('nameColumn').value,
            linkedinColumn: document.getElementById('linkedinColumn').value,
            companyColumn: document.getElementById('companyColumn').value,
            salesNavigatorColumn: document.getElementById('salesNavigatorColumn').value,
            enableSalesNavigator: document.getElementById('enableSalesNavigator').checked,
            serviceType: document.getElementById('serviceType').value.trim(),
            industryFocus: document.getElementById('industryFocus').value.trim(),
            customPrompt: document.getElementById('customPrompt').value.trim()
        };

        enrichedResults = [];
        startTime = Date.now();

        document.getElementById('totalCount').textContent = currentCSVData.length;
        updateProgress(0, currentCSVData.length, 'Starting processing...');

        for (let i = 0; i < currentCSVData.length; i++) {
            const lead = currentCSVData[i];
            const leadName = lead[config.nameColumn] || `Lead ${i + 1}`;
            
            // Determine which profile URL to use
            let profileUrl = lead[config.linkedinColumn];
            
            // If Sales Navigator is enabled and we have a Sales Navigator column, prefer that
            if (config.enableSalesNavigator && config.salesNavigatorColumn && lead[config.salesNavigatorColumn]) {
                profileUrl = lead[config.salesNavigatorColumn];
            }

            updateProgress(i + 1, currentCSVData.length, `Processing ${leadName}...`);

            try {
                // Add delay between requests (except first)
                if (i > 0) {
                    const delay = await getProcessingDelay();
                    updateProgress(i + 1, currentCSVData.length, `Waiting ${Math.round(delay / 1000)} seconds before processing ${leadName}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Scrape profile
                updateProgress(i + 1, currentCSVData.length, `Scraping profile for ${leadName}...`);
                const profileData = await scrapeProfile(profileUrl);

                // Generate AI pitches
                updateProgress(i + 1, currentCSVData.length, `Generating AI pitches for ${leadName}...`);
                const pitches = await generatePitches(leadName, profileData, config.serviceType, config.industryFocus, config.customPrompt);

                // Store results
                const enrichedLead = {
                    ...lead,
                    pitch_1: pitches[0] || '',
                    pitch_2: pitches[1] || '',
                    pitch_3: pitches[2] || '',
                    enrichment_status: 'completed',
                    enriched_date: new Date().toISOString(),
                    profile_data_length: profileData.length
                };

                enrichedResults.push(enrichedLead);
                console.log(`Successfully processed ${leadName}`);

            } catch (error) {
                console.error(`Error processing ${leadName}:`, error);

                const enrichedLead = {
                    ...lead,
                    pitch_1: '',
                    pitch_2: '',
                    pitch_3: '',
                    enrichment_status: 'failed',
                    error_message: error.message,
                    failed_date: new Date().toISOString()
                };

                enrichedResults.push(enrichedLead);
            }
        }

        // Processing complete
        updateStepStatus(5, 'completed');
        document.getElementById('completionSection').classList.remove('hidden');
        showStatus('Lead enrichment completed successfully!', 'success');

    } catch (error) {
        console.error('Fatal processing error:', error);
        showStatus('Processing failed: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

async function scrapeProfile(profileUrl) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'SCRAPE_PROFILE',
            profileUrl: profileUrl
        }, (response) => {
            if (response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response.message));
            }
        });
    });
}

async function generatePitches(personName, profileData, serviceType, industryFocus, customPrompt) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'GENERATE_AI_PITCHES',
            personName: personName,
            profileData: profileData,
            serviceType: serviceType,
            industryFocus: industryFocus,
            customPrompt: customPrompt
        }, (response) => {
            if (response.success) {
                resolve(response.pitches);
            } else {
                reject(new Error(response.message));
            }
        });
    });
}

function updateProgress(current, total, status) {
    const percentage = Math.round((current / total) * 100);

    document.getElementById('currentStatus').textContent = status;
    document.getElementById('processedCount').textContent = current;
    document.getElementById('progressPercentage').textContent = percentage + '%';
    document.getElementById('progressFill').style.width = percentage + '%';

    // Calculate estimated time
    if (startTime && current > 0) {
        const elapsed = Date.now() - startTime;
        const rate = current / elapsed;
        const remaining = total - current;
        const estimatedMs = remaining / rate;
        const estimatedMin = Math.round(estimatedMs / 60000);
        document.getElementById('estimatedTime').textContent = estimatedMin + 'm';
    }
}

// Results Management
function downloadResults() {
    if (!enrichedResults || enrichedResults.length === 0) {
        showStatus('No results to download', 'error');
        return;
    }

    const csvContent = convertToCSV(enrichedResults);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `enriched_leads_${timestamp}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus('Results downloaded successfully!', 'success');
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
        const values = headers.map(header => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes if contains comma/quote/newline
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                return '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
}

function showResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('resultsContainer');

    if (!enrichedResults || enrichedResults.length === 0) {
        resultsContainer.innerHTML = '<p>No results to display</p>';
        resultsSection.classList.remove('hidden');
        return;
    }

    // Create results table
    let html = '<div style="max-height: 400px; overflow: auto;"><table class="results-table"><thead><tr>';

    const headers = Object.keys(enrichedResults[0]);
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    enrichedResults.forEach(row => {
        html += '<tr>';
        headers.forEach(header => {
            let value = row[header] || '';
            if (header.startsWith('pitch_') && value) {
                value = `<div class="pitch-cell">${value}</div>`;
            }
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    resultsContainer.innerHTML = html;
    resultsSection.classList.remove('hidden');
}

// Utility Functions
function updateStepStatus(stepNumber, status) {
    const step = document.getElementById(`step${stepNumber}`);
    step.className = `step ${status}`;
}

async function getProcessingDelay() {
    try {
        const settings = await chrome.storage.local.get(['delaySpeed', 'customDelay']);
        const delaySpeed = settings.delaySpeed || 'medium';
        
        switch (delaySpeed) {
            case 'fast':
                return Math.floor(Math.random() * 30000) + 30000; // 30-60 seconds
            case 'slow':
                return Math.floor(Math.random() * 60000) + 120000; // 2-3 minutes
            case 'custom':
                const customDelay = parseInt(settings.customDelay) || 90;
                return customDelay * 1000; // Convert to milliseconds
            case 'medium':
            default:
                return Math.floor(Math.random() * 30000) + 60000; // 1-1.5 minutes
        }
    } catch (error) {
        console.error('Error getting processing delay:', error);
        return 90000; // Default to 1.5 minutes
    }
}

function showStatus(message, type) {
    // Create or update status message
    let statusEl = document.getElementById('globalStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'globalStatus';
        statusEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 500;
            z-index: 1000;
            max-width: 300px;
        `;
        document.body.appendChild(statusEl);
    }

    statusEl.textContent = message;
    statusEl.className = `status-indicator status-${type}`;

    // Auto-hide after 3 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            if (statusEl.parentNode) {
                statusEl.parentNode.removeChild(statusEl);
            }
        }, 3000);
    }
}