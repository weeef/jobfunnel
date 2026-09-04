/**
 * CareerFunnel - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const popStatApplied = document.getElementById('popStatApplied');
  const popStatInterviews = document.getElementById('popStatInterviews');
  const popStatOffers = document.getElementById('popStatOffers');
  const tabTitle = document.getElementById('tabTitle');
  const btnTrackCurrentTab = document.getElementById('btnTrackCurrentTab');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnOpenSidePanel = document.getElementById('btnOpenSidePanel');

  let activeTab = null;

  // Load stats
  try {
    const jobs = await CareerStorage.getAllJobs();
    const funnel = CareerStorage.calculateFunnel(jobs);
    popStatApplied.innerText = funnel.funnel.applied;
    popStatInterviews.innerText = funnel.funnel.interview;
    popStatOffers.innerText = funnel.funnel.offer;
  } catch (err) {
    console.error('Error loading popup stats:', err);
  }

  let detectedJob = null;

  // Get current active tab and ask content script for scraped job data
  if (chrome?.tabs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;

    if (tab?.id && tab.url && !tab.url.startsWith('chrome://')) {
      tabTitle.innerText = tab.title || 'Job Page';

      try {
        // Send message to content script to get detailed scraped data
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrapeJob' });
        if (response?.job) {
          detectedJob = response.job;
          if (detectedJob.company && detectedJob.title) {
            tabTitle.innerText = `${detectedJob.company} — ${detectedJob.title}`;
          }

          const tabDetails = document.getElementById('tabDetails');
          if (tabDetails) {
            const meta = [];
            if (detectedJob.location) meta.push(`📍 ${detectedJob.location}`);
            if (detectedJob.salary) meta.push(`💰 ${detectedJob.salary}`);
            if (meta.length > 0) {
              tabDetails.innerText = meta.join('  •  ');
              tabDetails.style.display = 'block';
            }
          }
        }
      } catch (e) {
        // Content script might not be injected on this page yet, fallback to title parsing
      }
    } else {
      tabTitle.innerText = 'No active webpage';
      btnTrackCurrentTab.disabled = true;
    }
  }

  // Open Full Dashboard
  btnOpenDashboard.addEventListener('click', async () => {
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
    await chrome.tabs.create({ url: dashboardUrl });
    window.close();
  });

  // Open Side Panel
  btnOpenSidePanel.addEventListener('click', async () => {
    try {
      const win = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: win.id });
      window.close();
    } catch (err) {
      console.error('Failed to open side panel:', err);
    }
  });

  // Track Current Tab
  btnTrackCurrentTab.addEventListener('click', async () => {
    if (!activeTab?.url) return;

    btnTrackCurrentTab.disabled = true;
    btnTrackCurrentTab.innerText = 'Tracking...';

    try {
      let company = detectedJob?.company;
      let title = detectedJob?.title;
      let location = detectedJob?.location || '';
      let salary = detectedJob?.salary || '';
      let source = detectedJob?.source || 'other';

      // Fallback parsing from page title if content script wasn't active
      if (!company || !title) {
        const rawTitle = activeTab.title || 'Job Opportunity';
        if (rawTitle.includes(' at ')) {
          const parts = rawTitle.split(' at ');
          title = parts[0].trim();
          company = parts[1].split('|')[0].split('-')[0].trim();
        } else if (rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          title = parts[0].trim();
          company = parts[1].split('|')[0].trim();
        } else {
          company = 'Company';
          title = rawTitle;
        }
      }

      await CareerStorage.saveJob({
        company,
        title,
        location,
        salary,
        status: 'applied',
        url: activeTab.url,
        source
      });

      btnTrackCurrentTab.innerText = '✓ Tracked!';
      btnTrackCurrentTab.style.background = 'rgba(16, 185, 129, 0.3)';
      btnTrackCurrentTab.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      btnTrackCurrentTab.style.color = '#34d399';

      setTimeout(() => {
        window.close();
      }, 900);
    } catch (err) {
      alert('Error tracking job: ' + err.message);
      btnTrackCurrentTab.disabled = false;
      btnTrackCurrentTab.innerText = 'Track this Job';
    }
  });

});
