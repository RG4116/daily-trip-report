/**
 * Google Sheets Trailer Database Service
 * 
 * This service manages trailer and plate data stored in a shared Google Sheet.
 * Sheet URL: https://docs.google.com/spreadsheets/d/1yfUqr9uAwUziDx7XJn_tFrBY0c5lrAb6XNl9FM8d_nA/edit?usp=sharing
 * 
 * Structure:
 * - Column A: Trailer Number
 * - Column B: Plate Number
 */

const SHEET_ID = '1yfUqr9uAwUziDx7XJn_tFrBY0c5lrAb6XNl9FM8d_nA';
const RANGE = 'Sheet1!A:B';

/**
 * Fetch trailer data from Google Sheets
 * @returns {Promise<Object>} Object mapping trailer numbers to plate numbers
 */
export const fetchTrailersFromSheet = async () => {
  try {
    // Using Google Sheets public CSV export
    // This avoids needing authentication for public sheets
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
    
    console.log('📥 Fetching trailers from Google Sheet...');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch trailers from Google Sheet`);
    }
    
    const csv = await response.text();
    console.log('📄 Raw CSV received:', csv.substring(0, 200)); // Log first 200 chars for debugging
    
    const trailers = {};
    const lines = csv.trim().split('\n');
    
    if (lines.length < 2) {
      console.warn('⚠️ Google Sheet appears to be empty (no data rows)');
      return {};
    }
    
    // Parse CSV - handle both quoted and unquoted values, skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Handle CSV with quoted values
      const cells = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
      
      const trailerNo = String(cells[0]?.trim() || '');
      const plateNo = String(cells[1]?.trim() || '');
      
      if (trailerNo && plateNo) {
        trailers[trailerNo] = plateNo;
        console.log(`  ✓ Loaded: "${trailerNo}" → "${plateNo}"`);
      }
    }
    
    if (Object.keys(trailers).length === 0) {
      console.warn('⚠️ No valid trailer/plate pairs found in Google Sheet');
    } else {
      console.log(`✅ ${Object.keys(trailers).length} trailers loaded from Google Sheet:`, trailers);
    }
    
    return trailers;
  } catch (error) {
    console.error('❌ Error fetching trailers from Google Sheet:', error.message);
    return {};
  }
};

/**
 * Save new trailer to Google Sheet via Google Apps Script webhook
 * This sends data to the deployed Google Apps Script that has write access to the sheet
 */
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbypp4fPg4l4SpgtFXsVu86EO4-0slJNA-kAoc5hpPgzAmRdDl5Jt65_U23fTDDhbc1R/exec';

export const saveTrailerToSheet = async (trailerNo, plateNo) => {
  try {
    // Save to localStorage as immediate backup
    const localTrailers = JSON.parse(localStorage.getItem('localTrailers') || '{}');
    localTrailers[trailerNo] = plateNo;
    localStorage.setItem('localTrailers', JSON.stringify(localTrailers));
    
    console.log(`✅ Trailer ${trailerNo} (${plateNo}) saved locally`);
    
    // Now sync to Google Sheet via webhook
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trailerNo: String(trailerNo).trim(),
          plateNo: String(plateNo).trim(),
        })
      });
      
      console.log(`✅ Plate ${plateNo} synced to Google Sheet for trailer ${trailerNo}`);
    } catch (webhookError) {
      console.warn(`⚠️ Webhook sync failed (will retry on next page load):`, webhookError);
      // Plate is saved locally, will sync on next load via initializeTrailerData
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error saving trailer:', error);
    return false;
  }
};

/**
 * Get plate number for a trailer
 * Checks Google Sheet first, then localStorage
 */
export const getPlateForTrailer = async (trailerNo) => {
  try {
    // Try Google Sheet
    const sheetsData = await fetchTrailersFromSheet();
    if (sheetsData[trailerNo]) {
      return sheetsData[trailerNo];
    }
    
    // Fall back to localStorage
    const localTrailers = JSON.parse(localStorage.getItem('localTrailers') || '{}');
    if (localTrailers[trailerNo]) {
      return localTrailers[trailerNo];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting plate:', error);
    return null;
  }
};

/**
 * Initialize: Merge Google Sheet data with localStorage
 * This ensures user has all trailers available offline
 */
export const initializeTrailerData = async () => {
  try {
    const sheetsData = await fetchTrailersFromSheet();
    const localData = JSON.parse(localStorage.getItem('localTrailers') || '{}');
    
    // Merge: Google Sheet data takes precedence
    const merged = { ...localData, ...sheetsData };
    localStorage.setItem('localTrailers', JSON.stringify(merged));
    
    console.log('✅ Trailer data initialized:', merged);
    return merged;
  } catch (error) {
    console.error('❌ Error initializing trailer data:', error);
    return {};
  }
};
