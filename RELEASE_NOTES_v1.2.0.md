# LinkedIn Lead Enrichment v1.2.0 Release Notes

## 🚀 Major Features & Improvements

### Performance Optimizations
- **Optimized Content Script**: Implemented lazy initialization to reduce impact on LinkedIn page loading
- **Improved Profile Loading**: Extension now loads only when needed, preventing slowdowns on LinkedIn

### Enhanced Column Selection
- **Separated Column Types**: Now have dedicated columns for:
  - Name (contact names)
  - LinkedIn Profile URLs
  - Company information
- **Sales Navigator Support**: Added optional Sales Navigator URL support
  - Toggle to enable Sales Navigator functionality
  - Dedicated column selection for Sales Navigator URLs
  - Automatic detection of both regular LinkedIn and Sales Navigator URLs

### Improved User Experience
- **Restructured Workflow**: Moved prompt customization from settings to main workflow
- **Better Organization**: Grouped service type, industry focus, and prompt customization together
- **Enhanced Step Flow**: Updated step numbering (now 5 steps instead of 4)
- **Clearer Validation**: Separate validation for column configuration and pitch settings

### Technical Improvements
- **Enhanced URL Validation**: Now supports both LinkedIn profiles and Sales Navigator URLs
- **Improved Profile Scraping**: Works with both regular LinkedIn and Sales Navigator pages
- **Better Error Handling**: More robust error handling for different URL types
- **Optimized Performance**: Reduced extension overhead on LinkedIn pages

## 🔧 Configuration Changes

### New Column Options
- **Sales Navigator Column**: Optional column for Sales Navigator URLs
- **Enhanced Auto-Detection**: Better automatic column detection for various naming conventions

### Moved Settings
- **Prompt Customization**: Now part of main workflow (Step 4) instead of settings panel
- **Service & Industry**: Grouped with prompt customization for better user flow

## 🐛 Bug Fixes
- Fixed performance issues causing LinkedIn profile loading delays
- Improved URL parsing for various LinkedIn URL formats
- Enhanced session detection reliability

## 📋 Migration Notes
- Existing users will need to reconfigure their column mappings due to UI restructuring
- Custom prompts previously saved in settings will need to be re-entered in the new workflow
- No data loss - all CSV processing functionality remains the same

## 🎯 What's Next
- Enhanced company profile scraping
- Bulk processing optimizations
- Additional AI model support
- Advanced filtering options

---

**Full Changelog**: https://github.com/emmanuelallan/linkedin-lead-enrichment-chrome/compare/v1.1.0...v1.2.0