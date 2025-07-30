# LinkedIn Lead Enrichment Chrome Extension

Transform your CSV lead lists into personalized outreach campaigns using AI-powered LinkedIn profile analysis.

## 🌟 Features

- **Seamless LinkedIn Integration**: Uses your existing LinkedIn session - no separate login required
- **Drag & Drop CSV Upload**: Simple file handling with intelligent column mapping
- **AI-Powered Personalization**: Generates 3 unique pitches per lead using Gemini or OpenAI
- **Smart Profile Scraping**: Extracts LinkedIn profile data with human-like behavior
- **Progress Tracking**: Real-time processing updates with time estimates  
- **CSV Export**: Download enriched results with all original data plus AI pitches
- **Side Panel Interface**: Compact, always-accessible UI that doesn't interrupt your workflow

## 🚀 Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download the extension files** and save them to a folder on your computer

2. **Open Chrome Extensions page**:
   - Go to `chrome://extensions/`
   - Or Menu → More Tools → Extensions

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top right

4. **Load the extension**:
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

5. **Pin the extension** (optional):
   - Click the puzzle piece icon in the Chrome toolbar
   - Find "LinkedIn Lead Enrichment" and click the pin icon

### Method 2: Chrome Web Store (Coming Soon)
*Extension will be published to the Chrome Web Store after testing phase*

## ⚙️ Setup

### 1. Get AI API Keys

You'll need at least one of the following:

**Gemini API (Recommended)**:
- Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
- Create a new API key
- Copy the key for later use

**OpenAI API (Backup)**:
- Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
- Create a new API key
- Copy the key for later use

### 2. Configure the Extension

1. **Navigate to LinkedIn**: Go to `linkedin.com` and log in
2. **Open the extension**: Click the extension icon or use the side panel
3. **Add API keys**: Click the settings gear (⚙️) and paste your API keys
4. **Save settings**: Click "Save Settings"

## 📋 Usage

### Step 1: LinkedIn Session Check
- The extension automatically detects your LinkedIn login status
- Ensure you're logged into LinkedIn before processing leads

### Step 2: Upload CSV File
- **Drag and drop** your CSV file onto the upload area, or click to select
- CSV should contain lead information including names and LinkedIn profiles
- The extension will show a preview of your data

### Step 3: Configure Columns
- **Map columns** to the required fields:
  - **Name Column**: Contact names (required)
  - **LinkedIn Profile Column**: LinkedIn URLs or usernames (required)
  - **Company Column**: Company names (optional)
- **Set your service details**:
  - **Service Type**: What you offer (e.g., "cold email services")
  - **Target Industry**: Your focus area (e.g., "SaaS")

### Step 4: Process Leads
- Click **"Start Lead Enrichment"**
- The extension will:
  - Navigate to each LinkedIn profile
  - Extract profile information
  - Generate 3 personalized AI pitches
  - Add delays between requests to avoid rate limiting
- Monitor progress in real-time

### Step 5: Download Results
- **Download CSV**: Get your enriched data with original fields plus:
  - `pitch_1`, `pitch_2`, `pitch_3`: AI-generated personalized messages
  - `enrichment_status`: Success/failure status
  - `enriched_date`: Processing timestamp
  - Additional metadata fields
- **Preview Results**: View a sample of processed data in the extension

## 📊 CSV Format

### Input CSV Requirements
Your CSV should have:
```csv
name,linkedin_profile,company
John Smith,https://linkedin.com/in/johnsmith,Acme Corp
Jane Doe,jane-doe-123,Tech Solutions
```

### Supported LinkedIn URL Formats
- Full URLs: `https://linkedin.com/in/username`
- Short URLs: `linkedin.com/in/username`
- Usernames only: `username` or `@username`

### Output CSV Includes
All original columns plus:
- `pitch_1`: First personalized message
- `pitch_2`: Second personalized message  
- `pitch_3`: Third personalized message
- `enrichment_status`: "completed" or "failed"
- `enriched_date`: ISO timestamp
- `profile_data_length`: Characters extracted from profile
- `error_message`: Error details (if failed)

## 🔧 Advanced Features

### Human-Like Behavior
- Random delays between requests (1-3 minutes)
- Mouse movement simulation
- Progressive scrolling to load dynamic content
- Anti-detection measures

### Error Handling
- Automatic retry logic for failed scrapes
- Network error detection and recovery
- Session validation before processing
- Graceful handling of private/blocked profiles

### Rate Limiting
- Built-in delays to respect LinkedIn's usage policies
- Automatic backoff on errors
- Progress saving every 5 processed leads

## ⚠️ Important Notes

### LinkedIn Terms of Service
- Use responsibly and in compliance with LinkedIn's Terms of Service
- Avoid excessive requests that could trigger rate limiting
- Respect profile privacy settings
- This tool is for legitimate business outreach only

### API Costs
- **Gemini API**: ~$0.001-0.002 per lead (very cost-effective)
- **OpenAI API**: ~$0.01-0.02 per lead
- Costs depend on profile length and API pricing tiers

### Performance
- Processing time: ~2-3 minutes per lead (including delays)
- Recommended batch size: 50-100 leads per session
- The extension saves progress periodically

## 🛠️ Troubleshooting

### Extension Not Working
1. Ensure you're on a LinkedIn page
2. Check that Developer Mode is enabled
3. Reload the extension: `chrome://extensions/` → Click reload

### LinkedIn Session Issues
1. Log out and back into LinkedIn
2. Clear LinkedIn cookies and re-login
3. Try refreshing the LinkedIn page

### Profile Scraping Failures
1. Check if the profile is public
2. Ensure the LinkedIn URL is correct
3. Verify you're not rate-limited (wait 30 minutes)

### AI Generation Errors
1. Verify API keys are correctly entered
2. Check API quota/credits
3. Try the backup API if one fails

## 🔐 Privacy & Security

- **No data stored externally**: All processing happens locally
- **API keys stored locally**: Keys are saved in Chrome's local storage
- **LinkedIn session**: Uses your existing session, no credentials stored  
- **Profile data**: Temporarily processed, not permanently stored

## 📈 Best Practices

### For Best Results
1. **Clean your CSV**: Remove duplicates and invalid URLs
2. **Test with small batches**: Start with 5-10 leads
3. **Use specific service descriptions**: Better AI personalization
4. **Review generated pitches**: Always review before sending
5. **Respect LinkedIn limits**: Don't process more than 100 leads/day

### Service Type Examples
- "cold email lead generation services"
- "LinkedIn automation and outreach"
- "sales development and prospecting"
- "B2B marketing and lead nurturing"

### Industry Focus Examples  
- "SaaS and tech startups"
- "e-commerce and retail"
- "real estate and property management"
- "healthcare and medical devices"

## 🆘 Support

### Common Issues
- **"No LinkedIn session"**: Ensure you're logged into LinkedIn
- **"Profile data too short"**: Profile may be private or blocked
- **"API key invalid"**: Double-check your API key configuration
- **"Network error"**: Check internet connection and try again

### Getting Help
1. Check the browser console for error messages
2. Verify all steps in this README
3. Test with a small sample first
4. Ensure LinkedIn and API services are accessible

## 📝 License

This extension is provided as-is for educational and legitimate business use. Users are responsible for compliance with all applicable terms of service and regulations.

---

**⭐ Made for sales professionals, marketers, and business developers who want to scale personalized outreach while maintaining authenticity.**