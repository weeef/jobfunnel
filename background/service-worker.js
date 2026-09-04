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
});

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
