/**
 * CareerFunnel - Background Service Worker (Manifest V3)
 * Handles cross-tab communication, badge updates, context menus, and dashboard navigation.
 */

// Initialize on install or update
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[CareerFunnel] Installed/Updated:', details.reason);

  // Create context menu for quick tracking on any web page
  try {
    chrome.contextMenus.create({
      id: 'cf_track_page',
      title: 'Track this Job with CareerFunnel',
      contexts: ['page', 'selection', 'link']
    });
  } catch (e) {
    // ignore duplicate menu creation
  }

  // Update badge counter
  await updateBadge();

  // Schedule GitHub update checker
  chrome.alarms.create('cf_check_update', { periodInMinutes: 240 });
  await checkForGitHubUpdates();
});

// Alarm listener for recurring checks
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cf_check_update') {
    await checkForGitHubUpdates();
  }
});

// Check if a newer version exists in the GitHub repository
async function checkForGitHubUpdates() {
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const res = await fetch('https://raw.githubusercontent.com/weeef/jobfunnel/main/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const remoteManifest = await res.json();
    if (remoteManifest?.version && isNewerVersion(remoteManifest.version, currentVersion)) {
      console.log(`[CareerFunnel] New update found on GitHub: ${remoteManifest.version} (current: ${currentVersion})`);
      await chrome.storage.local.set({
        cf_update_info: {
          available: true,
          latestVersion: remoteManifest.version,
          currentVersion: currentVersion,
          repoUrl: 'https://github.com/weeef/jobfunnel'
        }
      });
      // Set badge indicator
      await chrome.action.setBadgeText({ text: 'NEW' });
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      await chrome.storage.local.remove('cf_update_info');
    }
  } catch (err) {
    // Network offline or GitHub rate limit, fail silently
  }
}

function isNewerVersion(remote, current) {
  const r = remote.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0;
    const cv = c[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}


// Update extension icon badge with count of active interviews / applications
async function updateBadge() {
  try {
    const data = await chrome.storage.sync.get('cf_job_index');
    const ids = data.cf_job_index || [];
    if (ids.length > 0) {
      // Set badge with total tracked
      await chrome.action.setBadgeText({ text: String(ids.length) });
      await chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (err) {
    console.warn('[CareerFunnel] Badge update error:', err);
  }
}

// Listen to storage changes to keep badge updated
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.cf_job_index) {
    updateBadge();
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'cf_track_page' && tab?.id) {
    // Open dashboard with pre-filled URL or trigger script
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html?newUrl=' + encodeURIComponent(tab.url || ''));
    await chrome.tabs.create({ url: dashboardUrl });
  }
});

// Handle message routing between content scripts, popup, side panel, and dashboard
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'openDashboard') {
        const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
        // Check if dashboard tab is already open
        const tabs = await chrome.tabs.query({ url: dashboardUrl + '*' });
        if (tabs.length > 0) {
          await chrome.tabs.update(tabs[0].id, { active: true });
          if (tabs[0].windowId) {
            await chrome.windows.update(tabs[0].windowId, { focused: true });
          }
        } else {
          await chrome.tabs.create({ url: dashboardUrl });
        }
        sendResponse({ success: true });
      } else if (message.action === 'openSidePanel') {
        if (sender.tab?.windowId) {
          await chrome.sidePanel.open({ windowId: sender.tab.windowId });
        } else {
          const currentWindow = await chrome.windows.getCurrent();
          await chrome.sidePanel.open({ windowId: currentWindow.id });
        }
        sendResponse({ success: true });
      } else if (message.action === 'jobSaved') {
        await updateBadge();
        // Send a native notification if available
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icons/icon-128.png',
            title: 'CareerFunnel: Application Saved',
            message: `${message.job.title} at ${message.job.company} was logged to your funnel.`
          });
        } catch (e) {
          // Notifications might be denied, continue safely
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ received: true });
      }
    } catch (err) {
      console.error('[CareerFunnel] Service worker message error:', err);
      sendResponse({ error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});
