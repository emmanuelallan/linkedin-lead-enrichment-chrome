// Content script for LinkedIn Lead Enrichment Extension
// Enhanced session detection and profile scraping

console.log('LinkedIn Lead Enrichment: Content script loaded');

// Track session state changes
let currentSessionState = null;
let sessionCheckInterval = null;

// Initialize session monitoring when page loads
window.addEventListener('load', () => {
  console.log('Page loaded, starting session monitoring');
  startSessionMonitoring();
});

// Also start immediately if page is already loaded
if (document.readyState === 'complete') {
  startSessionMonitoring();
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.type);
  
  if (message.type === 'PING') {
    sendResponse({ success: true, url: window.location.href });
    return;
  }
  
  if (message.type === 'CHECK_SESSION') {
    checkLinkedInSessionEnhanced(sendResponse);
    return true; // Keep message channel open
  }
  
  if (message.type === 'SCRAPE_CURRENT_PROFILE') {
    scrapeCurrentProfile(sendResponse);
    return true; // Keep message channel open
  }
  
  if (message.type === 'NAVIGATE_TO_PROFILE') {
    navigateToProfile(message.profileUrl, sendResponse);
    return true; // Keep message channel open
  }

  if (message.type === 'FORCE_SESSION_CHECK') {
    forceSessionCheck(sendResponse);
    return true;
  }
});

// Enhanced LinkedIn session checking
function checkLinkedInSessionEnhanced(sendResponse) {
  try {
    console.log('Performing enhanced session check...');
    
    // Wait for DOM to be fully ready
    const performCheck = () => {
      const sessionData = getSessionData();
      console.log('Session data:', sessionData);
      
      sendResponse({
        success: sessionData.isLoggedIn,
        message: sessionData.isLoggedIn 
          ? `LinkedIn session active (confidence: ${sessionData.confidence}%)`
          : 'Please log in to LinkedIn',
        data: sessionData
      });
    };

    // If DOM is ready, check immediately
    if (document.readyState === 'complete') {
      performCheck();
    } else {
      // Wait for DOM to be ready
      document.addEventListener('DOMContentLoaded', performCheck);
    }
    
  } catch (error) {
    console.error('Error in enhanced session check:', error);
    sendResponse({
      success: false,
      message: 'Error checking session: ' + error.message
    });
  }
}

// Force a session check with retry logic
function forceSessionCheck(sendResponse) {
  let attempts = 0;
  const maxAttempts = 3;
  
  const attemptCheck = () => {
    attempts++;
    console.log(`Force session check attempt ${attempts}/${maxAttempts}`);
    
    const sessionData = getSessionData();
    
    if (sessionData.isLoggedIn || attempts >= maxAttempts) {
      sendResponse({
        success: sessionData.isLoggedIn,
        message: sessionData.isLoggedIn 
          ? `Session confirmed after ${attempts} attempts`
          : `Unable to detect session after ${attempts} attempts`,
        data: sessionData,
        attempts: attempts
      });
    } else {
      // Wait and retry
      setTimeout(attemptCheck, 2000);
    }
  };
  
  attemptCheck();
}

// Comprehensive session data collection
function getSessionData() {
  const indicators = {
    // Primary navigation indicators
    profileButton: {
      element: document.querySelector('[data-control-name="nav.header_me_toggle"]'),
      weight: 3
    },
    globalNavMe: {
      element: document.querySelector('.global-nav__me'),
      weight: 3
    },
    myNetworkNav: {
      element: document.querySelector('[data-control-name="nav.header_mynetwork"]'),
      weight: 2
    },
    
    // Search and feed indicators
    searchBox: {
      element: document.querySelector('input[placeholder*="Search"]') || 
               document.querySelector('input[aria-label*="Search"]'),
      weight: 2
    },
    feedContainer: {
      element: document.querySelector('.feed-container') ||
               document.querySelector('.scaffold-finite-scroll'),
      weight: 2
    },
    shareBox: {
      element: document.querySelector('.share-box-feed-entry') ||
               document.querySelector('.share-creation-state'),
      weight: 2
    },
    
    // General layout indicators
    globalNav: {
      element: document.querySelector('nav.global-nav') ||
               document.querySelector('.global-nav'),
      weight: 2
    },
    primaryNav: {
      element: document.querySelector('.global-nav__primary-items'),
      weight: 2
    },
    
    // Content indicators
    profileImage: {
      element: document.querySelector('.global-nav__me img') ||
               document.querySelector('[data-control-name="nav.header_me_toggle"] img'),
      weight: 1
    },
    messagesNav: {
      element: document.querySelector('[data-control-name="nav.header_messaging"]'),
      weight: 1
    },
    notificationsNav: {
      element: document.querySelector('[data-control-name="nav.header_notifications"]'),
      weight: 1
    }
  };

  // Negative indicators (signs of being logged out)
  const negativeIndicators = {
    loginForm: document.querySelector('.sign-in-form') ||
              document.querySelector('.login-form') ||
              document.querySelector('[data-tracking-control-name*="sign-in"]'),
    authWall: document.querySelector('.authwall') ||
             document.querySelector('[data-test-id="authwall"]'),
    guestHeader: document.querySelector('.guest-header') ||
                document.querySelector('.guest-nav'),
    joinNowButton: document.querySelector('[data-tracking-control-name*="join_now"]'),
    signInButton: document.querySelector('[data-tracking-control-name*="guest_homepage-basic_sign-in-button"]')
  };

  // Calculate weighted score
  let totalScore = 0;
  let maxPossibleScore = 0;
  let foundIndicators = [];

  Object.entries(indicators).forEach(([key, { element, weight }]) => {
    maxPossibleScore += weight;
    if (element) {
      totalScore += weight;
      foundIndicators.push(key);
    }
  });

  // Check for negative indicators
  const negativeFound = Object.entries(negativeIndicators)
    .filter(([key, element]) => element !== null)
    .map(([key]) => key);

  // Calculate confidence percentage
  const confidence = Math.round((totalScore / maxPossibleScore) * 100);
  
  // Determine if logged in
  const isLoggedIn = totalScore >= 4 && negativeFound.length === 0;

  // Get current page type
  const currentPage = getCurrentPageType();

  // Additional user info
  let userInfo = null;
  if (isLoggedIn) {
    const profileImg = document.querySelector('.global-nav__me img');
    const nameElement = document.querySelector('.global-nav__me .t-16') ||
                       document.querySelector('[data-control-name="nav.header_me_toggle"] .visually-hidden');
    
    userInfo = {
      hasProfilePic: !!profileImg,
      profilePicSrc: profileImg ? profileImg.src : null,
      userName: nameElement ? nameElement.textContent.trim() : null,
      currentPage: currentPage,
      foundIndicators: foundIndicators,
      confidence: confidence
    };
  }

  return {
    isLoggedIn,
    confidence,
    totalScore,
    maxPossibleScore,
    foundIndicators,
    negativeFound,
    currentUrl: window.location.href,
    currentPage,
    userInfo,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
}

// Determine current LinkedIn page type
function getCurrentPageType() {
  const url = window.location.href.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  
  if (pathname.includes('/feed') || pathname === '/' || pathname === '/feed/') return 'feed';
  if (pathname.includes('/in/')) return 'profile';
  if (pathname.includes('/search')) return 'search';
  if (pathname.includes('/messaging')) return 'messaging';
  if (pathname.includes('/notifications')) return 'notifications';
  if (pathname.includes('/jobs')) return 'jobs';
  if (pathname.includes('/mynetwork')) return 'network';
  if (pathname.includes('/learning')) return 'learning';
  if (pathname.includes('/sales')) return 'sales';
  
  return 'other';
}

// Start continuous session monitoring
function startSessionMonitoring() {
  // Clear any existing interval
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  
  // Initial check
  performSessionCheck();
  
  // Check every 30 seconds
  sessionCheckInterval = setInterval(performSessionCheck, 30000);
  
  // Also monitor for URL changes
  let currentUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('URL changed, performing session check');
      setTimeout(performSessionCheck, 2000); // Wait for page to load
    }
  }, 1000);
}

// Perform a session check and notify if state changed
function performSessionCheck() {
  try {
    const sessionData = getSessionData();
    
    // Check if session state changed
    if (currentSessionState !== sessionData.isLoggedIn) {
      console.log('Session state changed:', currentSessionState, '->', sessionData.isLoggedIn);
      
      currentSessionState = sessionData.isLoggedIn;
      
      // Notify background script of session change
      chrome.runtime.sendMessage({
        type: 'SESSION_CHANGED',
        newState: sessionData.isLoggedIn,
        sessionData: sessionData,
        url: window.location.href
      }).catch(error => {
        console.log('Could not send session change message:', error);
      });
    }
    
    currentSessionState = sessionData.isLoggedIn;
    
  } catch (error) {
    console.error('Error in session check:', error);
  }
}

// Enhanced profile scraping with better error handling
function scrapeCurrentProfile(sendResponse) {
  try {
    console.log('Starting profile scrape...');
    
    // Check if we're on a profile page
    if (!window.location.href.includes('/in/')) {
      sendResponse({
        success: false,
        message: 'Not on a LinkedIn profile page',
        currentUrl: window.location.href,
        pageType: getCurrentPageType()
      });
      return;
    }
    
    // Check session first
    const sessionData = getSessionData();
    if (!sessionData.isLoggedIn) {
      sendResponse({
        success: false,
        message: 'LinkedIn session required. Please log in first.',
        needsLogin: true,
        sessionData: sessionData
      });
      return;
    }
    
    // Wait for page content to load with progressive checking
    let attempts = 0;
    const maxAttempts = 5;
    
    const attemptScrape = () => {
      attempts++;
      console.log(`Profile scrape attempt ${attempts}/${maxAttempts}`);
      
      try {
        const profileData = extractProfileDataEnhanced();
        
        if (profileData && profileData.length > 100) {
          console.log(`Successfully extracted ${profileData.length} characters`);
          sendResponse({
            success: true,
            data: profileData,
            message: `Extracted ${profileData.length} characters from profile`,
            url: window.location.href,
            attempts: attempts
          });
        } else if (attempts < maxAttempts) {
          console.log(`Attempt ${attempts} insufficient data, retrying...`);
          setTimeout(attemptScrape, 2000);
        } else {
          sendResponse({
            success: false,
            message: 'Could not extract sufficient profile data after multiple attempts',
            dataLength: profileData ? profileData.length : 0,
            attempts: attempts
          });
        }
      } catch (error) {
        if (attempts < maxAttempts) {
          console.log(`Attempt ${attempts} failed with error, retrying:`, error);
          setTimeout(attemptScrape, 2000);
        } else {
          sendResponse({
            success: false,
            message: 'Error extracting profile data: ' + error.message,
            attempts: attempts
          });
        }
      }
    };
    
    // Start scraping with initial delay for page load
    setTimeout(attemptScrape, 1000);
    
  } catch (error) {
    console.error('Error in scrapeCurrentProfile:', error);
    sendResponse({
      success: false,
      message: 'Error scraping profile: ' + error.message
    });
  }
}

// Enhanced profile data extraction
function extractProfileDataEnhanced() {
  console.log('Extracting profile data...');
  
  // Progressive scrolling to load dynamic content
  window.scrollTo({ 
    top: window.innerHeight * 0.3, 
    behavior: 'smooth' 
  });
  
  // Wait a moment for content to load
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  return new Promise(async (resolve) => {
    await delay(500);
    
    // Multiple extraction strategies
    let extractedContent = '';
    
    // Strategy 1: Main content area
    const mainElement = document.querySelector('main');
    if (mainElement) {
      const mainText = cleanText(mainElement.innerText || mainElement.textContent || '');
      if (mainText.length > 200) {
        resolve(mainText);
        return;
      }
      extractedContent += mainText + '\n\n';
    }
    
    // Strategy 2: Specific LinkedIn profile selectors (updated for current LinkedIn)
    const profileSelectors = [
      // Top card (name, headline, location)
      '.pv-text-details__left-panel',
      '.mt2.relative',
      '.pv-top-card',
      
      // About section
      '.pv-about-section',
      '.pv-profile-section__section-info',
      '[data-section="summary"]',
      
      // Experience section
      '.pv-profile-section.experience-section',
      '.pv-experience-section',
      '[data-section="experience"]',
      '.pvs-list__container',
      
      // Education
      '.pv-profile-section.education-section',
      '.pv-education-section',
      '[data-section="education"]',
      
      // Skills
      '.pv-skill-categories-section',
      '.pv-skills-section',
      
      // Generic profile sections
      '.profile-section',
      '.pv-profile-section',
      '.artdeco-card',
      
      // New LinkedIn layout selectors
      '.scaffold-layout__main',
      '.pv-profile-header',
      '.pv-entity__summary-info'
    ];
    
    profileSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element && element.offsetParent !== null) { // Only visible elements
            const text = cleanText(element.innerText || element.textContent || '');
            if (text.length > 10) { // Only meaningful content
              extractedContent += text + '\n\n';
            }
          }
        });
      } catch (error) {
        console.log(`Error with selector ${selector}:`, error);
      }
    });
    
    // Strategy 3: Fallback - try to get any visible text content
    if (extractedContent.length < 100) {
      const visibleElements = document.querySelectorAll('section, article, div[class*="pv-"], div[class*="profile"]');
      visibleElements.forEach(element => {
        if (element.offsetParent !== null && element.textContent) {
          const text = cleanText(element.textContent);
          if (text.length > 20 && !extractedContent.includes(text.substring(0, 50))) {
            extractedContent += text + '\n\n';
          }
        }
      });
    }
    
    // Clean up and deduplicate
    const finalContent = deduplicateContent(extractedContent);
    resolve(finalContent);
  });
}

// Clean and normalize text content
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^_`{|}~]/g, '') // Remove special chars
    .trim();
}

// Remove duplicate content
function deduplicateContent(content) {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const uniqueLines = [];
  const seen = new Set();
  
  lines.forEach(line => {
    const normalized = line.toLowerCase().substring(0, 50);
    if (!seen.has(normalized) && line.length > 5) {
      seen.add(normalized);
      uniqueLines.push(line);
    }
  });
  
  return uniqueLines.join('\n');
}

// Enhanced navigation to profile
function navigateToProfile(profileUrl, sendResponse) {
  try {
    console.log('Navigating to profile:', profileUrl);
    
    // Clean and validate URL
    const cleanUrl = cleanProfileUrl(profileUrl);
    
    if (!cleanUrl || !cleanUrl.includes('linkedin.com/in/')) {
      sendResponse({
        success: false,
        message: 'Invalid LinkedIn profile URL: ' + profileUrl
      });
      return;
    }
    
    // Check current session before navigation
    const sessionData = getSessionData();
    if (!sessionData.isLoggedIn) {
      sendResponse({
        success: false,
        message: 'LinkedIn session required for navigation',
        needsLogin: true
      });
      return;
    }
    
    // If already on the target profile, just confirm
    if (window.location.href.includes(cleanUrl.split('/in/')[1])) {
      sendResponse({
        success: true,
        message: 'Already on target profile',
        url: window.location.href
      });
      return;
    }
    
    // Navigate to profile
    console.log('Navigating to:', cleanUrl);
    window.location.href = cleanUrl;
    
    // Monitor navigation progress
    let checkCount = 0;
    const maxChecks = 20; // 20 seconds timeout
    
    const checkNavigation = setInterval(() => {
      checkCount++;
      
      const currentProfileId = window.location.href.includes('/in/') ? 
        window.location.href.split('/in/')[1].split('/')[0] : null;
      const targetProfileId = cleanUrl.split('/in/')[1].split('/')[0];
      
      if (currentProfileId === targetProfileId) {
        clearInterval(checkNavigation);
        
        // Wait for page content to load
        setTimeout(() => {
          sendResponse({
            success: true,
            message: 'Successfully navigated to profile',
            url: window.location.href,
            checksRequired: checkCount
          });
        }, 2000);
        
      } else if (checkCount >= maxChecks) {
        clearInterval(checkNavigation);
        sendResponse({
          success: false,
          message: 'Navigation timeout - page may not have loaded properly',
          currentUrl: window.location.href,
          targetUrl: cleanUrl
        });
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error navigating to profile:', error);
    sendResponse({
      success: false,
      message: 'Navigation failed: ' + error.message
    });
  }
}

// Enhanced URL cleaning
function cleanProfileUrl(url) {
  if (!url) return '';
  
  // Remove common prefixes and clean
  let cleaned = url.replace(/^@/, '').trim();
  
  // If it's already a full LinkedIn URL
  if (cleaned.includes('linkedin.com/in/')) {
    const match = cleaned.match(/linkedin\.com\/in\/([^\/?\s&]+)/);
    if (match) {
      return `https://www.linkedin.com/in/${match[1]}`;
    }
  }
  
  // If it's just a username
  if (!cleaned.includes('linkedin.com')) {
    // Remove any extra characters that aren't valid in LinkedIn usernames
    cleaned = cleaned.replace(/[^a-zA-Z0-9\-]/g, '');
    if (cleaned.length > 0) {
      return `https://www.linkedin.com/in/${cleaned}`;
    }
  }
  
  return cleaned;
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('Page became visible, checking session...');
    setTimeout(performSessionCheck, 1000);
  }
});

// Handle network status changes
window.addEventListener('online', () => {
  console.log('Network came back online, checking session...');
  setTimeout(performSessionCheck, 1000);
});

// Enhanced error handling
function handleError(error, context) {
  console.error(`Error in ${context}:`, error);
  
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context: context,
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  };
  
  // Send error report to background script
  chrome.runtime.sendMessage({
    type: 'ERROR_REPORT',
    error: errorInfo
  }).catch(() => {
    // Ignore errors when sending error reports
  });
  
  return errorInfo;
}

// Utility function to wait for element with better error handling
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    let timeoutId;
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Check for anti-bot measures
function checkForAntiBot() {
  const antibotSelectors = [
    '.authwall',
    '[data-test-id="authwall"]',
    '.challenge',
    '.captcha',
    '[aria-label*="security check"]',
    '.security-challenge',
    '.verification-required'
  ];
  
  return antibotSelectors.some(selector => document.querySelector(selector) !== null);
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSessionData,
    extractProfileDataEnhanced,
    getCurrentPageType,
    cleanProfileUrl,
    cleanText,
    deduplicateContent
  };
}

console.log('LinkedIn Lead Enrichment: Enhanced content script fully loaded and ready');