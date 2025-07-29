// Background service worker for LinkedIn Lead Enrichment Extension
// Improved LinkedIn session detection

// Enable side panel on LinkedIn pages
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;

  const url = new URL(tab.url);
  if (url.hostname.includes('linkedin.com')) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: 'sidepanel.html',
      enabled: true
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.includes('linkedin.com')) {
    await chrome.sidePanel.open({ tabId: tab.id });
  } else {
    // Open LinkedIn if not on LinkedIn
    await chrome.tabs.create({ url: 'https://linkedin.com/feed' });
  }
});

// Message handler for communication between content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_PROFILE') {
    handleProfileScraping(message, sender, sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CHECK_LINKEDIN_SESSION') {
    handleSessionCheck(message, sender, sendResponse);
    return true;
  }

  if (message.type === 'GENERATE_AI_PITCHES') {
    handleAIPitchGeneration(message, sender, sendResponse);
    return true;
  }

  if (message.type === 'SESSION_CHANGED') {
    // Handle session state changes from content script
    console.log('LinkedIn session changed:', message.newState);
    return;
  }
});

async function handleSessionCheck(message, sender, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url) {
      sendResponse({
        success: false,
        message: 'Unable to access current tab URL',
        needsNavigation: true,
        targetUrl: 'https://linkedin.com/feed'
      });
      return;
    }

    // If not on LinkedIn, navigate to feed
    if (!tab.url.includes('linkedin.com')) {
      try {
        await chrome.tabs.update(tab.id, { url: 'https://linkedin.com/feed' });

        // Wait for navigation and page load
        await waitForPageLoad(tab.id, 'https://linkedin.com/feed');

        // Check session after navigation
        const sessionResult = await checkSessionOnTab(tab.id);
        sendResponse(sessionResult);
        return;
      } catch (error) {
        sendResponse({
          success: false,
          message: 'Failed to navigate to LinkedIn: ' + error.message,
          needsNavigation: true,
          targetUrl: 'https://linkedin.com/feed'
        });
        return;
      }
    }

    // Already on LinkedIn, check session
    const sessionResult = await checkSessionOnTab(tab.id);
    sendResponse(sessionResult);

  } catch (error) {
    sendResponse({
      success: false,
      message: 'Error checking LinkedIn session: ' + error.message
    });
  }
}

async function checkSessionOnTab(tabId) {
  try {
    // Inject comprehensive session checking script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // Wait for DOM to be ready
        const waitForDOM = () => {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve);
            }
          });
        };

        return waitForDOM().then(() => {
          // Multiple session detection strategies
          const sessionChecks = {
            // Primary indicators (most reliable)
            profileButton: document.querySelector('[data-control-name="nav.header_me_toggle"]') !== null,
            globalNavMe: document.querySelector('.global-nav__me') !== null,
            myNetworkNav: document.querySelector('[data-control-name="nav.header_mynetwork"]') !== null,

            // Secondary indicators
            searchBox: document.querySelector('input[placeholder*="Search"]') !== null,
            feedElements: document.querySelector('.feed-shared-update-v2') !== null ||
              document.querySelector('.share-box-feed-entry') !== null,
            globalNav: document.querySelector('nav.global-nav') !== null,

            // Content indicators
            linkedinHeader: document.querySelector('.global-nav__primary-items') !== null,
            profilePicture: document.querySelector('.global-nav__me img') !== null,

            // URL-based checks
            isOnFeed: window.location.href.includes('/feed'),
            isOnProfile: window.location.href.includes('/in/'),
            isOnLinkedIn: window.location.hostname.includes('linkedin.com'),

            // Negative indicators (signs of being logged out)
            hasLoginForm: document.querySelector('.sign-in-form') !== null ||
              document.querySelector('.login-form') !== null ||
              document.querySelector('[data-tracking-control-name="guest_homepage-basic_sign-in-button"]') !== null,
            hasAuthWall: document.querySelector('.authwall') !== null,
            hasGuestElements: document.querySelector('.guest-header') !== null
          };

          // Calculate confidence score
          const positiveIndicators = [
            sessionChecks.profileButton,
            sessionChecks.globalNavMe,
            sessionChecks.myNetworkNav,
            sessionChecks.searchBox,
            sessionChecks.feedElements,
            sessionChecks.globalNav,
            sessionChecks.linkedinHeader
          ].filter(Boolean).length;

          const negativeIndicators = [
            sessionChecks.hasLoginForm,
            sessionChecks.hasAuthWall,
            sessionChecks.hasGuestElements
          ].filter(Boolean).length;

          // Determine login status
          const isLoggedIn = positiveIndicators >= 2 && negativeIndicators === 0;
          const confidence = positiveIndicators / 7; // 7 total positive checks

          // Get additional user info if logged in
          let userInfo = null;
          if (isLoggedIn) {
            const profileImg = document.querySelector('.global-nav__me img');
            const searchInput = document.querySelector('input[placeholder*="Search"]');

            userInfo = {
              hasProfilePic: !!profileImg,
              profilePicSrc: profileImg ? profileImg.src : null,
              hasSearchBox: !!searchInput,
              currentPage: getCurrentPageType(),
              navElementsFound: positiveIndicators,
              confidence: Math.round(confidence * 100)
            };
          }

          return {
            isLoggedIn,
            confidence,
            sessionChecks,
            currentUrl: window.location.href,
            userInfo,
            timestamp: new Date().toISOString()
          };
        });

        function getCurrentPageType() {
          const url = window.location.href;

          if (url.includes('/feed')) return 'feed';
          if (url.includes('/in/')) return 'profile';
          if (url.includes('/search')) return 'search';
          if (url.includes('/messaging')) return 'messaging';
          if (url.includes('/notifications')) return 'notifications';
          if (url.includes('/jobs')) return 'jobs';
          if (url.includes('/mynetwork')) return 'network';

          return 'other';
        }
      }
    });

    const result = results[0].result;

    return {
      success: result.isLoggedIn,
      message: result.isLoggedIn
        ? `LinkedIn session active (${result.confidence * 100}% confidence)`
        : 'Please log in to LinkedIn',
      data: result,
      needsLogin: !result.isLoggedIn
    };

  } catch (error) {
    return {
      success: false,
      message: 'Error checking LinkedIn session: ' + error.message,
      needsRetry: true
    };
  }
}

// Helper function to wait for page load after navigation
function waitForPageLoad(tabId, expectedUrl, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkLoad = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Tab access error: ' + chrome.runtime.lastError.message));
          return;
        }

        const isCorrectUrl = tab.url && (
          tab.url.includes(expectedUrl) ||
          (expectedUrl.includes('feed') && tab.url.includes('linkedin.com/feed'))
        );

        if (tab.status === 'complete' && isCorrectUrl) {
          // Additional wait for dynamic content
          setTimeout(resolve, 2000);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Page load timeout'));
        } else {
          setTimeout(checkLoad, 500);
        }
      });
    };

    // Start checking immediately
    checkLoad();
  });
}

// Enhanced profile scraping with HTML to text conversion
async function handleProfileScraping(message, sender, sendResponse) {
  try {
    const { profileUrl } = message;

    // Validate and clean the profile URL
    const cleanedUrl = validateAndCleanProfileUrl(profileUrl);
    if (!cleanedUrl.isValid) {
      sendResponse({
        success: false,
        message: cleanedUrl.error,
        originalInput: profileUrl,
        type: cleanedUrl.type || 'validation_error'
      });
      return;
    }

    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // First, ensure we have a valid LinkedIn session
    const sessionCheck = await checkSessionOnTab(tab.id);
    if (!sessionCheck.success) {
      sendResponse({
        success: false,
        message: 'LinkedIn session required. Please log in first.',
        needsLogin: true
      });
      return;
    }

    // Handle different types of profile access
    if (cleanedUrl.type === 'name_search') {
      // For name searches, we need to search and then try to find the profile
      const searchResult = await handleNameSearch(tab.id, cleanedUrl.url, cleanedUrl.searchTerm);
      if (!searchResult.success) {
        sendResponse(searchResult);
        return;
      }
      // Continue with the found profile URL
      const targetUrl = searchResult.profileUrl;
      if (!tab.url || !tab.url.includes(targetUrl.split('/in/')[1]?.split('/')[0] || '')) {
        await chrome.tabs.update(tab.id, { url: targetUrl });
        await waitForPageLoad(tab.id, targetUrl);
      }
    } else {
      // Direct profile URL or username
      const targetUrl = cleanedUrl.url;
      if (!tab.url || !tab.url.includes(targetUrl.split('/in/')[1]?.split('/')[0] || '')) {
        await chrome.tabs.update(tab.id, { url: targetUrl });
        await waitForPageLoad(tab.id, targetUrl);
      }
    }

    // Scrape profile data using improved method
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Add human-like delay and scrolling
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        // Improved scrolling to load more content
        const scrollAndWait = async () => {
          // Initial scroll to trigger content loading
          window.scrollTo({ top: 0, behavior: 'smooth' });
          await delay(1000);

          // Scroll down progressively
          for (let i = 1; i <= 3; i++) {
            window.scrollTo({ top: window.innerHeight * i * 0.3, behavior: 'smooth' });
            await delay(1500);
          }

          // Scroll back to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
          await delay(1000);
        };

        // HTML to text conversion function
        const htmlToText = (element) => {
          if (!element) return '';

          // Clone element to avoid modifying original
          const clone = element.cloneNode(true);

          // Remove script and style elements
          const scripts = clone.querySelectorAll('script, style, noscript');
          scripts.forEach(el => el.remove());

          // Remove hidden elements
          const hiddenElements = clone.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"], .hidden');
          hiddenElements.forEach(el => el.remove());

          // Convert to text with line breaks
          let text = clone.innerText || clone.textContent || '';

          // Clean up the text
          text = text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n\s*\n/g, '\n') // Remove empty lines
            .trim();

          return text;
        };

        return scrollAndWait().then(() => {
          // Get main content using the <main> tag approach
          const mainElement = document.querySelector('main');

          if (mainElement) {
            const profileText = htmlToText(mainElement);

            if (profileText && profileText.length > 200) {
              return {
                success: true,
                data: profileText,
                url: window.location.href,
                method: 'main_element',
                dataLength: profileText.length
              };
            }
          }

          // Fallback: try specific LinkedIn containers
          const fallbackSelectors = [
            '.scaffold-layout__main',
            '.pv-profile-header',
            '.profile-section',
            'section[data-section]',
            '.artdeco-card'
          ];

          let combinedText = '';
          fallbackSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
              if (element.offsetParent !== null) { // Only visible elements
                const text = htmlToText(element);
                if (text && text.length > 20) {
                  combinedText += text + '\n\n';
                }
              }
            });
          });

          // Remove duplicates
          const lines = combinedText.split('\n');
          const uniqueLines = [];
          const seen = new Set();

          lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !seen.has(trimmed.substring(0, 50))) {
              seen.add(trimmed.substring(0, 50));
              uniqueLines.push(trimmed);
            }
          });

          const finalText = uniqueLines.join('\n');

          return {
            success: finalText.length > 100,
            data: finalText,
            url: window.location.href,
            method: 'fallback_selectors',
            dataLength: finalText.length
          };
        });
      }
    });

    const result = results[0].result;

    if (result.success && result.data.length > 100) {
      sendResponse({
        success: true,
        data: result.data,
        message: `Extracted ${result.data.length} characters using ${result.method}`,
        url: result.url,
        method: result.method
      });
    } else {
      sendResponse({
        success: false,
        message: 'Failed to extract meaningful profile data',
        dataLength: result.dataLength || 0,
        method: result.method || 'unknown'
      });
    }

  } catch (error) {
    sendResponse({
      success: false,
      message: 'Error scraping profile: ' + error.message,
      error: error.toString()
    });
  }
}

async function handleAIPitchGeneration(message, sender, sendResponse) {
  try {
    const { personName, profileData, serviceType, industryFocus } = message;

    // Get API keys from storage
    const settings = await chrome.storage.local.get(['geminiApiKey', 'openaiApiKey']);

    if (!settings.geminiApiKey && !settings.openaiApiKey) {
      sendResponse({
        success: false,
        message: 'No AI API keys configured. Please set them in settings.'
      });
      return;
    }

    // Generate pitches using AI
    const pitches = await generateAIMessages(
      personName,
      profileData,
      serviceType,
      industryFocus,
      null, // companyInfo - not available in this context
      settings
    );

    sendResponse({
      success: true,
      pitches: pitches,
      message: 'AI pitches generated successfully'
    });

  } catch (error) {
    sendResponse({
      success: false,
      message: 'Error generating AI pitches: ' + error.message
    });
  }
}

async function generateAIMessages(personName, profileData, serviceType, industryFocus, companyInfo, settings) {
  // Step 1: Create comprehensive persona from profile data
  const personaPrompt = `Analyze this LinkedIn profile data and create a comprehensive persona summary.

**PROFILE DATA:**
${profileData}

**COMPANY INFO:**
${companyInfo ? `Company: ${companyInfo.name}\nCompany URL: ${companyInfo.url || 'Not available'}` : 'Company information not available'}

**INSTRUCTIONS:**
Create a structured persona that includes:

**PERSONA SUMMARY FOR ${personName}:**
- **Current Role:** [Their current job title and primary responsibilities]
- **Company:** [Current company name and what the company does]
- **Industry:** [The industry they work in]
- **Experience Level:** [Junior/Mid-level/Senior/Executive based on their background]
- **Key Skills:** [Professional skills and expertise areas]
- **Professional Background:** [Career progression and notable previous roles]
- **Challenges They Likely Face:** [3-4 specific challenges someone in their role typically encounters]
- **Goals & Objectives:** [What they're likely trying to achieve professionally]
- **Decision Making Power:** [Are they a decision maker, influencer, or end user]

Keep this factual and based only on the provided profile data. If information isn't available, mark it as "Not specified" rather than assuming.`;

  let persona = '';
  try {
    persona = await callAIAPI(personaPrompt, settings);
  } catch (error) {
    console.error('Error generating persona:', error);
    // Create a basic persona as fallback
    persona = `**PERSONA SUMMARY FOR ${personName}:**
- **Current Role:** Professional in ${industryFocus}
- **Company:** ${companyInfo?.name || 'Not specified'}
- **Industry:** ${industryFocus}
- **Experience Level:** Not specified
- **Key Skills:** Not specified
- **Professional Background:** Not specified
- **Challenges They Likely Face:** Industry-specific challenges
- **Goals & Objectives:** Professional growth and efficiency
- **Decision Making Power:** Not specified`;
  }

  // Step 2: Identify specific problems based on persona and industry
  const problemPrompt = `Based on this persona and their role in the ${industryFocus} industry, identify 3 specific business problems that ${serviceType} services could solve.

**PERSONA:**
${persona}

**SERVICE CONTEXT:**
- Service Type: ${serviceType}
- Target Industry: ${industryFocus}

**REQUIREMENTS:**
List 3 specific, realistic problems that someone like ${personName} would face that your ${serviceType} services could address. Make each problem:
1. Specific to their role and industry
2. Something they would actually care about
3. Solvable by ${serviceType} services

**FORMAT:**
Problem 1: [Specific problem related to their role]
Problem 2: [Different aspect they might struggle with]
Problem 3: [Another relevant challenge]

Each should be 1-2 sentences describing a real pain point.`;

  let problems = '';
  try {
    problems = await callAIAPI(problemPrompt, settings);
  } catch (error) {
    console.error('Error generating problems:', error);
    problems = `Problem 1: Difficulty scaling ${serviceType} efforts efficiently in ${industryFocus}
Problem 2: Lack of qualified leads and prospects in their target market
Problem 3: Time-consuming manual processes that could be automated`;
  }

  // Step 3: Generate personalized pitches
  const pitchPrompt = `Create 3 highly personalized LinkedIn outreach messages for ${personName} to promote ${serviceType} services.

**TARGET PERSONA:**
${persona}

**PROBLEMS TO ADDRESS:**
${problems}

**SERVICE DETAILS:**
- Service: ${serviceType}
- Industry Focus: ${industryFocus}

**REQUIREMENTS FOR EACH PITCH:**
- Maximum 2-3 sentences (LinkedIn message length)
- Personalized to ${personName} specifically
- Reference their role, company, or industry naturally
- Address one of the identified problems
- Include a soft call-to-action
- Professional but conversational tone
- NO generic templates or spammy language

**FORMAT:**
Pitch 1: [Message addressing Problem 1]

Pitch 2: [Message addressing Problem 2]

Pitch 3: [Message addressing Problem 3]

Make each message feel like it was written specifically for ${personName} after researching their background.`;

  let pitches = [];
  try {
    const response = await callAIAPI(pitchPrompt, settings);

    // Extract pitches from response
    const pitchMatches = response.match(/Pitch \d+:\s*(.+?)(?=Pitch \d+:|$)/gs);

    if (pitchMatches && pitchMatches.length >= 3) {
      pitches = pitchMatches.slice(0, 3).map(match => {
        return match.replace(/Pitch \d+:\s*/, '').trim();
      });
    } else {
      // Fallback: split by lines and find pitch content
      const lines = response.split('\n').filter(line => line.trim());
      const pitchLines = lines.filter(line =>
        line.toLowerCase().includes('pitch') ||
        (line.length > 50 && !line.includes(':'))
      );

      if (pitchLines.length >= 3) {
        pitches = pitchLines.slice(0, 3).map(line =>
          line.replace(/^Pitch \d+:\s*/i, '').trim()
        );
      }
    }

    // Ensure we have 3 pitches
    while (pitches.length < 3) {
      const fallbackPitch = generateFallbackPitch(personName, companyInfo?.name, serviceType, industryFocus, pitches.length + 1);
      pitches.push(fallbackPitch);
    }

  } catch (error) {
    console.error('Error generating pitches:', error);
    // Generate fallback pitches
    pitches = [
      generateFallbackPitch(personName, companyInfo?.name, serviceType, industryFocus, 1),
      generateFallbackPitch(personName, companyInfo?.name, serviceType, industryFocus, 2),
      generateFallbackPitch(personName, companyInfo?.name, serviceType, industryFocus, 3)
    ];
  }

  return pitches.slice(0, 3);
}

function generateFallbackPitch(personName, companyName, serviceType, industryFocus, pitchNumber) {
  const templates = [
    `Hi ${personName}, I noticed your work ${companyName ? `at ${companyName}` : `in ${industryFocus}`}. Our ${serviceType} services have helped similar ${industryFocus} professionals streamline their operations. Would you be open to a brief conversation?`,

    `${personName}, many ${industryFocus} leaders struggle with efficient ${serviceType}. Based on your background${companyName ? ` at ${companyName}` : ''}, I think our approach could provide significant value. Interested in learning more?`,

    `Hello ${personName}, I've been working with ${industryFocus} companies to improve their ${serviceType} results. Given your role${companyName ? ` at ${companyName}` : ''}, I'd love to share some insights that might be relevant. Are you available for a quick chat?`
  ];

  return templates[pitchNumber - 1] || templates[0];
}

function extractCompanyInfo(lead, config) {
  const companyName = config.companyColumn ? lead[config.companyColumn] : null;

  if (companyName && companyName.trim()) {
    return {
      name: companyName.trim(),
      url: generateCompanyUrl(companyName.trim())
    };
  }

  return null;
}

async function callAIAPI(prompt, settings) {
  // Try Gemini first, then OpenAI as fallback
  if (settings.geminiApiKey) {
    try {
      return await callGeminiAPI(prompt, settings.geminiApiKey);
    } catch (error) {
      console.error('Gemini API failed, trying OpenAI:', error);
      if (settings.openaiApiKey) {
        return await callOpenAIAPI(prompt, settings.openaiApiKey);
      }
      throw error;
    }
  } else if (settings.openaiApiKey) {
    return await callOpenAIAPI(prompt, settings.openaiApiKey);
  } else {
    throw new Error('No AI API keys available');
  }
}

async function callGeminiAPI(prompt, apiKey) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1000,
        thinkingConfig: {
          thinkingBudget: 0  // Disable thinking for faster responses
        }
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Gemini API returned invalid response format');
  }

  return data.candidates[0].content.parts[0].text;
}

async function callOpenAIAPI(prompt, apiKey) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      input: prompt
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.output_text || '';
}

// Handle name-based search to find LinkedIn profile
async function handleNameSearch(tabId, searchUrl, searchTerm) {
  try {
    // Navigate to search page
    await chrome.tabs.update(tabId, { url: searchUrl });
    await waitForPageLoad(tabId, searchUrl);

    // Search for the profile in search results
    const searchResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (searchTerm) => {
        // Wait for search results to load
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        return delay(2000).then(() => {
          // Look for profile links in search results
          const profileLinks = document.querySelectorAll('a[href*="/in/"]');

          if (profileLinks.length === 0) {
            return {
              success: false,
              message: `No LinkedIn profiles found for "${searchTerm}"`
            };
          }

          // Try to find the best match
          let bestMatch = null;
          let bestScore = 0;

          profileLinks.forEach(link => {
            const href = link.href;
            const linkText = (link.textContent || '').toLowerCase();
            const searchTermLower = searchTerm.toLowerCase();

            // Skip if not a profile link
            if (!href.includes('/in/') || href.includes('/company/')) {
              return;
            }

            // Calculate match score
            let score = 0;
            const searchWords = searchTermLower.split(' ');

            searchWords.forEach(word => {
              if (word.length > 2 && linkText.includes(word)) {
                score += word.length;
              }
            });

            // Prefer exact name matches
            if (linkText.includes(searchTermLower)) {
              score += 50;
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = {
                url: href,
                text: link.textContent || '',
                score: score
              };
            }
          });

          if (bestMatch && bestScore > 0) {
            return {
              success: true,
              profileUrl: bestMatch.url,
              matchText: bestMatch.text,
              score: bestMatch.score,
              totalResults: profileLinks.length
            };
          } else {
            // If no good match, return the first profile link
            const firstProfile = profileLinks[0];
            return {
              success: true,
              profileUrl: firstProfile.href,
              matchText: firstProfile.textContent || '',
              score: 0,
              totalResults: profileLinks.length,
              warning: `No exact match found for "${searchTerm}", using first result`
            };
          }
        });
      },
      args: [searchTerm]
    });

    return searchResults[0].result;

  } catch (error) {
    return {
      success: false,
      message: `Error searching for "${searchTerm}": ${error.message}`
    };
  }
}

// Fixed URL validation to handle sales navigator and other LinkedIn URLs
function validateAndCleanProfileUrl(input) {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      error: 'Invalid input: empty or non-string value'
    };
  }

  const trimmed = input.trim();

  // Handle LinkedIn Sales Navigator URLs - extract profile from them
  if (trimmed.includes('linkedin.com/sales/') && trimmed.includes('people/')) {
    return {
      isValid: false,
      error: 'Sales Navigator URLs are not supported. Please provide direct LinkedIn profile URLs (linkedin.com/in/username) or just the username.',
      type: 'sales_navigator'
    };
  }

  // If it's a standard LinkedIn profile URL
  if (trimmed.includes('linkedin.com/in/')) {
    const match = trimmed.match(/linkedin\.com\/in\/([^\/?\s&]+)/);
    if (match) {
      return {
        isValid: true,
        url: `https://www.linkedin.com/in/${match[1]}`,
        type: 'direct_url',
        username: match[1]
      };
    }
  }

  // If it's a LinkedIn public profile URL
  if (trimmed.includes('linkedin.com/pub/')) {
    const match = trimmed.match(/linkedin\.com\/pub\/([^\/?\s&]+)/);
    if (match) {
      // Convert pub URL to standard in/ format (may not always work)
      return {
        isValid: true,
        url: `https://www.linkedin.com/in/${match[1]}`,
        type: 'pub_url',
        username: match[1]
      };
    }
  }

  // If it looks like a LinkedIn username (alphanumeric with hyphens)
  const usernameMatch = trimmed.match(/^[a-zA-Z0-9\-]+$/);
  if (usernameMatch && trimmed.length > 2 && trimmed.length < 100) {
    return {
      isValid: true,
      url: `https://www.linkedin.com/in/${trimmed}`,
      type: 'username',
      username: trimmed
    };
  }

  // If it's a name, we need to search for it
  if (trimmed.length > 2 && /^[a-zA-Z\s\-\.\']+$/.test(trimmed)) {
    const searchQuery = encodeURIComponent(trimmed);
    return {
      isValid: true,
      url: `https://www.linkedin.com/search/results/people/?keywords=${searchQuery}`,
      type: 'name_search',
      searchTerm: trimmed
    };
  }

  // Try to extract username from any LinkedIn URL format
  const anyLinkedInMatch = trimmed.match(/linkedin\.com\/(?:in|pub)\/([^\/?\s&]+)/);
  if (anyLinkedInMatch) {
    return {
      isValid: true,
      url: `https://www.linkedin.com/in/${anyLinkedInMatch[1]}`,
      type: 'extracted_url',
      username: anyLinkedInMatch[1]
    };
  }

  return {
    isValid: false,
    error: `Invalid LinkedIn input: "${trimmed}". Please provide:
- LinkedIn profile URL (linkedin.com/in/username)
- LinkedIn username (e.g., john-doe-123)
- Person's full name for search
      
Sales Navigator URLs are not supported.`,
    originalInput: trimmed
  };
}

function generateCompanyUrl(companyName) {
  if (!companyName || typeof companyName !== 'string') {
    return null;
  }

  // Clean company name for URL
  const cleanName = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  if (cleanName.length > 0) {
    return `https://www.linkedin.com/company/${cleanName}`;
  }

  return null;
}