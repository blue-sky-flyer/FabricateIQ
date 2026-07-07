/**
 * Page Object Model: FileUpload section + surrounding form controls.
 *
 * Encapsulates all locators and interaction helpers so test bodies stay
 * readable. Tests should never reach past this class for upload-related DOM.
 */
export class FileUploadPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // --- Upload zone ---
    this.uploadZone = page.locator('.upload-zone');
    this.fileInput = page.locator('input[type="file"]');

    // --- File list ---
    this.fileList = page.locator('.file-list');
    this.fileItems = page.locator('.file-item');

    // --- Buttons ---
    this.clearAllBtn = page.locator('.upload-clear-btn');
    this.generateQuoteBtn = page.locator('.btn-primary', { hasText: 'Generate AI Quote' });

    // --- Description ---
    this.descriptionInput = page.locator('.description-input');

    // --- Error banner (app-level) ---
    this.errorBanner = page.locator('.error-banner');

    // --- BoothForm fields that disable when PDF has text ---
    this.widthInput = page.locator('input[placeholder="Width"]');
    this.lengthInput = page.locator('input[placeholder="Length"]');
    this.indoorBtn = page.locator('.segment-btn', { hasText: 'Indoor' });
    this.outdoorBtn = page.locator('.segment-btn', { hasText: 'Outdoor' });
  }

  /** Navigate to the app root and wait for the upload zone to be visible. */
  async goto() {
    await this.page.goto('/');
    await this.uploadZone.waitFor({ state: 'visible' });
  }

  /**
   * Upload one or more files via the hidden file input.
   *
   * @param {Array<{name: string, mimeType: string, buffer: Buffer}>} files
   */
  async uploadFiles(files) {
    await this.fileInput.setInputFiles(files);
  }

  /**
   * Wait for all .file-spinner elements to disappear (analysis complete).
   * Useful after uploading so tests assert on the settled state.
   */
  async waitForAnalysisComplete() {
    await this.page.locator('.file-spinner').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {
      // If no spinner was ever present that is fine too
    });
  }

  /**
   * Return the file-item locator for the nth file (0-indexed).
   *
   * @param {number} index
   */
  fileItemAt(index) {
    return this.fileItems.nth(index);
  }

  /**
   * Return the remove button inside a given file-item locator.
   *
   * @param {import('@playwright/test').Locator} fileItem
   */
  removeButtonOf(fileItem) {
    return fileItem.locator('.file-remove-btn');
  }

  /**
   * Return the filename text inside a given file-item locator.
   *
   * @param {import('@playwright/test').Locator} fileItem
   */
  fileNameOf(fileItem) {
    return fileItem.locator('.file-name');
  }

  /**
   * Return the error indicator inside a given file-item locator (if any).
   *
   * @param {import('@playwright/test').Locator} fileItem
   */
  fileErrorOf(fileItem) {
    return fileItem.locator('.file-error');
  }

  /**
   * Click the remove button on the file at the given index.
   *
   * @param {number} index 0-based
   */
  async removeFileAt(index) {
    const item = this.fileItemAt(index);
    await this.removeButtonOf(item).click();
  }

  /**
   * Click Clear All and wait for the file list to disappear.
   */
  async clickClearAll() {
    await this.clearAllBtn.click();
    await this.fileList.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }

  /**
   * Type text into the description textarea.
   *
   * @param {string} text
   */
  async fillDescription(text) {
    await this.descriptionInput.fill(text);
  }

  /**
   * Return the current character count of the description input value.
   */
  async descriptionLength() {
    return (await this.descriptionInput.inputValue()).length;
  }
}
