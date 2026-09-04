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

  // Get current active tab
  if (chrome?.tabs) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
    if (tab?.title) {
      tabTitle.innerText = tab.title;
    } else {
      tabTitle.innerText = 'No active webpage';
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
      // Parse clean company & role from title
      let company = 'Company';
      let title = activeTab.title || 'Job Opportunity';

      if (title.includes(' at ')) {
        const parts = title.split(' at ');
        title = parts[0].trim();
        company = parts[1].split('|')[0].split('-')[0].trim();
      } else if (title.includes(' - ')) {
        const parts = title.split(' - ');
        title = parts[0].trim();
        company = parts[1].split('|')[0].trim();
      }

      await CareerStorage.saveJob({
        company,
        title,
        status: 'applied',
        url: activeTab.url,
        source: 'other'
      });

      btnTrackCurrentTab.innerText = '✓ Tracked!';
      btnTrackCurrentTab.style.background = 'rgba(16, 185, 129, 0.3)';
      btnTrackCurrentTab.style.borderColor = 'rgba(16, 185, 129, 0.5)';
      btnTrackCurrentTab.style.color = '#34d399';

      setTimeout(() => {
        window.close();
      }, 1000);
    } catch (err) {
      alert('Error tracking job: ' + err.message);
      btnTrackCurrentTab.disabled = false;
      btnTrackCurrentTab.innerText = 'Track this Job';
    }
  });
});
