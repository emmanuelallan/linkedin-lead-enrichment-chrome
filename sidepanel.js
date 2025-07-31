// Global variables
let currentCSVData = null;
let csvHeaders = [];
let enrichedResults = [];
let isProcessing = false;
let isPaused = false;
let isStopped = false;
let startTime = null;
let currentProcessingIndex = 0;
let validLeadsCount = 0; // Track valid leads after filtering

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
    
    // Processing controls
    document.getElementById('pauseProcessingBtn').addEventListener('click', pauseProcessing);
    document.getElementById('resumeProcessingBtn').addEventListener('click', resumeProcessing);
    document.getElementById('stopProcessingBtn').addEventListener('click', stopProcessing);

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
            'scrollSpeed',
            'pageTimeout',
            'pausedProcessingState' // Load paused state if exists
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
        if (settings.pageTimeout) {
            document.getElementById('pageTimeout').value = settings.pageTimeout;
        }
        
        // Restore paused state if exists
        if (settings.pausedProcessingState) {
            await restorePausedState(settings.pausedProcessingState);
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
            scrollSpeed: document.getElementById('scrollSpeed').value,
            pageTimeout: document.getElementById('pageTimeout').value
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

// Enhanced CSV parsing with proper row filtering
function parseCSV(text, filename) {
    const lines = text.trim().split('\n').filter(line => line.trim() !== ''); // Remove empty lines immediately
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

    // Parse data rows with strict filtering
    currentCSVData = [];
    let skippedEmptyRows = 0;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            skippedEmptyRows++;
            continue; // Skip completely empty lines
        }

        const values = parseCSVLine(line);
        const row = {};
        csvHeaders.forEach((header, index) => {
            row[header] = values[index] ? values[index].trim() : '';
        });

        // Enhanced row validation - check if row has meaningful data
        const hasNonEmptyValues = Object.values(row).some(value => 
            value !== null && 
            value !== undefined && 
            String(value).trim() !== '' && 
            String(value).trim() !== 'null' && 
            String(value).trim() !== 'undefined'
        );

        if (hasNonEmptyValues) {
            currentCSVData.push(row);
        } else {
            skippedEmptyRows++;
        }
    }

    console.log(`Parsed ${currentCSVData.length} valid rows (skipped ${skippedEmptyRows} empty rows) with headers:`, csvHeaders);
    showCSVPreview();
    populateColumnSelectors();
}

function showCSVPreview() {
    const preview = document.getElementById('csvPreview');
    let html = `<h4>CSV Preview (${currentCSVData.length} valid rows found)</h4><table><thead><tr>`;

    csvHeaders.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Show first 3 valid rows
    currentCSVData.slice(0, 3).forEach(row => {
        html += '<tr>';
        csvHeaders.forEach(header => {
            const value = row[header] || '';
            html += `<td>${value}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    preview.innerHTML = html;
    preview.classList.remove('hidden');
}

// Enhanced column detection with data content analysis
function populateColumnSelectors() {
    const selectors = ['nameColumn', 'linkedinColumn', 'companyColumn', 'salesNavigatorColumn'];

    selectors.forEach(selectorId => {
        const select = document.getElementById(selectorId);
        if (!select) return;
        
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        csvHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            select.appendChild(option);
        });

        // Enhanced auto-suggestion with data content analysis
        autoSuggestColumnEnhanced(select, selectorId);
    });

    document.getElementById('columnMapping').classList.remove('hidden');
}

function autoSuggestColumnEnhanced(select, selectorId) {
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
    let bestMatch = null;
    let bestScore = 0;

    // Analyze each column
    csvHeaders.forEach(header => {
        let score = 0;
        const lowerHeader = header.toLowerCase().replace(/[^a-z]/g, '');

        // Title-based scoring
        for (const suggestion of targetSuggestions) {
            const suggestionClean = suggestion.replace(/[^a-z]/g, '');
            if (lowerHeader === suggestionClean) {
                score += 100; // Exact match
            } else if (lowerHeader.includes(suggestionClean) || suggestionClean.includes(lowerHeader)) {
                score += 50; // Partial match
            }
        }

        // Content-based scoring (analyze first 3 rows)
        const sampleRows = currentCSVData.slice(0, 3);
        const contentScore = analyzeColumnContent(header, sampleRows, selectorId);
        score += contentScore;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = header;
        }
    });

    if (bestMatch && bestScore > 30) { // Minimum threshold
        select.value = bestMatch;
        console.log(`Auto-selected ${bestMatch} for ${selectorId} with score ${bestScore}`);
    }
}

function analyzeColumnContent(header, sampleRows, selectorId) {
    let score = 0;
    
    sampleRows.forEach(row => {
        const value = (row[header] || '').toLowerCase().trim();
        if (!value) return;

        switch (selectorId) {
            case 'linkedinColumn':
                if (value.includes('linkedin.com/in/') || value.includes('linkedin.com/pub/')) {
                    score += 200; // Strong indicator
                } else if (value.includes('linkedin') && value.includes('/')) {
                    score += 100; // Moderate indicator
                } else if (value.match(/^[a-zA-Z0-9\-]+$/) && value.length > 3 && value.length < 50) {
                    score += 50; // Possible username
                }
                break;
                
            case 'salesNavigatorColumn':
                if (value.includes('sales.linkedin.com') || value.includes('linkedin.com/sales/')) {
                    score += 200; // Strong indicator
                } else if (value.includes('sales') && value.includes('linkedin')) {
                    score += 100; // Moderate indicator
                }
                break;
                
            case 'nameColumn':
                // Check for name patterns
                const words = value.split(' ').filter(w => w.length > 0);
                if (words.length >= 2 && words.length <= 4) {
                    const hasCapitals = words.every(word => /^[A-Z]/.test(word));
                    if (hasCapitals) score += 100; // Likely a name
                    else score += 50; // Possible name
                }
                // Avoid columns that look like emails or URLs
                if (value.includes('@') || value.includes('http')) {
                    score -= 100;
                }
                break;
                
            case 'companyColumn':
                // Check for company patterns
                if (value.includes('inc') || value.includes('ltd') || value.includes('corp') || 
                    value.includes('llc') || value.includes('company') || value.includes('co.')) {
                    score += 100; // Strong company indicator
                } else if (value.length > 2 && value.length < 100 && 
                          !value.includes('@') && !value.includes('http')) {
                    score += 30; // Possible company name
                }
                break;
        }
    });

    return score;
}

// Enhanced validation with lead filtering
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
        // Filter and validate leads
        const validationResult = validateAndFilterLeads();
        if (validationResult.validCount === 0) {
            showStatus('No valid leads found with required data', 'error');
            return;
        }

        // Update the valid leads count
        validLeadsCount = validationResult.validCount;

        // Show validation summary
        const summary = `Found ${validationResult.validCount} valid leads out of ${currentCSVData.length} rows`;
        if (validationResult.skippedCount > 0) {
            showStatus(summary + ` (${validationResult.skippedCount} will be skipped due to missing data)`, 'warning');
        } else {
            showStatus(summary, 'success');
        }

        updateStepStatus(3, 'completed');
        updateStepStatus(4, 'active');
        document.getElementById('pitchCustomization').classList.remove('hidden');
    } else {
        showStatus('Please fill in all required fields', 'error');
    }
}

function validateAndFilterLeads() {
    const nameColumn = document.getElementById('nameColumn').value;
    const linkedinColumn = document.getElementById('linkedinColumn').value;
    const salesNavigatorColumn = document.getElementById('salesNavigatorColumn').value;
    const enableSalesNavigator = document.getElementById('enableSalesNavigator').checked;

    let validCount = 0;
    let skippedCount = 0;

    currentCSVData.forEach(row => {
        const name = (row[nameColumn] || '').trim();
        let profileUrl = (row[linkedinColumn] || '').trim();

        // Check for Sales Navigator URL if enabled
        if (enableSalesNavigator && salesNavigatorColumn) {
            const salesUrl = (row[salesNavigatorColumn] || '').trim();
            if (salesUrl) {
                profileUrl = salesUrl; // Prefer Sales Navigator URL
            }
        }

        // Validate required fields
        const hasValidName = name && name.length > 1;
        const hasValidProfile = profileUrl && (
            profileUrl.includes('linkedin.com') || 
            profileUrl.match(/^[a-zA-Z0-9\-]+$/) || // Username format
            profileUrl.length > 3
        );

        if (hasValidName && hasValidProfile) {
            validCount++;
        } else {
            skippedCount++;
        }
    });

    return { validCount, skippedCount };
}

// Sales Navigator toggle function
function toggleSalesNavigator() {
    const checkbox = document.getElementById('enableSalesNavigator');
    const options = document.getElementById('salesNavigatorOptions');
    
    if (checkbox.checked) {
        options.classList.remove('hidden');
    } else {
        options.classList.add('hidden');
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

// Enhanced pause functionality with state persistence
async function pauseProcessing() {
    isPaused = true;
    document.getElementById('pauseProcessingBtn').classList.add('hidden');
    document.getElementById('resumeProcessingBtn').classList.remove('hidden');

    // Save current processing state
    const pausedState = {
        currentCSVData,
        csvHeaders,
        enrichedResults,
        currentProcessingIndex,
        validLeadsCount,
        startTime,
        config: {
            nameColumn: document.getElementById('nameColumn').value,
            linkedinColumn: document.getElementById('linkedinColumn').value,
            companyColumn: document.getElementById('companyColumn').value,
            salesNavigatorColumn: document.getElementById('salesNavigatorColumn').value,
            enableSalesNavigator: document.getElementById('enableSalesNavigator').checked,
            serviceType: document.getElementById('serviceType').value.trim(),
            industryFocus: document.getElementById('industryFocus').value.trim(),
            customPrompt: document.getElementById('customPrompt').value.trim()
        }
    };

    await chrome.storage.local.set({ pausedProcessingState: pausedState });
    updateProgress(currentProcessingIndex, validLeadsCount, 'Processing paused - progress saved');
    showStatus('Processing paused. Progress saved. Click Resume to continue or download current results.', 'warning');

    // Show download option during pause
    if (enrichedResults.length > 0) {
        document.getElementById('completionSection').classList.remove('hidden');
    }
}

async function resumeProcessing() {
    isPaused = false;
    document.getElementById('pauseProcessingBtn').classList.remove('hidden');
    document.getElementById('resumeProcessingBtn').classList.add('hidden');
    document.getElementById('completionSection').classList.add('hidden');
    updateProgress(currentProcessingIndex, validLeadsCount, 'Processing resumed...');
    showStatus('Processing resumed from where it left off', 'success');
}

async function stopProcessing() {
    isStopped = true;
    isProcessing = false;
    
    // Clear paused state since we're stopping completely
    await chrome.storage.local.remove(['pausedProcessingState']);
    
    // Hide processing controls and show completion section
    document.getElementById('activeProcessingControls').classList.add('hidden');
    document.getElementById('completionSection').classList.remove('hidden');
    
    // Update status
    updateStepStatus(5, 'completed');
    updateProgress(currentProcessingIndex, validLeadsCount, `Processing stopped. ${enrichedResults.length} leads processed.`);
    showStatus(`Processing stopped. ${enrichedResults.length} leads have been processed and are ready for download.`, 'warning');
}

// Restore paused state on page load
async function restorePausedState(pausedState) {
    try {
        currentCSVData = pausedState.currentCSVData;
        csvHeaders = pausedState.csvHeaders;
        enrichedResults = pausedState.enrichedResults;
        currentProcessingIndex = pausedState.currentProcessingIndex;
        validLeadsCount = pausedState.validLeadsCount;
        startTime = pausedState.startTime;

        // Restore form values
        const config = pausedState.config;
        Object.keys(config).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = config[key];
                } else {
                    element.value = config[key];
                }
            }
        });

        // Restore UI state
        showCSVPreview();
        populateColumnSelectors();
        updateStepStatus(1, 'completed');
        updateStepStatus(2, 'completed');
        updateStepStatus(3, 'completed');
        updateStepStatus(4, 'completed');
        updateStepStatus(5, 'active');
        
        document.getElementById('columnMapping').classList.remove('hidden');
        document.getElementById('pitchCustomization').classList.remove('hidden');
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('activeProcessingControls').classList.remove('hidden');
        document.getElementById('pauseProcessingBtn').classList.add('hidden');
        document.getElementById('resumeProcessingBtn').classList.remove('hidden');
        
        if (enrichedResults.length > 0) {
            document.getElementById('completionSection').classList.remove('hidden');
        }

        updateProgress(currentProcessingIndex, validLeadsCount, `Restored paused session - ${enrichedResults.length} leads already processed`);
        showStatus('Previous paused session restored. Click Resume to continue processing.', 'warning');
        isPaused = true;
    } catch (error) {
        console.error('Error restoring paused state:', error);
        await chrome.storage.local.remove(['pausedProcessingState']);
    }
}

// Enhanced lead processing with better filtering and 404 handling
async function startProcessing() {
    if (isProcessing) return;

    try {
        isProcessing = true;
        isPaused = false;
        isStopped = false;
        
        // Only reset if starting fresh (not resuming)
        if (currentProcessingIndex === 0) {
            enrichedResults = [];
            startTime = Date.now();
        }

        document.getElementById('startProcessingBtn').disabled = true;
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('activeProcessingControls').classList.remove('hidden');
        document.getElementById('completionSection').classList.add('hidden');

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

        // Filter valid leads before processing
        const validLeads = filterValidLeads(config);
        validLeadsCount = validLeads.length;

        document.getElementById('totalCount').textContent = validLeadsCount;
        updateProgress(currentProcessingIndex, validLeadsCount, 'Starting processing...');

        for (let i = currentProcessingIndex; i < validLeads.length; i++) {
            currentProcessingIndex = i;
            
            // Check if processing should stop
            if (isStopped) {
                console.log('Processing stopped by user');
                break;
            }
            
            // Handle pause functionality
            while (isPaused && !isStopped) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            if (isStopped) {
                console.log('Processing stopped by user during pause');
                break;
            }
            
            const lead = validLeads[i];
            const leadName = lead[config.nameColumn] || `Lead ${i + 1}`;
            let profileUrl = lead[config.linkedinColumn];

            // Use Sales Navigator URL if available and enabled
            if (config.enableSalesNavigator && config.salesNavigatorColumn && lead[config.salesNavigatorColumn]) {
                profileUrl = lead[config.salesNavigatorColumn];
            }

            updateProgress(i + 1, validLeadsCount, `Processing ${leadName}...`);

            try {
                // Add delay between requests (except first)
                if (i > 0) {
                    const delay = await getProcessingDelay();
                    updateProgress(i + 1, validLeadsCount, `Waiting ${Math.round(delay / 1000)} seconds before processing ${leadName}...`);
                    
                    // Handle pause during delay
                    for (let delayCount = 0; delayCount < delay / 1000; delayCount++) {
                        if (isStopped || isPaused) break;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    
                    if (isStopped) break;
                }

                // Scrape profile with enhanced 404 handling
                updateProgress(i + 1, validLeadsCount, `Scraping profile for ${leadName}...`);
                const profileResult = await scrapeProfileWithEnhanced404Handling(profileUrl, leadName);

                if (profileResult.is404 || profileResult.isError) {
                    // Handle 404 or error pages
                    const enrichedLead = {
                        ...lead,
                        pitch_1: '',
                        pitch_2: '',
                        pitch_3: '',
                        enrichment_status: profileResult.is404 ? '404_not_found' : 'error',
                        error_message: profileResult.message,
                        failed_date: new Date().toISOString()
                    };

                    enrichedResults.push(enrichedLead);
                    console.log(`Skipped ${leadName} - ${profileResult.message}`);
                    continue;
                }

                // Generate AI pitches
                updateProgress(i + 1, validLeadsCount, `Generating AI pitches for ${leadName}...`);
                const pitches = await generatePitches(leadName, profileResult.data, config.serviceType, config.industryFocus, config.customPrompt);

                // Store results
                const enrichedLead = {
                    ...lead,
                    pitch_1: pitches[0] || '',
                    pitch_2: pitches[1] || '',
                    pitch_3: pitches[2] || '',
                    enrichment_status: 'completed',
                    enriched_date: new Date().toISOString(),
                    profile_data_length: profileResult.data.length
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

        // Clear paused state on completion
        await chrome.storage.local.remove(['pausedProcessingState']);

        // Processing complete (only if not stopped by user)
        if (!isStopped) {
            updateStepStatus(5, 'completed');
            document.getElementById('activeProcessingControls').classList.add('hidden');
            document.getElementById('completionSection').classList.remove('hidden');
            showStatus('Lead enrichment completed successfully!', 'success');
        }

    } catch (error) {
        console.error('Fatal processing error:', error);
        showStatus('Processing failed: ' + error.message, 'error');
    } finally {
        isProcessing = false;
    }
}

// Enhanced lead filtering to skip invalid entries
function filterValidLeads(config) {
    const validLeads = [];
    
    currentCSVData.forEach((lead, index) => {
        const name = (lead[config.nameColumn] || '').trim();
        let profileUrl = (lead[config.linkedinColumn] || '').trim();

        // Check for Sales Navigator URL if enabled
        if (config.enableSalesNavigator && config.salesNavigatorColumn) {
            const salesUrl = (lead[config.salesNavigatorColumn] || '').trim();
            if (salesUrl) {
                profileUrl = salesUrl; // Prefer Sales Navigator URL
            }
        }

        // Strict validation for required fields
        const hasValidName = name && name.length > 1 && name !== 'null' && name !== 'undefined';
        const hasValidProfile = profileUrl && 
            profileUrl.length > 3 && 
            profileUrl !== 'null' && 
            profileUrl !== 'undefined' && 
            (profileUrl.includes('linkedin.com') || 
             profileUrl.match(/^[a-zA-Z0-9\-._]+$/) // Username format with dots and underscores
            );

        if (hasValidName && hasValidProfile) {
            validLeads.push({
                ...lead,
                _originalIndex: index, // Track original position
                _processedProfileUrl: profileUrl // Store the URL we'll actually use
            });
        } else {
            console.log(`Skipping lead at row ${index + 2}: name="${name}", profile="${profileUrl}" - missing required data`);
        }
    });

    console.log(`Filtered ${validLeads.length} valid leads from ${currentCSVData.length} total rows`);
    return validLeads;
}

// Enhanced profile scraping with better 404 detection and timeout handling
async function scrapeProfileWithEnhanced404Handling(profileUrl, leadName) {
    try {
        // Get timeout setting
        const settings = await chrome.storage.local.get(['pageTimeout']);
        const timeoutSeconds = parseInt(settings.pageTimeout) || 10;
        const timeoutMs = timeoutSeconds * 1000;

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`TIMEOUT_404: Profile page took longer than ${timeoutSeconds} seconds - likely 404 or blocked`));
            }, timeoutMs);
        });

        // Enhanced scraping promise
        const scrapePromise = new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'SCRAPE_PROFILE',
                profileUrl: profileUrl
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`Extension error: ${chrome.runtime.lastError.message}`));
                    return;
                }

                if (!response) {
                    reject(new Error('No response from background script'));
                    return;
                }

                if (response.is404) {
                    resolve({
                        is404: true,
                        message: `Profile not found (404) - ${response.message}`,
                        data: ''
                    });
                } else if (response.success) {
                    // Validate that we got meaningful data
                    const dataLength = response.data ? response.data.length : 0;
                    if (dataLength < 50) {
                        resolve({
                            is404: true,
                            message: `Profile data too short (${dataLength} chars) - likely 404 or private profile`,
                            data: response.data || ''
                        });
                    } else {
                        resolve({
                            is404: false,
                            isError: false,
                            data: response.data,
                            message: 'Profile scraped successfully'
                        });
                    }
                } else {
                    // Check if error message indicates 404
                    const errorMessage = response.message || 'Unknown error';
                    const is404Error = errorMessage.toLowerCase().includes('404') || 
                                      errorMessage.toLowerCase().includes('not found') ||
                                      errorMessage.toLowerCase().includes('page not found') ||
                                      errorMessage.toLowerCase().includes('profile unavailable');

                    resolve({
                        is404: is404Error,
                        isError: !is404Error,
                        message: errorMessage,
                        data: ''
                    });
                }
            });
        });

        // Race between scraping and timeout
        const result = await Promise.race([scrapePromise, timeoutPromise]);
        return result;

    } catch (error) {
        // Handle different types of errors
        if (error.message.includes('TIMEOUT_404')) {
            console.log(`Timeout detected for ${leadName} - treating as 404`);
            return {
                is404: true,
                message: `Timeout after ${error.message.split(' ')[6]} seconds - likely 404 or blocked profile`,
                data: ''
            };
        } else {
            console.error(`Error scraping ${leadName}:`, error);
            return {
                isError: true,
                message: `Scraping error: ${error.message}`,
                data: ''
            };
        }
    }
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
            if (chrome.runtime.lastError) {
                reject(new Error(`Extension error: ${chrome.runtime.lastError.message}`));
                return;
            }

            if (response && response.success) {
                resolve(response.pitches || ['', '', '']);
            } else {
                reject(new Error(response ? response.message : 'No response from AI service'));
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
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `enriched_leads_${timestamp}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showStatus(`Results downloaded successfully! ${enrichedResults.length} leads exported.`, 'success');
}

function convertToCSV(data) {
    if (!data || data.length === 0) return '';

    // Get all unique headers from all rows (in case some rows have different fields)
    const allHeaders = new Set();
    data.forEach(row => {
        Object.keys(row).forEach(key => {
            if (!key.startsWith('_')) { // Skip internal fields like _originalIndex
                allHeaders.add(key);
            }
        });
    });

    const headers = Array.from(allHeaders);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
        const values = headers.map(header => {
            let value = row[header];
            if (value === null || value === undefined) {
                value = '';
            } else {
                value = String(value);
            }

            // Escape quotes and wrap in quotes if contains comma/quote/newline
            if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
                value = '"' + value.replace(/"/g, '""') + '"';
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

    // Create summary statistics
    const completedCount = enrichedResults.filter(r => r.enrichment_status === 'completed').length;
    const failedCount = enrichedResults.filter(r => r.enrichment_status === 'failed').length;
    const notFoundCount = enrichedResults.filter(r => r.enrichment_status === '404_not_found').length;
    const skippedCount = enrichedResults.filter(r => r.enrichment_status === 'skipped').length;

    let summaryHtml = `<div style="margin-bottom: 1rem; padding: 1rem; background: #f9fafb; border-radius: 6px;">
        <h4>Processing Summary</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-top: 0.5rem;">
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">${completedCount}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">Completed</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #f59e0b;">${notFoundCount}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">404/Not Found</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #ef4444;">${failedCount}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">Failed</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 1.5rem; font-weight: bold; color: #6b7280;">${skippedCount}</div>
                <div style="font-size: 0.8rem; color: #6b7280;">Skipped</div>
            </div>
        </div>
    </div>`;

    // Create results table (show first 10 rows)
    let tableHtml = '<div style="max-height: 400px; overflow: auto;"><table class="results-table"><thead><tr>';

    const headers = Object.keys(enrichedResults[0]).filter(key => !key.startsWith('_'));
    headers.forEach(header => {
        tableHtml += `<th>${header}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    enrichedResults.slice(0, 10).forEach(row => {
        tableHtml += '<tr>';
        headers.forEach(header => {
            let value = row[header] || '';
            if (header.startsWith('pitch_') && value) {
                value = `<div class="pitch-cell">${value}</div>`;
            } else if (header === 'enrichment_status') {
                const statusClass = value === 'completed' ? 'status-success' : 
                                   value === '404_not_found' ? 'status-warning' : 'status-error';
                value = `<span class="${statusClass}" style="padding: 2px 6px; border-radius: 3px; font-size: 0.7rem;">${value}</span>`;
            }
            tableHtml += `<td>${value}</td>`;
        });
        tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    if (enrichedResults.length > 10) {
        tableHtml += `<p style="text-align: center; margin-top: 1rem; color: #6b7280; font-size: 0.9rem;">Showing first 10 of ${enrichedResults.length} results. Download CSV for complete data.</p>`;
    }
    tableHtml += '</div>';

    resultsContainer.innerHTML = summaryHtml + tableHtml;
    resultsSection.classList.remove('hidden');
}

// Utility Functions
function updateStepStatus(stepNumber, status) {
    const step = document.getElementById(`step${stepNumber}`);
    if (step) {
        step.className = `step ${status}`;
    }
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
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        document.body.appendChild(statusEl);
    }

    statusEl.textContent = message;
    statusEl.className = `status-indicator status-${type}`;

    // Auto-hide after 5 seconds for success messages, 3 seconds for others
    const hideDelay = type === 'success' ? 5000 : 3000;
    setTimeout(() => {
        if (statusEl && statusEl.parentNode) {
            statusEl.parentNode.removeChild(statusEl);
        }
    }, hideDelay);
}