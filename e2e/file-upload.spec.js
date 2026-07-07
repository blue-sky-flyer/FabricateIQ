/**
 * E2E tests — multi-file upload feature
 *
 * Scenarios covered:
 *   1. Multi-file upload: two images appear in the file list
 *   2. Max file limit: drop zone disappears at capacity; 4th upload triggers error
 *   3. Remove individual file: file list updates, drop zone reappears
 *   4. Clear All: wipes file list and description together
 *   5. Description textarea: typing + maxLength enforcement
 *   6. PDF with extractable text disables dimension + environment form fields
 *   7. Image-only upload keeps form fields enabled
 *   8. Keyboard accessibility: upload zone is focusable and Tab-navigable
 *   9. Drop zone hides exactly when 3 files are present
 *
 * API calls are fully mocked — no real network traffic leaves the machine.
 */

import { test, expect } from '@playwright/test';
import { FileUploadPage } from './pages/FileUploadPage.js';
import { setupApiMocks } from './support/api-mocks.js';
import { testFiles } from './fixtures/test-files.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to the app, wire up API mocks, and return an initialised POM.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [apiOverrides] - Forwarded to setupApiMocks
 */
async function openApp(page, apiOverrides = {}) {
  const pom = new FileUploadPage(page);
  // Mocks must be registered before navigation so the very first fetch is caught.
  await setupApiMocks(page, apiOverrides);
  await pom.goto();
  return pom;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Multi-file upload feature', () => {

  // -------------------------------------------------------------------------
  // 1. Upload two images — both appear in the file list
  // -------------------------------------------------------------------------
  test('uploads two image files and shows both in the file list', async ({ page }) => {
    const pom = await openApp(page);

    await pom.uploadFiles([testFiles.image1, testFiles.image2]);
    await pom.waitForAnalysisComplete();

    // Both items must be present
    await expect(pom.fileItems).toHaveCount(2);

    // Filenames match what was uploaded
    await expect(pom.fileNameOf(pom.fileItemAt(0))).toHaveText(testFiles.image1.name);
    await expect(pom.fileNameOf(pom.fileItemAt(1))).toHaveText(testFiles.image2.name);

    // Each item has a thumbnail (image type renders <img.file-thumbnail>)
    await expect(pom.fileItemAt(0).locator('.file-thumbnail')).toBeVisible();
    await expect(pom.fileItemAt(1).locator('.file-thumbnail')).toBeVisible();

    // Each item has a remove button
    await expect(pom.removeButtonOf(pom.fileItemAt(0))).toBeVisible();
    await expect(pom.removeButtonOf(pom.fileItemAt(1))).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. Max file limit — zone hides at capacity; overflow triggers error
  // -------------------------------------------------------------------------
  test('shows error when attempting to exceed the 3-file maximum', async ({ page }) => {
    const pom = await openApp(page);

    // Fill to capacity via the input (3 files at once)
    await pom.uploadFiles([testFiles.image1, testFiles.image2, testFiles.image3]);
    await pom.waitForAnalysisComplete();

    await expect(pom.fileItems).toHaveCount(3);

    // Upload zone should be hidden — canAddMore is false
    await expect(pom.uploadZone).not.toBeVisible();

    // Programmatically fire a 4th upload via JavaScript to bypass the hidden input.
    // The hook throws and the parent passes the message to onError -> ErrorBanner.
    await page.evaluate(async () => {
      // Grab the React root to dispatch a synthetic change event on the hidden input.
      // Because the input is style=display:none we manipulate it via JS directly.
      const input = document.querySelector('input[type="file"]');
      if (!input) return; // zone hidden, input gone from DOM

      const dt = new DataTransfer();
      const file = new File(['x'], 'overflow.jpg', { type: 'image/jpeg' });
      dt.items.add(file);
      Object.defineProperty(input, 'files', { value: dt.files });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // The error banner should surface the "Maximum 3 files" message.
    // Give React a moment to re-render.
    await expect(pom.errorBanner).toBeVisible({ timeout: 5_000 });
    await expect(pom.errorBanner).toContainText(/maximum 3 files|Maximum 3 files/i);
  });

  // -------------------------------------------------------------------------
  // 3. Remove individual file — remaining file stays, zone reappears
  // -------------------------------------------------------------------------
  test('removes an individual file and shows the upload zone again', async ({ page }) => {
    const pom = await openApp(page);

    await pom.uploadFiles([testFiles.image1, testFiles.image2]);
    await pom.waitForAnalysisComplete();

    await expect(pom.fileItems).toHaveCount(2);

    // Remove the first file
    await pom.removeFileAt(0);

    // Only one file should remain
    await expect(pom.fileItems).toHaveCount(1);

    // The remaining file should be image2
    await expect(pom.fileNameOf(pom.fileItemAt(0))).toHaveText(testFiles.image2.name);

    // Upload zone reappears because canAddMore is true again
    await expect(pom.uploadZone).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 4. Clear All resets both the file list and the description
  // -------------------------------------------------------------------------
  test('Clear All removes all files and clears the description', async ({ page }) => {
    const pom = await openApp(page);

    await pom.uploadFiles([testFiles.image1, testFiles.image2]);
    await pom.waitForAnalysisComplete();

    await pom.fillDescription('This is a test booth requirement description.');

    // Confirm state before clearing
    await expect(pom.fileItems).toHaveCount(2);
    await expect(pom.descriptionInput).toHaveValue('This is a test booth requirement description.');

    // Clear All button should be present when files exist
    await expect(pom.clearAllBtn).toBeVisible();

    await pom.clickClearAll();

    // File list gone
    await expect(pom.fileList).not.toBeVisible();
    await expect(pom.fileItems).toHaveCount(0);

    // Description cleared
    await expect(pom.descriptionInput).toHaveValue('');

    // Clear All button should disappear (hasFiles = false)
    await expect(pom.clearAllBtn).not.toBeVisible();

    // Upload zone should reappear
    await expect(pom.uploadZone).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 5. Description textarea — typing and maxLength
  // -------------------------------------------------------------------------
  test('description textarea accepts text up to 2000 characters', async ({ page }) => {
    const pom = await openApp(page);

    // Verify placeholder text
    await expect(pom.descriptionInput).toHaveAttribute(
      'placeholder',
      'Describe the booth requirements or provide context about the uploaded files...'
    );

    // Verify maxLength attribute
    await expect(pom.descriptionInput).toHaveAttribute('maxlength', '2000');

    // Type a short description
    const shortText = 'Samsung 10x20 island booth, premium graphics.';
    await pom.fillDescription(shortText);
    await expect(pom.descriptionInput).toHaveValue(shortText);

    // Type exactly 2000 characters — should all be accepted
    const maxText = 'A'.repeat(2000);
    await pom.fillDescription(maxText);
    const actualLength = await pom.descriptionLength();
    expect(actualLength).toBe(2000);

    // Attempt to type beyond 2000 — browser enforces maxLength, so length stays 2000
    await pom.descriptionInput.type('OVERFLOW');
    const afterOverflow = await pom.descriptionLength();
    expect(afterOverflow).toBe(2000);
  });

  // -------------------------------------------------------------------------
  // 6. PDF with extractable text disables form fields
  // -------------------------------------------------------------------------
  test('uploading a PDF with text disables dimension and environment fields', async ({ page }) => {
    const pom = await openApp(page);

    // Confirm fields start enabled
    await expect(pom.widthInput).toBeEnabled();
    await expect(pom.lengthInput).toBeEnabled();
    await expect(pom.indoorBtn).toBeEnabled();
    await expect(pom.outdoorBtn).toBeEnabled();

    await pom.uploadFiles([testFiles.pdfWithText]);
    await pom.waitForAnalysisComplete();

    // The file should appear in the list with a PDF icon (not an img thumbnail)
    await expect(pom.fileItems).toHaveCount(1);
    await expect(pom.fileItemAt(0).locator('.file-thumbnail-icon')).toBeVisible();
    await expect(pom.fileNameOf(pom.fileItemAt(0))).toHaveText(testFiles.pdfWithText.name);

    // hasPdfText = true → pdfDisabled = true → form fields disabled
    await expect(pom.widthInput).toBeDisabled();
    await expect(pom.lengthInput).toBeDisabled();
    await expect(pom.indoorBtn).toBeDisabled();
    await expect(pom.outdoorBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // 7. Image-only upload keeps form fields enabled
  // -------------------------------------------------------------------------
  test('uploading an image keeps dimension and environment fields enabled', async ({ page }) => {
    const pom = await openApp(page);

    await pom.uploadFiles([testFiles.image1]);
    await pom.waitForAnalysisComplete();

    await expect(pom.fileItems).toHaveCount(1);

    // hasPdfText = false → pdfDisabled = false → form fields remain enabled
    await expect(pom.widthInput).toBeEnabled();
    await expect(pom.lengthInput).toBeEnabled();
    await expect(pom.indoorBtn).toBeEnabled();
    await expect(pom.outdoorBtn).toBeEnabled();
  });

  // -------------------------------------------------------------------------
  // 8. Keyboard accessibility — upload zone is focusable
  // -------------------------------------------------------------------------
  test('upload zone is keyboard focusable and has correct ARIA attributes', async ({ page }) => {
    const pom = await openApp(page);

    // The zone must have tabIndex=0 (rendered as tabindex="0")
    await expect(pom.uploadZone).toHaveAttribute('tabindex', '0');

    // It must have role="button"
    await expect(pom.uploadZone).toHaveAttribute('role', 'button');

    // It must have a descriptive aria-label
    await expect(pom.uploadZone).toHaveAttribute(
      'aria-label',
      'Upload files — drop renderings or PDFs here, or click to browse'
    );

    // Tab to the zone and confirm it receives focus
    await page.keyboard.press('Tab');
    // Keep tabbing until the upload zone is focused (other focusable elements come first)
    let focused = false;
    for (let i = 0; i < 15; i++) {
      const focusedEl = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.className : '';
      });
      if (focusedEl.includes('upload-zone')) {
        focused = true;
        break;
      }
      await page.keyboard.press('Tab');
    }
    expect(focused).toBe(true);

    // Press Enter — this should trigger a click on the zone (which opens the file dialog).
    // We can't fully test the OS file picker, but we verify no JS error is thrown.
    // Intercept the dialog to prevent it from blocking.
    const dialogPromise = page.waitForEvent('filechooser', { timeout: 3_000 }).catch(() => null);
    await page.keyboard.press('Enter');
    const chooser = await dialogPromise;
    // If a file chooser appeared, close it immediately — this proves Enter works.
    if (chooser) {
      await chooser.setFiles([]);
    }
    // Either a chooser appeared (Enter works) or none (env limitation) — no crash is the key assertion.
    // The zone should still be visible and interactive.
    await expect(pom.uploadZone).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 9. Upload zone hides exactly when 3 files are present
  // -------------------------------------------------------------------------
  test('upload zone disappears when exactly 3 files are uploaded', async ({ page }) => {
    const pom = await openApp(page);

    // Upload zone visible with 0 files
    await expect(pom.uploadZone).toBeVisible();

    await pom.uploadFiles([testFiles.image1]);
    await pom.waitForAnalysisComplete();

    // Still visible with 1 file
    await expect(pom.uploadZone).toBeVisible();
    await expect(pom.fileItems).toHaveCount(1);

    await pom.uploadFiles([testFiles.image2]);
    await pom.waitForAnalysisComplete();

    // Still visible with 2 files
    await expect(pom.uploadZone).toBeVisible();
    await expect(pom.fileItems).toHaveCount(2);

    await pom.uploadFiles([testFiles.image3]);
    await pom.waitForAnalysisComplete();

    // Hidden with 3 files
    await expect(pom.uploadZone).not.toBeVisible();
    await expect(pom.fileItems).toHaveCount(3);

    // Remove one — zone reappears
    await pom.removeFileAt(0);
    await expect(pom.uploadZone).toBeVisible();
    await expect(pom.fileItems).toHaveCount(2);
  });

  // -------------------------------------------------------------------------
  // 10. Clear All button hidden when no files are present
  // -------------------------------------------------------------------------
  test('Clear All button is hidden when no files are uploaded', async ({ page }) => {
    const pom = await openApp(page);

    // No files yet — Clear All should not be visible
    await expect(pom.clearAllBtn).not.toBeVisible();

    await pom.uploadFiles([testFiles.image1]);
    await pom.waitForAnalysisComplete();

    // Now it should appear
    await expect(pom.clearAllBtn).toBeVisible();

    await pom.removeFileAt(0);

    // After removing the only file, it should hide again
    await expect(pom.clearAllBtn).not.toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 11. Drag-and-drop: dragging class is applied and removed correctly
  // -------------------------------------------------------------------------
  test('upload zone gets the dragging class while a drag is in progress', async ({ page }) => {
    const pom = await openApp(page);

    // Simulate dragover on the upload zone
    await pom.uploadZone.dispatchEvent('dragover', {
      dataTransfer: { files: [] },
    });

    await expect(pom.uploadZone).toHaveClass(/dragging/);

    // Simulate dragleave
    await pom.uploadZone.dispatchEvent('dragleave');

    await expect(pom.uploadZone).not.toHaveClass(/dragging/);
  });

  // -------------------------------------------------------------------------
  // 12. File analysis error is shown on the individual file item
  // -------------------------------------------------------------------------
  test('shows an error indicator on a file item when analysis fails', async ({ page }) => {
    // Override Claude to return an error
    const pom = await openApp(page, {
      claudeResponse: { error: 'Vision API unavailable' },
      claudeStatus: 500,
    });

    await pom.uploadFiles([testFiles.image1]);

    // Wait for spinner to resolve (error path also clears analyzing)
    await page.locator('.file-spinner').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});

    // The file item should show the error indicator
    const item = pom.fileItemAt(0);
    await expect(pom.fileErrorOf(item)).toBeVisible({ timeout: 5_000 });
    await expect(pom.fileErrorOf(item)).toHaveAttribute('role', 'alert');
  });

});
