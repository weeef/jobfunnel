/**
 * CareerFunnel - In-Page Job Detector & Scraper
 * Automatically parses job metadata from LinkedIn, Indeed, Greenhouse, Lever, Workday, etc.
 */

(() => {
  // Prevent double injection
  if (window.__cf_detector_injected) return;
  window.__cf_detector_injected = true;

  let currentJobData = null;
  let isCardOpen = false;

  /**
   * Scrape job information based on URL and DOM structure
   */
  function scrapeJobData() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    let company = '';
    let title = '';
    let location = '';
    let salary = '';
    let source = 'other';

    // 1. LinkedIn
    if (hostname.includes('linkedin.com')) {
      source = 'linkedin';
      const titleEl = document.querySelector(
        '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1.topcard__title, .jobs-details__main-content h1, h1'
      );
      const companyEl = document.querySelector(
        '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .topcard__org-name-link, .jobs-unified-top-card__primary-description a'
      );
      const locationEl = document.querySelector(
        '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet, .topcard__flavor--bullet, .jobs-unified-top-card__workplace-type'
      );
      const salaryEl = document.querySelector(
        '.job-details-jobs-unified-top-card__job-insight:has(span[dir="ltr"]), .jobs-unified-top-card__job-insight, [data-job-id] .job-details-preference-and-insight'
      );

      if (titleEl) title = titleEl.innerText.trim();
      if (companyEl) company = companyEl.innerText.trim();
      if (locationEl) location = locationEl.innerText.trim();
      if (salaryEl && (salaryEl.innerText.includes('$') || salaryEl.innerText.toLowerCase().includes('usd'))) {
        salary = cleanSalaryText(salaryEl.innerText);
      }
    }
    // 2. Indeed
    else if (hostname.includes('indeed.com')) {
      source = 'indeed';
      const titleEl = document.querySelector(
        'h1.jobsearch-JobInfoHeader-title, [data-testid="jobsearch-JobInfoHeader-title"], h1'
      );
      const companyEl = document.querySelector(
        '[data-testid="inlineHeader-companyName"], .jobsearch-InlineCompanyRating-companyHeader, [data-testid="jobsearch-CompanyInfoContainer"] a'
      );
      const locationEl = document.querySelector(
        '[data-testid="job-location"], .jobsearch-JobInfoHeader-companyLocation, [data-testid="inlineHeader-companyLocation"]'
      );
      const salaryEl = document.querySelector(
        '#salaryInfoAndJobType, [data-testid="attribute_snippet_testid"], .jobsearch-JobMetadataHeader-item'
      );

      if (titleEl) title = titleEl.innerText.trim();
      if (companyEl) company = companyEl.innerText.trim();
      if (locationEl) location = locationEl.innerText.trim();
      if (salaryEl) salary = cleanSalaryText(salaryEl.innerText);
    }
    // 3. Greenhouse
    else if (hostname.includes('greenhouse.io')) {
      source = 'greenhouse';
      const titleEl = document.querySelector('.app-title, #header h1, h1');
      const companyEl = document.querySelector('.company-name, #header .company-name');
      const locationEl = document.querySelector('.location, .company-location, #header .location');
      if (titleEl) title = titleEl.innerText.trim();
      if (companyEl) company = companyEl.innerText.replace(/^at\s+/i, '').trim();
      if (locationEl) location = locationEl.innerText.trim();
    }
    // 4. Lever
    else if (hostname.includes('lever.co')) {
      source = 'lever';
      const titleEl = document.querySelector('.posting-headline h2, h2');
      const companyEl = document.querySelector('.main-header-logo img, .main-header-logo');
      const locationEl = document.querySelector('.posting-categories .location, .sort-by-time .location, .workplaceTypes');
      const salaryEl = document.querySelector('.salary-range, .compensation');
      if (titleEl) title = titleEl.innerText.trim();
      if (companyEl) {
        company = companyEl.getAttribute('alt') || companyEl.innerText.trim();
      }
      if (locationEl) location = locationEl.innerText.trim();
      if (salaryEl) salary = cleanSalaryText(salaryEl.innerText);
      if (!company) {
        const parts = window.location.pathname.split('/');
        if (parts[1]) company = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      }
    }
    // 5. Workday
    else if (hostname.includes('myworkdayjobs.com')) {
      source = 'workday';
      const titleEl = document.querySelector('[data-automation-id="jobPostingHeader"], h2');
      const locationEl = document.querySelector('[data-automation-id="locations"], [data-automation-id="jobPostingLocation"]');
      const salaryEl = document.querySelector('[data-automation-id="compensation"], [data-automation-id="jobPostingPayRange"]');
      if (titleEl) title = titleEl.innerText.trim();
      if (locationEl) location = locationEl.innerText.trim();
      if (salaryEl) salary = cleanSalaryText(salaryEl.innerText);
      const sub = hostname.split('.')[0];
      company = sub.charAt(0).toUpperCase() + sub.slice(1);
    }
    // 6. Ashby
    else if (hostname.includes('ashbyhq.com')) {
      source = 'ashby';
      const titleEl = document.querySelector('h1');
      const locationEl = document.querySelector('div[class*="location"], [data-testid="location"]');
      const salaryEl = document.querySelector('div[class*="compensation"], [data-testid="compensation"]');
      if (titleEl) title = titleEl.innerText.trim();
      if (locationEl) location = locationEl.innerText.trim();
      if (salaryEl) salary = cleanSalaryText(salaryEl.innerText);
      const parts = window.location.pathname.split('/');
      if (parts[1]) company = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
    }
    // 7. Schema.org JSON-LD (Standardized across thousands of company career portals)
    try {
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLdScripts) {
        const json = JSON.parse(script.innerText);
        const data = Array.isArray(json) ? json.find(item => item['@type'] === 'JobPosting') : json;
        if (data && data['@type'] === 'JobPosting') {
          if (!title && data.title) title = data.title;
          if (!company && data.hiringOrganization?.name) company = data.hiringOrganization.name;
          if (!location) {
            if (data.jobLocationType === 'TELECOMMUTE') {
              location = 'Remote';
            } else if (data.jobLocation?.address?.addressLocality) {
              const addr = data.jobLocation.address;
              location = `${addr.addressLocality}${addr.addressRegion ? ', ' + addr.addressRegion : ''}`;
            }
          }
          if (!salary && data.baseSalary) {
            const bs = data.baseSalary;
            if (typeof bs === 'string') {
              salary = cleanSalaryText(bs);
            } else if (bs.value) {
              const val = bs.value;
              const currency = bs.currency || '$';
              if (val.minValue && val.maxValue) {
                salary = `${currency}${val.minValue.toLocaleString()} - ${currency}${val.maxValue.toLocaleString()}${val.unitText ? ' / ' + val.unitText.toLowerCase() : ''}`;
              } else if (val.value) {
                salary = `${currency}${val.value.toLocaleString()}${val.unitText ? ' / ' + val.unitText.toLowerCase() : ''}`;
              }
            }
          }
          break;
        }
      }
    } catch (e) {
      // ignore parse error
    }

    // 8. Meta tags fallback
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle && ogTitle.content) title = ogTitle.content.split('|')[0].split('-')[0].trim();
    }
    if (!company) {
      const ogSiteName = document.querySelector('meta[property="og:site_name"]');
      if (ogSiteName && ogSiteName.content) company = ogSiteName.content.trim();
    }

    // 9. Intelligent Deep Salary Scraper across body text if still missing
    if (!salary) {
      salary = extractSalaryFromBody();
    }

    // 10. Intelligent Location Scraper fallback
    if (!location) {
      location = extractLocationFromBody();
    }

    return {
      title: title || document.title.split('|')[0].trim(),
      company: company || '',
      location: location || '',
      salary: salary || '',
      url: window.location.href,
      source: source
    };
  }

  /**
   * Helper: Clean and format salary strings
   */
  function cleanSalaryText(str) {
    if (!str) return '';
    const match = str.match(/(?:\$|USD\s*)\s*([0-9]{2,3}(?:,[0-9]{3})*|\d{2,3}k|\d{2,3}(?:\.\d{2})?)\s*(?:-|–|—|to)\s*(?:\$|USD\s*)?\s*([0-9]{2,3}(?:,[0-9]{3})*|\d{2,3}k|\d{2,3}(?:\.\d{2})?)\s*(?:\/|\s*per\s*)?(?:yr|year|hour|hr|annual|annually)?/i);
    if (match) return match[0].trim();
    const singleMatch = str.match(/(?:\$|USD\s*)\s*([0-9]{2,3}(?:,[0-9]{3})*|\d{2,3}k)\s*(?:\/|\s*per\s*)?(?:yr|year|annual|annually|hour|hr)?/i);
    if (singleMatch) return singleMatch[0].trim();
    return str.split('\n')[0].trim().slice(0, 40);
  }

  /**
   * Helper: Scrape salary range from page body using refined regex
   */
  function extractSalaryFromBody() {
    const text = document.body.innerText;
    // Look for range e.g. $140,000 - $180,000 or $140k - $180k
    const rangeMatch = text.match(/(?:\$|USD\s*)\s*([0-9]{2,3}(?:,[0-9]{3})*|\d{2,3}k)\s*(?:-|–|—|to)\s*(?:\$|USD\s*)?\s*([0-9]{2,3}(?:,[0-9]{3})*|\d{2,3}k)(?:\s*(?:\/|\s*per\s*)(?:yr|year|hour|hr|annual|annually))?/i);
    if (rangeMatch) return rangeMatch[0].trim();

    // Look for hourly e.g. $50.00 - $75.00/hr
    const hourlyMatch = text.match(/\$\s*([0-9]{2}(?:\.[0-9]{2})?)\s*(?:-|to)\s*\$\s*([0-9]{2}(?:\.[0-9]{2})?)\s*(?:\/|\s*per\s*)?(?:hr|hour)/i);
    if (hourlyMatch) return hourlyMatch[0].trim();

    return '';
  }

  /**
   * Helper: Detect workplace location from text keywords
   */
  function extractLocationFromBody() {
    const text = document.body.innerText;
    if (/\b(?:fully\s+)?remote\s*(?:\(us\)|\(usa\)|\(global\)|\(americas\))?/i.test(text)) {
      return 'Remote';
    }
    if (/\bhybrid\b/i.test(text)) {
      return 'Hybrid';
    }
    return '';
  }

  /**
   * Message listener so Popup and Background Worker can request on-demand scraped job data
   */
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'scrapeJob') {
        const data = scrapeJobData();
        sendResponse({ job: data });
      }
      return true;
  }


  /**
   * Check if the current job is already saved in storage
   */
  async function checkIfAlreadyTracked() {
    try {
      if (typeof CareerStorage === 'undefined') return null;
      const allJobs = await CareerStorage.getAllJobs();
      const currentUrl = window.location.href.split('?')[0];
      return allJobs.find(j => j.url && j.url.split('?')[0] === currentUrl);
    } catch (err) {
      return null;
    }
  }

  /**
   * Inject or update the floating widget
   */
  async function injectWidget() {
    if (document.getElementById('cf-inpage-container')) return;

    currentJobData = scrapeJobData();
    const existingJob = await checkIfAlreadyTracked();

    const container = document.createElement('div');
    container.id = 'cf-inpage-container';

    const btnText = existingJob ? `✓ Tracked (${capitalize(existingJob.status)})` : '💼 Track Job';
    const isAlready = Boolean(existingJob);

    container.innerHTML = `
      <div class="cf-quick-card" id="cf-quick-card">
        <div class="cf-card-header">
          <div class="cf-card-brand">
            <svg class="cf-floating-icon" viewBox="0 0 24 24">
              <path d="M10 2H14A2 2 0 0 1 16 4V6H20A2 2 0 0 1 22 8V19A2 2 0 0 1 20 21H4A2 2 0 0 1 2 19V8A2 2 0 0 1 4 6H8V4A2 2 0 0 1 10 2M14 6V4H10V6H14Z"/>
            </svg>
            <span>CareerFunnel</span>
          </div>
          <button class="cf-btn-close" id="cf-btn-close" title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="cf-field">
          <label class="cf-label">Company</label>
          <input type="text" class="cf-input" id="cf-input-company" value="${escapeHtml(existingJob ? existingJob.company : currentJobData.company)}" placeholder="e.g. Google">
        </div>

        <div class="cf-field">
          <label class="cf-label">Role / Job Title</label>
          <input type="text" class="cf-input" id="cf-input-title" value="${escapeHtml(existingJob ? existingJob.title : currentJobData.title)}" placeholder="e.g. Software Engineer">
        </div>

        <div class="cf-row">
          <div class="cf-field">
            <label class="cf-label">Status</label>
            <select class="cf-select" id="cf-select-status">
              <option value="applied" ${(!existingJob || existingJob.status === 'applied') ? 'selected' : ''}>Applied</option>
              <option value="wishlist" ${existingJob?.status === 'wishlist' ? 'selected' : ''}>Wishlist</option>
              <option value="screening" ${existingJob?.status === 'screening' ? 'selected' : ''}>Screening</option>
              <option value="technical" ${existingJob?.status === 'technical' ? 'selected' : ''}>Technical</option>
              <option value="interview" ${existingJob?.status === 'interview' ? 'selected' : ''}>Interview</option>
              <option value="offer" ${existingJob?.status === 'offer' ? 'selected' : ''}>Offer</option>
              <option value="rejected" ${existingJob?.status === 'rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </div>
          <div class="cf-field">
            <label class="cf-label">Location</label>
            <input type="text" class="cf-input" id="cf-input-location" value="${escapeHtml(existingJob ? existingJob.location : currentJobData.location)}" placeholder="Remote / SF">
          </div>
        </div>

        <div class="cf-field">
          <label class="cf-label">Salary (Optional)</label>
          <input type="text" class="cf-input" id="cf-input-salary" value="${escapeHtml(existingJob ? (existingJob.salary || '') : currentJobData.salary)}" placeholder="e.g. $140k - $170k">
        </div>

        <div class="cf-field">
          <label class="cf-label">Notes</label>
          <textarea class="cf-textarea" id="cf-input-notes" rows="2" placeholder="Referrals, recruiter contact, deadlines...">${escapeHtml(existingJob ? (existingJob.notes || '') : '')}</textarea>
        </div>

        <div class="cf-card-actions">
          <button class="cf-btn-primary" id="cf-btn-save">
            ${existingJob ? 'Update Application' : 'Save & Sync to Funnel'}
          </button>
        </div>

        <div class="cf-card-footer">
          <span>Synced across all your devices</span>
          <a class="cf-dashboard-link" id="cf-link-dashboard">Open Funnel ↗</a>
        </div>
      </div>

      <div class="cf-floating-btn ${isAlready ? 'cf-already-tracked' : ''}" id="cf-floating-btn">
        <svg class="cf-floating-icon" viewBox="0 0 24 24">
          <path d="M10 2H14A2 2 0 0 1 16 4V6H20A2 2 0 0 1 22 8V19A2 2 0 0 1 20 21H4A2 2 0 0 1 2 19V8A2 2 0 0 1 4 6H8V4A2 2 0 0 1 10 2M14 6V4H10V6H14Z"/>
        </svg>
        <span id="cf-btn-text">${btnText}</span>
      </div>
    `;

    document.body.appendChild(container);

    // Event Listeners
    const floatingBtn = document.getElementById('cf-floating-btn');
    const quickCard = document.getElementById('cf-quick-card');
    const btnClose = document.getElementById('cf-btn-close');
    const btnSave = document.getElementById('cf-btn-save');
    const linkDashboard = document.getElementById('cf-link-dashboard');

    floatingBtn.addEventListener('click', () => {
      // Re-scrape if fields are empty
      if (!document.getElementById('cf-input-company').value) {
        const fresh = scrapeJobData();
        document.getElementById('cf-input-company').value = fresh.company;
        document.getElementById('cf-input-title').value = fresh.title;
        document.getElementById('cf-input-location').value = fresh.location;
        document.getElementById('cf-input-salary').value = fresh.salary;
      }
      isCardOpen = !isCardOpen;
      quickCard.classList.toggle('cf-active', isCardOpen);
    });

    btnClose.addEventListener('click', () => {
      isCardOpen = false;
      quickCard.classList.remove('cf-active');
    });

    linkDashboard.addEventListener('click', () => {
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'openDashboard' });
      } else {
        window.open(chrome.runtime.getURL('dashboard/dashboard.html'), '_blank');
      }
    });

    btnSave.addEventListener('click', async () => {
      const companyVal = document.getElementById('cf-input-company').value.trim();
      const titleVal = document.getElementById('cf-input-title').value.trim();
      const statusVal = document.getElementById('cf-select-status').value;
      const locationVal = document.getElementById('cf-input-location').value.trim();
      const salaryVal = document.getElementById('cf-input-salary').value.trim();
      const notesVal = document.getElementById('cf-input-notes').value.trim();

      if (!companyVal || !titleVal) {
        alert('Please provide at least a Company and Job Title.');
        return;
      }

      btnSave.innerText = 'Saving...';
      btnSave.disabled = true;

      try {
        const payload = {
          id: existingJob ? existingJob.id : undefined,
          company: companyVal,
          title: titleVal,
          status: statusVal,
          location: locationVal,
          salary: salaryVal,
          notes: notesVal,
          url: window.location.href,
          source: currentJobData.source,
          appliedDate: existingJob ? existingJob.appliedDate : new Date().toISOString().split('T')[0]
        };

        await CareerStorage.saveJob(payload);

        // Update button state
        document.getElementById('cf-btn-text').innerText = `✓ Tracked (${capitalize(statusVal)})`;
        floatingBtn.classList.add('cf-already-tracked');

        // Show toast
        showToast(`Saved ${companyVal} to your Career Funnel!`);

        // Close card after brief delay
        setTimeout(() => {
          isCardOpen = false;
          quickCard.classList.remove('cf-active');
          btnSave.innerText = 'Update Application';
          btnSave.disabled = false;
        }, 800);

        // Inform background worker
        if (chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'jobSaved', job: payload });
        }
      } catch (err) {
        console.error('Save error:', err);
        alert('Could not save job: ' + err.message);
        btnSave.innerText = 'Save & Sync';
        btnSave.disabled = false;
      }
    });
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'cf-toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${escapeHtml(message)}</span>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Automatic submission click listeners (e.g. LinkedIn Easy Apply or Greenhouse submit)
  function attachSubmissionListeners() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target) return;
      const text = (target.innerText || '').toLowerCase();
      const isSubmit = target.type === 'submit' ||
        text.includes('submit application') ||
        text.includes('easy apply') ||
        text.includes('apply now');

      if (isSubmit) {
        // Suggest saving or auto-open widget
        setTimeout(async () => {
          const already = await checkIfAlreadyTracked();
          if (!already) {
            const btn = document.getElementById('cf-floating-btn');
            if (btn) {
              btn.click();
            }
          }
        }, 1200);
      }
    }, true);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectWidget();
      attachSubmissionListeners();
    });
  } else {
    injectWidget();
    attachSubmissionListeners();
  }
})();
