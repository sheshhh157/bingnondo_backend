'use strict';

/**
 * payments.controller.js  —  GCash Receipt OCR
 * ──────────────────────────────────────────────
 * POST /api/payments/extract-receipt
 *
 * Flow:
 *   1. multer-storage-cloudinary uploads image → Cloudinary (temp folder)
 *   2. Tesseract.js OCR runs on the returned Cloudinary URL
 *   3. Extract GCash ref number + sent amount from OCR text
 *   4. Return { temp_url, gcash_ref_number, gcash_amount, ocr_confidence } to Flutter
 *   5. Flutter shows extracted info → customer confirms → POST /api/orders
 *      (orders.controller saves temp_url + gcash_ref to payments table)
 *
 * No order ID needed here — this is stateless (no DB write).
 * The temp Cloudinary image is cleaned up server-side via a
 * separate scheduled job or when the permanent copy is saved in orders.controller.
 */

const Tesseract = require('tesseract.js');

// ─── GCash ref extractor ──────────────────────────────────────────────────────
// Actual GCash receipt format (from Transaction Details screen):
//   "Reference Number    00461758 68012"
// Tesseract sometimes inserts spaces inside long digit runs, so we
// strip all whitespace from the captured group before returning.
function extractGcashRef(text) {
  if (!text) return null;

  const cleaned = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "Reference Number" label (exact GCash wording)
  // Captures digits + spaces so we can strip spaces afterwards
  const refLabel = cleaned.match(
    /reference\s+number[:\s#]*([0-9][0-9 ]{7,20}[0-9])/i
  );
  if (refLabel) return refLabel[1].replace(/\s/g, '');

  // Pattern 2: shorter "Ref No" / "Ref:" / "Transaction ID" variants
  const refShort = cleaned.match(
    /(?:ref(?:erence)?(?:\s*no\.?)?|transaction\s*(?:id|no\.?))[:\s#]*([0-9][0-9 ]{7,20}[0-9])/i
  );
  if (refShort) return refShort[1].replace(/\s/g, '');

  // Pattern 3: standalone 13-digit run (spaces stripped) — most GCash refs are 13 digits
  // First remove spaces between consecutive digit groups to handle OCR splits
  const noSpaceDigits = cleaned.replace(/([0-9]) ([0-9])/g, '$1$2')
                                .replace(/([0-9]) ([0-9])/g, '$1$2'); // run twice for adjacent
  const thirteen = noSpaceDigits.match(/\b([0-9]{13})\b/);
  if (thirteen) return thirteen[1];

  // Pattern 4: 10–16 digit fallback
  const longNum = noSpaceDigits.match(/\b([0-9]{10,16})\b/);
  if (longNum) return longNum[1];

  return null;
}

// ─── GCash amount extractor ───────────────────────────────────────────────────
// Actual GCash receipt format (from Transaction Details screen):
//   "Amount    +105.00"
// Key insight: the amount has a leading "+" sign which previous patterns missed.
function extractGcashAmount(text) {
  if (!text) return null;

  const cleaned = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "Amount" label followed by optional +/- then number
  // Covers: "Amount +105.00" / "Amount 105.00" / "Amount: +1,250.00"
  const amountLabel = cleaned.match(
    /\bamount\b[:\s]*[+\-]?\s*([0-9]{1,6}(?:[.,][0-9]{2})?)/i
  );
  if (amountLabel) {
    return parseFloat(amountLabel[1].replace(',', '.'));
  }

  // Pattern 2: "You Sent" / "Amount Sent" / "Total" label + optional +/-
  const sentLabel = cleaned.match(
    /(?:you\s+sent|amount\s+sent|total)[:\s]*[+\-]?\s*(?:php|₱|phpl)?\s*([0-9]{1,6}(?:[.,][0-9]{2})?)/i
  );
  if (sentLabel) {
    return parseFloat(sentLabel[1].replace(',', '.'));
  }

  // Pattern 3: standalone "+NNN.NN" — the + makes it unambiguous
  const plusAmount = cleaned.match(/\+\s*([0-9]{1,6}\.[0-9]{2})\b/);
  if (plusAmount) {
    return parseFloat(plusAmount[1]);
  }

  // Pattern 4: PHP/₱ prefix then number
  const phpPrefix = cleaned.match(
    /(?:php|₱|phpl)\s*[+\-]?\s*([0-9]{1,6}(?:[.,][0-9]{2})?)/i
  );
  if (phpPrefix) {
    return parseFloat(phpPrefix[1].replace(',', '.'));
  }

  return null;
}

// ─── POST /api/payments/extract-receipt ───────────────────────────────────────
async function extractReceipt(req, res, next) {
  try {
    if (!req.file) {
      return res.status(422).json({ message: 'No receipt image uploaded.' });
    }

    const tempUrl = req.file.path; // Cloudinary URL (temp folder)

    // ── OCR ──────────────────────────────────────────────────────────────────
    let gcashRef      = null;
    let gcashAmount   = null;
    let ocrConfidence = 0;
    let ocrText       = '';

    try {
      const { data } = await Tesseract.recognize(tempUrl, 'eng', {
        logger: () => {},
      });
      ocrText       = data.text ?? '';
      ocrConfidence = Math.round(data.confidence ?? 0);
      gcashRef      = extractGcashRef(ocrText);
      gcashAmount   = extractGcashAmount(ocrText);

      console.log(
        `[OCR] extract-receipt confidence=${ocrConfidence}% ref=${gcashRef ?? 'NOT FOUND'} amount=${gcashAmount ?? 'NOT FOUND'}`
      );
    } catch (ocrErr) {
      console.error('[OCR] Failed:', ocrErr.message);
      // Non-fatal — return temp_url with null ref/amount so customer can re-upload
    }

    return res.json({
      temp_url:         tempUrl,
      gcash_ref_number: gcashRef,
      gcash_amount:     gcashAmount,   // number (e.g. 250.00) or null
      ocr_confidence:   ocrConfidence,
      ref_found:        gcashRef !== null,
      amount_found:     gcashAmount !== null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { extractReceipt, extractGcashRef, extractGcashAmount };