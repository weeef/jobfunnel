/**
 * CareerFunnel - Side Panel Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const sideSearchInput = document.getElementById('sideSearchInput');
  const btnSideAdd = document.getElementById('btnSideAdd');
  const btnExpandDashboard = document.getElementById('btnExpandDashboard');
  const sideJobsList = document.getElementById('sideJobsList');

  const countApplied = document.getElementById('countApplied');
  const countScreening = document.getElementById('countScreening');
  const countInterview = document.getElementById('countInterview');
  const countOffer = document.getElementById('countOffer');

  let allJobs = [];
  let currentFilter = 'all';

  async function loadData() {
    allJobs = await CareerStorage.getAllJobs();
    renderStats();
    renderList();
  }

  function renderStats() {
    const funnel = CareerStorage.calculateFunnel(allJobs);
    countApplied.innerText = funnel.funnel.applied;
    countScreening.innerText = funnel.funnel.screening;
    countInterview.innerText = funnel.funnel.interview;
    countOffer.innerText = funnel.funnel.offer;
  }

  function renderList() {
    const query = (sideSearchInput.value || '').toLowerCase().trim();
    const filtered = allJobs.filter(j => {
      if (currentFilter !== 'all' && j.status !== currentFilter) return false;
      if (query) {
        return (j.company || '').toLowerCase().includes(query) ||
               (j.title || '').toLowerCase().includes(query);
      }
      return true;
    });

    sideJobsList.innerHTML = '';
    if (filtered.length === 0) {
      sideJobsList.innerHTML = `
        <div style="text-align: center; color: #64748b; font-size: 12px; padding: 32px 8px;">
          No applications found
        </div>
      `;
      return;
    }

    filtered.forEach(job => {
      const card = document.createElement('div');
      card.className = 'cf-side-card';
      card.innerHTML = `
        <div class="cf-side-card-top">
          <span class="cf-side-company">${escapeHtml(job.company)}</span>
          <span class="cf-side-status-pill status-${job.status}">${escapeHtml(job.status)}</span>
        </div>
        <div class="cf-side-role">${escapeHtml(job.title)}</div>
        <div class="cf-side-bottom">
          <span>${job.location || 'Remote'}</span>
          <span>${job.appliedDate || ''}</span>
        </div>
      `;

      card.addEventListener('click', async () => {
        // Open in full dashboard
        const dashboardUrl = chrome.runtime.getURL(`dashboard/dashboard.html?editId=${job.id}`);
        await chrome.tabs.create({ url: dashboardUrl });
      });

      sideJobsList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Open Full Dashboard
  btnExpandDashboard.addEventListener('click', async () => {
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
    await chrome.tabs.create({ url: dashboardUrl });
  });

  // Quick Add opens full dashboard modal
  btnSideAdd.addEventListener('click', async () => {
    const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html?action=add');
    await chrome.tabs.create({ url: dashboardUrl });
  });

  // Search input
  sideSearchInput.addEventListener('input', () => {
    renderList();
  });

  // Mini step filter clicks
  document.querySelectorAll('.cf-mini-step').forEach(step => {
    step.addEventListener('click', () => {
      const filter = step.dataset.filter;
      if (currentFilter === filter) {
        currentFilter = 'all';
        step.style.outline = 'none';
      } else {
        currentFilter = filter;
        document.querySelectorAll('.cf-mini-step').forEach(s => s.style.outline = 'none');
        step.style.outline = '1px solid #818cf8';
      }
      renderList();
    });
  });

  // Storage listener
  CareerStorage.onStorageChange(() => {
    loadData();
  });

  await loadData();
});
