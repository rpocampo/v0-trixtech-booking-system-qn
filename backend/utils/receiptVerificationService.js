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

  // Common patterns for GCash receipts
  const amountPatterns = [
    /₱\s*(\d+(?:\.\d{2})?)/g,  // ₱ 123.45
    /PHP\s*(\d+(?:\.\d{2})?)/gi,  // PHP 123.45
    /Amount[:\s]*₱?\s*(\d+(?:\.\d{2})?)/gi,  // Amount: ₱123.45 or Amount: 123.45
    /Total[:\s]*₱?\s*(\d+(?:\.\d{2})?)/gi,  // Total: ₱123.45
    /(\d+(?:\.\d{2})?)\s*PHP/gi,  // 123.45 PHP
  ];

  const referencePatterns = [
    /Ref[:\s]*([A-Z0-9_]+)/gi,  // Ref: QR_123456789
    /Reference[:\s]*([A-Z0-9_]+)/gi,  // Reference: QR_123456789
    /Message[:\s]*([A-Z0-9_]+)/gi,  // Message: QR_123456789
    /Notes[:\s]*([A-Z0-9_]+)/gi,  // Notes: QR_123456789
    /([A-Z]{2}_\d+_[A-Z0-9]+)/g,  // QR_123456789_ABC123 format
  ];

  // Extract amount
  for (const pattern of amountPatterns) {
    for (const line of lines) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const amount = parseFloat(match[1]);
        if (amount > 0 && (!extractedAmount || amount > extractedAmount)) {
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

// Validate extracted data against expected values
const validateReceiptData = (extractedData, expectedAmount, expectedReference) => {
  const { extractedAmount, extractedReference } = extractedData;

  const amountMatch = extractedAmount !== null &&
                     Math.abs(extractedAmount - expectedAmount) < 0.01; // Allow for small floating point differences

  const referenceMatch = extractedReference !== null &&
                        extractedReference === expectedReference;

  const isValid = amountMatch && referenceMatch;

  return {
    isValid,
    amountMatch,
    referenceMatch,
    extractedAmount,
    extractedReference,
    expectedAmount,
    expectedReference,
    issues: []
      .concat(amountMatch ? [] : ['Amount does not match expected payment amount'])
      .concat(referenceMatch ? [] : ['Reference number does not match'])
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

    // Validate against expected values
    const validation = validateReceiptData(extractedData, expectedAmount, expectedReference);

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