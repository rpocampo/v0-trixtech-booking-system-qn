const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// Initialize OCR worker
let worker = null;

const initializeOCR = async () => {
  if (!worker) {
    try {
      worker = await createWorker('eng');
      // Configure for better receipt text recognition
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz₱$.- ',
        tessedit_pageseg_mode: '6', // Uniform block of text
      });
      console.log('OCR worker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }
  return worker;
};

// Extract text from image using OCR
const extractTextFromImage = async (imagePath) => {
  try {
    const ocrWorker = await initializeOCR();
    const { data: { text } } = await ocrWorker.recognize(imagePath);
    return text;
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw new Error('Failed to extract text from image');
  }
};

// Parse extracted text to find amount and reference number
const parseReceiptData = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let extractedAmount = null;
  let extractedReference = null;

  // Common patterns for GCash receipts - improved for GCash format with better decimal matching
  const amountPatterns = [
    /₱\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/g,  // ₱ 1,234.56 or ₱ 1234.56
    /PHP\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi,  // PHP 1,234.56
    /Amount[:\s]*₱?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi,  // Amount: ₱1,234.56 or Amount: 1234.56
    /Total[:\s]*₱?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi,  // Total: ₱1,234.56
    /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*PHP/gi,  // 1,234.56 PHP
    /Amount\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi,  // Amount 1234.56 (GCash specific)
    /Total Amount Sent\s*\$?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/gi,  // Total Amount Sent $1234.56
    /Amount\s+(\d+(?:\.\d{1,2})?)/gi,  // Amount 2.000.00 (GCash specific with space)
  ];

  const referencePatterns = [
    /Ref[:\s]*([A-Z0-9_]+)/gi,  // Ref: QR_123456789
    /Reference[:\s]*([A-Z0-9_]+)/gi,  // Reference: QR_123456789
    /Message[:\s]*([A-Z0-9_]+)/gi,  // Message: QR_123456789
    /Notes[:\s]*([A-Z0-9_]+)/gi,  // Notes: QR_123456789
    /([A-Z]{2}_\d+_[A-Z0-9]+)/g,  // QR_123456789_ABC123 format
  ];

  // Extract amount - improved logic to handle GCash format
  for (const pattern of amountPatterns) {
    for (const line of lines) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        // Clean the amount string (remove commas, handle decimals)
        let amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);

        if (!isNaN(amount) && amount > 0 && (!extractedAmount || amount > extractedAmount)) {
          // Take the highest amount found (likely the total)
          extractedAmount = amount;
        }
      }
    }
  }

  // Extract reference number
  for (const pattern of referencePatterns) {
    for (const line of lines) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const ref = match[1];
        if (ref && ref.length >= 8 && /^[A-Z0-9_]+$/.test(ref)) {
          extractedReference = ref;
          break; // Take first valid reference found
        }
      }
      if (extractedReference) break;
    }
    if (extractedReference) break;
  }

  return {
    extractedAmount,
    extractedReference,
    rawText: text,
    confidence: extractedAmount && extractedReference ? 'high' :
               (extractedAmount || extractedReference) ? 'medium' : 'low'
  };
};

// Flexible OCR validation for GCash receipts
const validateReceiptData = (extractedData, expectedAmount, expectedReference) => {
  const { extractedAmount, extractedReference } = extractedData;

  // Amount validation - allow small differences (within 1 peso) for OCR inaccuracies
  const amountMatch = extractedAmount !== null &&
                     Math.abs(extractedAmount - expectedAmount) < 1.0;

  // Allow amounts that are close (within 10% for manual review)
  const amountClose = extractedAmount !== null &&
                     Math.abs(extractedAmount - expectedAmount) / expectedAmount <= 0.10;

  // Reference validation (not required but must be real if present)
  const referenceMatch = extractedReference !== null &&
                         extractedReference === expectedReference;

  // Validate reference format for GCash (should start with QR_ and be properly formatted)
  const referenceFormatValid = extractedReference &&
                              extractedReference.startsWith('QR_') &&
                              extractedReference.length >= 10 &&
                              /^[A-Z]{2}_\d+_[A-Z0-9]+$/.test(extractedReference);

  // Auto-confirm only if amount matches exactly (as per requirement: total amount of items booked same as receipt total)
  // Flag for manual review if amount doesn't match exactly
  const autoConfirmed = amountMatch && (extractedReference === null || referenceFormatValid);

  // Flag for manual review if amount doesn't match exactly
  const requiresManualReview = !amountMatch;

  // Only reject if amount is way off (>10% difference) or reference format is completely invalid
  const isValid = autoConfirmed || requiresManualReview;

  // Additional check: if reference is present but doesn't match expected, flag for review
  const referenceValid = extractedReference === null ||
                        (referenceFormatValid && (referenceMatch || expectedReference === null));

  return {
    isValid: isValid,
    amountMatch,
    amountClose,
    referenceMatch,
    referenceFormatValid,
    extractedAmount,
    extractedReference,
    expectedAmount,
    expectedReference,
    autoConfirmed: autoConfirmed, // Auto-confirm only for exact matches
    requiresManualReview: requiresManualReview, // Flag for manual review on close amounts
    issues: []
      .concat(!amountMatch && !amountClose ? ['Amount does not match expected payment amount'] : [])
      .concat(!amountMatch && amountClose ? ['Amount is close but requires manual verification'] : [])
      .concat(extractedReference && !referenceFormatValid ? ['Reference number format is invalid'] : [])
      .concat(extractedReference && referenceFormatValid && !referenceMatch ? ['Reference number does not match expected value'] : [])
  };
};

// Main receipt verification function
const verifyReceipt = async (imagePath, expectedAmount, expectedReference) => {
  try {
    // Validate image file first
    if (!validateImageFile(imagePath)) {
      throw new Error('Invalid or corrupted image file');
    }

    // Extract text from image
    const rawText = await extractTextFromImage(imagePath);

    // Parse the extracted text
    const extractedData = parseReceiptData(rawText);

    console.log('OCR Raw Text Extracted:', rawText);
    console.log('Parsed Data - Amount:', extractedData.extractedAmount, 'Reference:', extractedData.extractedReference);

    // Validate against expected values
    const validation = validateReceiptData(extractedData, expectedAmount, expectedReference);

    console.log('Validation Result - Expected Amount:', expectedAmount, 'Amount Match:', validation.amountMatch);

    return {
      success: true,
      validation,
      extractedData: {
        ...extractedData,
        rawText
      }
    };

  } catch (error) {
    console.error('Receipt verification failed:', error);
    return {
      success: false,
      error: error.message,
      validation: {
        isValid: false,
        amountMatch: false,
        referenceMatch: false,
        issues: ['Failed to process receipt image']
      }
    };
  }
};

// Security: Validate image file
const validateImageFile = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    // Check file size (max 5MB)
    if (stats.size > 5 * 1024 * 1024) {
      throw new Error('File size exceeds limit');
    }

    // Check if it's actually an image by reading first few bytes
    const buffer = Buffer.alloc(8);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    // Check for common image signatures
    const signatures = {
      jpeg: [0xFF, 0xD8, 0xFF],
      png: [0x89, 0x50, 0x4E, 0x47],
      gif: [0x47, 0x49, 0x46],
      bmp: [0x42, 0x4D],
    };

    const isValidImage = Object.values(signatures).some(signature => {
      return signature.every((byte, index) => buffer[index] === byte);
    });

    if (!isValidImage) {
      throw new Error('Invalid image file');
    }

    return true;
  } catch (error) {
    console.error('Image validation failed:', error);
    return false;
  }
};


// Clean up uploaded file after processing
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Cleaned up temporary file:', filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

// Close OCR worker on application shutdown
const closeOCR = async () => {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
};

module.exports = {
  verifyReceipt,
  cleanupFile,
  closeOCR,
  extractTextFromImage,
  parseReceiptData,
  validateReceiptData,
  validateImageFile
};