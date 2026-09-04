/**
 * CareerFunnel - Storage & Cross-Device Sync Engine
 * Manages job applications via chrome.storage.sync with fallback to local and browser testing.
 */

const CareerStorage = (() => {
  const INDEX_KEY = 'cf_job_index';
  const PREFIX = 'cf_job_';
  const SETTINGS_KEY = 'cf_settings';

  // Check if Chrome extension storage is available
  const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

  /**
   * Generates a unique ID
   */
  function generateId() {
    return 'cf_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  /**
   * Get all job IDs from index
   */
  async function getIndex() {
    if (hasChromeStorage) {
      const data = await chrome.storage.sync.get(INDEX_KEY);
      return data[INDEX_KEY] || [];
    } else {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    }
  }

  /**
   * Save the job IDs index
   */
  async function saveIndex(index) {
    if (hasChromeStorage) {
      await chrome.storage.sync.set({ [INDEX_KEY]: index });
    } else {
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  }

  /**
   * Fetch all job applications
   */
  async function getAllJobs() {
    try {
      const ids = await getIndex();
      if (!ids.length) return [];

      const keys = ids.map(id => `${PREFIX}${id}`);
      let rawJobs = {};

      if (hasChromeStorage) {
        rawJobs = await chrome.storage.sync.get(keys);
      } else {
        keys.forEach(k => {
          const val = localStorage.getItem(k);
          if (val) rawJobs[k] = JSON.parse(val);
        });
      }

      const jobs = [];
      for (const id of ids) {
        const item = rawJobs[`${PREFIX}${id}`];
        if (item) {
          jobs.push(item);
        }
      }

      // Sort by lastUpdated or appliedDate descending
      jobs.sort((a, b) => new Date(b.lastUpdated || b.appliedDate) - new Date(a.lastUpdated || a.appliedDate));
      return jobs;
    } catch (err) {
      console.error('[CareerFunnel] Error fetching jobs:', err);
      // Try local fallback if sync failed
      if (hasChromeStorage && chrome.storage.local) {
        const backup = await chrome.storage.local.get('cf_backup_jobs');
        return backup.cf_backup_jobs || [];
      }
      return [];
    }
  }

  /**
   * Get a single job by ID
   */
  async function getJobById(id) {
    const key = `${PREFIX}${id}`;
    if (hasChromeStorage) {
      const data = await chrome.storage.sync.get(key);
      return data[key] || null;
    } else {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  }

  /**
   * Save or update a job application
   */
  async function saveJob(jobData) {
    const isNew = !jobData.id;
    const id = jobData.id || generateId();
    const now = new Date().toISOString();

    const job = {
      id,
      company: (jobData.company || 'Unknown Company').trim(),
      title: (jobData.title || 'Untitled Role').trim(),
      location: (jobData.location || '').trim(),
      salary: (jobData.salary || '').trim(),
      url: (jobData.url || '').trim(),
      source: jobData.source || 'other',
      status: jobData.status || 'applied', // wishlist | applied | screening | technical | interview | offer | rejected | withdrawn
      appliedDate: jobData.appliedDate || now.split('T')[0],
      lastUpdated: now,
      notes: jobData.notes || '',
      interviews: Array.isArray(jobData.interviews) ? jobData.interviews : [],
      offerDetails: jobData.offerDetails || null,
      rejectionReason: jobData.rejectionReason || '',
      tags: Array.isArray(jobData.tags) ? jobData.tags : []
    };

    const key = `${PREFIX}${id}`;

    try {
      if (hasChromeStorage) {
        // Save job entity to sync
        await chrome.storage.sync.set({ [key]: job });
        
        // Update index if new
        if (isNew) {
          const index = await getIndex();
          if (!index.includes(id)) {
            index.unshift(id);
            await saveIndex(index);
          }
        }

        // Mirror backup to local storage
        if (chrome.storage.local) {
          const all = await getAllJobs();
          await chrome.storage.local.set({ cf_backup_jobs: all });
        }
      } else {
        localStorage.setItem(key, JSON.stringify(job));
        if (isNew) {
          const index = await getIndex();
          if (!index.includes(id)) {
            index.unshift(id);
            await saveIndex(index);
          }
        }
      }

      return job;
    } catch (err) {
      console.error('[CareerFunnel] Save error (possible quota limit):', err);
      // Fallback save to local storage
      if (hasChromeStorage && chrome.storage.local) {
        await chrome.storage.local.set({ [key]: job });
      }
      throw err;
    }
  }

  /**
   * Delete a job by ID
   */
  async function deleteJob(id) {
    const key = `${PREFIX}${id}`;
    const index = await getIndex();
    const newIndex = index.filter(i => i !== id);

    if (hasChromeStorage) {
      await chrome.storage.sync.remove(key);
      await saveIndex(newIndex);
      if (chrome.storage.local) {
        await chrome.storage.local.remove(key);
      }
    } else {
      localStorage.removeItem(key);
      await saveIndex(newIndex);
    }
    return true;
  }

  /**
   * Quick status change (used by Kanban drag-and-drop)
   */
  async function updateStatus(id, newStatus) {
    const job = await getJobById(id);
    if (!job) return null;
    job.status = newStatus;
    job.lastUpdated = new Date().toISOString();
    return await saveJob(job);
  }

  /**
   * Calculate Funnel Statistics
   */
  function calculateFunnel(jobs) {
    const counts = {
      total: jobs.length,
      wishlist: 0,
      applied: 0,
      screening: 0,
      technical: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      withdrawn: 0,
      activePipelines: 0
    };

    jobs.forEach(j => {
      if (counts[j.status] !== undefined) {
        counts[j.status]++;
      }
      if (['applied', 'screening', 'technical', 'interview'].includes(j.status)) {
        counts.activePipelines++;
      }
    });

    // Funnel progressive reach:
    // Any candidate at offer reached interview, tech, screen, applied
    // Any candidate at interview reached tech, screen, applied, etc.
    const reachedApplied = jobs.filter(j => j.status !== 'wishlist').length;
    const reachedScreening = jobs.filter(j => ['screening', 'technical', 'interview', 'offer'].includes(j.status) || (j.status === 'rejected' && j.interviews?.length > 0)).length;
    const reachedInterview = jobs.filter(j => ['technical', 'interview', 'offer'].includes(j.status)).length;
    const reachedFinal = jobs.filter(j => ['interview', 'offer'].includes(j.status)).length;
    const reachedOffer = counts.offer;

    // Conversion rates
    const appliedToScreenRate = reachedApplied > 0 ? Math.round((reachedScreening / reachedApplied) * 100) : 0;
    const screenToInterviewRate = reachedScreening > 0 ? Math.round((reachedInterview / reachedScreening) * 100) : 0;
    const interviewToOfferRate = reachedInterview > 0 ? Math.round((reachedOffer / reachedInterview) * 100) : 0;
    const totalConversionRate = reachedApplied > 0 ? Math.round((reachedOffer / reachedApplied) * 100) : 0;

    return {
      counts,
      funnel: {
        applied: reachedApplied,
        screening: reachedScreening,
        interview: reachedInterview,
        final: reachedFinal,
        offer: reachedOffer,
        rates: {
          appliedToScreen: appliedToScreenRate,
          screenToInterview: screenToInterviewRate,
          interviewToOffer: interviewToOfferRate,
          overall: totalConversionRate
        }
      }
    };
  }

  /**
   * Check sync storage usage and quota
   */
  async function getSyncUsage() {
    if (hasChromeStorage && chrome.storage.sync.getBytesInUse) {
      const bytes = await chrome.storage.sync.getBytesInUse(null);
      const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB
      return {
        bytesInUse: bytes,
        quotaBytes: quota,
        percentUsed: Math.min(100, Math.round((bytes / quota) * 100))
      };
    }
    return { bytesInUse: 0, quotaBytes: 102400, percentUsed: 0 };
  }

  /**
   * Export all jobs to JSON
   */
  async function exportJSON() {
    const jobs = await getAllJobs();
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      jobs
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export all jobs to CSV
   */
  async function exportCSV() {
    const jobs = await getAllJobs();
    const headers = ['Company', 'Job Title', 'Status', 'Date Applied', 'Location', 'Salary', 'Source', 'URL', 'Notes'];
    const rows = jobs.map(j => [
      `"${(j.company || '').replace(/"/g, '""')}"`,
      `"${(j.title || '').replace(/"/g, '""')}"`,
      `"${j.status}"`,
      `"${j.appliedDate}"`,
      `"${(j.location || '').replace(/"/g, '""')}"`,
      `"${(j.salary || '').replace(/"/g, '""')}"`,
      `"${j.source}"`,
      `"${(j.url || '').replace(/"/g, '""')}"`,
      `"${(j.notes || '').replace(/"/g, '""')}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Import jobs from JSON
   */
  async function importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    const jobsToImport = Array.isArray(parsed) ? parsed : (parsed.jobs || []);
    let count = 0;
    for (const item of jobsToImport) {
      if (item.company && item.title) {
        await saveJob(item);
        count++;
      }
    }
    return count;
  }

  /**
   * Load Realistic Demo Data for initial wow factor and pipeline testing
   */
  async function loadDemoData() {
    const demoJobs = [
      {
        company: 'Stripe',
        title: 'Senior Frontend Engineer',
        location: 'Remote (US)',
        salary: '$180,000 - $220,000',
        url: 'https://stripe.com/jobs',
        source: 'greenhouse',
        status: 'offer',
        appliedDate: '2026-08-10',
        notes: 'Great team culture. Received written offer, reviewing benefits package!',
        offerDetails: {
          baseSalary: '$195,000',
          bonus: '15% annual target',
          equity: '$120,000 over 4 yrs',
          deadline: '2026-09-15',
          notes: 'Competitive 401(k) match and wellness stipend.'
        },
        interviews: [
          { title: 'Recruiter Screen', date: '2026-08-14', completed: true },
          { title: 'System Architecture', date: '2026-08-20', completed: true },
          { title: 'Virtual Onsite (4 rounds)', date: '2026-08-28', completed: true }
        ]
      },
      {
        company: 'Figma',
        title: 'Staff UI Systems Engineer',
        location: 'San Francisco, CA / Hybrid',
        salary: '$210,000 - $250,000',
        url: 'https://figma.com/careers',
        source: 'linkedin',
        status: 'interview',
        appliedDate: '2026-08-15',
        notes: 'Final presentation round scheduled with VP of Product Design next Tuesday.',
        interviews: [
          { title: 'Recruiter Chat', date: '2026-08-18', completed: true },
          { title: 'Canvas Performance Deep-Dive', date: '2026-08-25', completed: true },
          { title: 'Final Executive Presentation', date: '2026-09-08', completed: false }
        ]
      },
      {
        company: 'Vercel',
        title: 'Full Stack Engineer, Next.js',
        location: 'Remote',
        salary: '$165,000 - $195,000',
        url: 'https://vercel.com/careers',
        source: 'lever',
        status: 'technical',
        appliedDate: '2026-08-22',
        notes: 'Take-home assignment completed and submitted. Awaiting code review meeting.',
        interviews: [
          { title: 'Hiring Manager Screen', date: '2026-08-26', completed: true },
          { title: 'Pair Programming & Take-home review', date: '2026-09-07', completed: false }
        ]
      },
      {
        company: 'Linear',
        title: 'Product Engineer',
        location: 'Remote (Global)',
        salary: '$170,000 - $210,000',
        url: 'https://linear.app/careers',
        source: 'other',
        status: 'screening',
        appliedDate: '2026-08-29',
        notes: 'Phone chat with founder scheduled for Thursday 2pm EST.',
        interviews: [
          { title: 'Introductory Call', date: '2026-09-10', completed: false }
        ]
      },
      {
        company: 'Datadog',
        title: 'Software Engineer II, Core Dashboards',
        location: 'New York, NY',
        salary: '$155,000 - $185,000',
        url: 'https://boards.greenhouse.io/datadog',
        source: 'greenhouse',
        status: 'applied',
        appliedDate: '2026-09-01',
        notes: 'Applied via Greenhouse referral from alumni network.'
      },
      {
        company: 'Cloudflare',
        title: 'Systems & Web Platform Engineer',
        location: 'Austin, TX / Remote',
        salary: '$160,000 - $190,000',
        url: 'https://cloudflare.com/careers',
        source: 'greenhouse',
        status: 'applied',
        appliedDate: '2026-09-02',
        notes: 'Applied on official careers portal. Waiting for recruiter review.'
      },
      {
        company: 'Anthropic',
        title: 'Frontend Platform Engineer',
        location: 'San Francisco, CA',
        salary: '$220,000 - $280,000',
        url: 'https://jobs.ashbyhq.com/anthropic',
        source: 'ashby',
        status: 'wishlist',
        appliedDate: '2026-09-04',
        notes: 'Tailoring portfolio with WebAssembly and interactive agent demo before applying.'
      },
      {
        company: 'Meta',
        title: 'Software Engineer, Messenger Web',
        location: 'Menlo Park, CA',
        salary: '$175,000 - $215,000',
        url: 'https://metacareers.com',
        source: 'linkedin',
        status: 'rejected',
        appliedDate: '2026-07-28',
        notes: 'Automated rejection after initial resume scan. Re-evaluate in 6 months.',
        rejectionReason: 'Position filled internally'
      },
      {
        company: 'Airbnb',
        title: 'Senior Software Engineer, Host Tools',
        location: 'Remote',
        salary: '$190,000 - $235,000',
        url: 'https://airbnb.com/careers',
        source: 'linkedin',
        status: 'offer',
        appliedDate: '2026-08-01',
        notes: 'Second offer! Total compensation $245k with equity.',
        offerDetails: {
          baseSalary: '$190,000',
          bonus: '12%',
          equity: '$140,000 / 4 yrs',
          deadline: '2026-09-18'
        },
        interviews: [
          { title: 'Recruiter Chat', date: '2026-08-05', completed: true },
          { title: 'Coding Interview (Algorithms)', date: '2026-08-12', completed: true },
          { title: 'System Design & Values Onsite', date: '2026-08-22', completed: true }
        ]
      }
    ];

    for (const job of demoJobs) {
      await saveJob(job);
    }
    return demoJobs.length;
  }

  /**
   * Clear all job applications (with caution)
   */
  async function clearAll() {
    const ids = await getIndex();
    const keys = ids.map(id => `${PREFIX}${id}`);
    keys.push(INDEX_KEY);

    if (hasChromeStorage) {
      await chrome.storage.sync.remove(keys);
      if (chrome.storage.local) {
        await chrome.storage.local.remove(['cf_backup_jobs', ...keys]);
      }
    } else {
      keys.forEach(k => localStorage.removeItem(k));
    }
    return true;
  }

  /**
   * Register listener for storage changes across tabs and synced devices
   */
  function onStorageChange(callback) {
    if (hasChromeStorage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') {
          callback(changes);
        }
      });
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('cf_')) {
          callback({ [e.key]: { newValue: e.newValue } });
        }
      });
    }
  }

  return {
    getAllJobs,
    getJobById,
    saveJob,
    deleteJob,
    updateStatus,
    calculateFunnel,
    getSyncUsage,
    exportJSON,
    exportCSV,
    importJSON,
    loadDemoData,
    clearAll,
    onStorageChange
  };
})();

// Export for Node/CommonJS environments if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CareerStorage;
}
