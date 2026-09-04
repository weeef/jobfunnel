/**
 * CareerFunnel - Dashboard Controller
 * Powers the interactive Funnel visualizer, Kanban board, cross-device sync listeners, and modal management.
 */

(() => {
  // Global State
  let allJobs = [];
  let filteredJobs = [];
  let activeStageFilter = 'all'; // 'all' or specific stage
  let activeSearchQuery = '';
  let activeSourceFilter = 'all';
  let activeOnlyFilter = false;
  let jobToDeleteId = null;

  // DOM Elements
  const searchInput = document.getElementById('searchInput');
  const filterSource = document.getElementById('filterSource');
  const btnDemoData = document.getElementById('btnDemoData');
  const btnDataMenu = document.getElementById('btnDataMenu');
  const dataDropdown = document.getElementById('dataDropdown');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnImportJSON = document.getElementById('btnImportJSON');
  const fileImportJSON = document.getElementById('fileImportJSON');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnDirectClearAll = document.getElementById('btnDirectClearAll');
  const btnOpenAddModal = document.getElementById('btnOpenAddModal');

  // Stats
  const statTotalJobs = document.getElementById('statTotalJobs');
  const statActiveJobs = document.getElementById('statActiveJobs');
  const statInterviewRate = document.getElementById('statInterviewRate');
  const statTotalOffers = document.getElementById('statTotalOffers');
  const statOfferConversionRate = document.getElementById('statOfferConversionRate');

  // Funnel
  const funnelCountApplied = document.getElementById('funnelCountApplied');
  const funnelCountScreening = document.getElementById('funnelCountScreening');
  const funnelCountInterview = document.getElementById('funnelCountInterview');
  const funnelCountOffer = document.getElementById('funnelCountOffer');
  const funnelBarApplied = document.getElementById('funnelBarApplied');
  const funnelBarScreening = document.getElementById('funnelBarScreening');
  const funnelBarInterview = document.getElementById('funnelBarInterview');
  const funnelBarOffer = document.getElementById('funnelBarOffer');
  const barTextScreening = document.getElementById('barTextScreening');
  const barTextInterview = document.getElementById('barTextInterview');
  const barTextOffer = document.getElementById('barTextOffer');
  const rateAppliedToScreen = document.getElementById('rateAppliedToScreen');
  const rateScreenToInterview = document.getElementById('rateScreenToInterview');
  const rateInterviewToOffer = document.getElementById('rateInterviewToOffer');
  const dropoffApplied = document.getElementById('dropoffApplied');
  const dropoffScreening = document.getElementById('dropoffScreening');
  const dropoffInterview = document.getElementById('dropoffInterview');
  const branchRejectionsCount = document.getElementById('branchRejectionsCount');
  const rejectionPills = document.getElementById('rejectionPills');

  // Board
  const kanbanBoard = document.getElementById('kanbanBoard');

  // Modal
  const jobModal = document.getElementById('jobModal');
  const modalTitle = document.getElementById('modalTitle');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const jobForm = document.getElementById('jobForm');
  const formStatus = document.getElementById('formStatus');
  const offerSection = document.getElementById('offerSection');
  const btnAddInterviewRound = document.getElementById('btnAddInterviewRound');
  const interviewRoundsList = document.getElementById('interviewRoundsList');

  // Confirm Dialog
  const confirmDialog = document.getElementById('confirmDialog');
  const btnConfirmCancel = document.getElementById('btnConfirmCancel');
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');

  // Columns definition for the pipeline
  const STAGES = [
    { key: 'wishlist', label: 'Wishlist / Saved', color: 'var(--stage-wishlist)' },
    { key: 'applied', label: 'Applied', color: 'var(--stage-applied)' },
    { key: 'screening', label: 'Recruiter Screen', color: 'var(--stage-screening)' },
    { key: 'technical', label: 'Tech Assessment', color: 'var(--stage-technical)' },
    { key: 'interview', label: 'Final Rounds', color: 'var(--stage-interview)' },
    { key: 'offer', label: 'Offers 🎉', color: 'var(--stage-offer)' }
  ];

  /**
   * Initialize Dashboard
   */
  async function init() {
    setupEventListeners();
    await loadJobs();
    await updateSyncIndicator();

    // Check if opened with query parameters (e.g. from context menu, side panel, or shortcuts)
    const params = new URLSearchParams(window.location.search);
    const newUrl = params.get('newUrl');
    const action = params.get('action');
    const editId = params.get('editId');

    if (editId) {
      const targetJob = allJobs.find(j => j.id === editId);
      if (targetJob) openModal(targetJob);
    } else if (action === 'add') {
      openModal();
    } else if (newUrl) {
      openModal();
      document.getElementById('formUrl').value = newUrl;
    }

    // Real-time listener for cross-device sync updates
    CareerStorage.onStorageChange(() => {
      console.log('[CareerFunnel] Real-time sync update detected, refreshing...');
      loadJobs();
      updateSyncIndicator();
    });
  }

  /**
   * Fetch all jobs and render
   */
  async function loadJobs() {
    allJobs = await CareerStorage.getAllJobs();
    applyFiltersAndRender();
  }

  /**
   * Update sync indicator status pill
   */
  async function updateSyncIndicator() {
    const usage = await CareerStorage.getSyncUsage();
    const badgeText = document.getElementById('syncStatusText');
    if (badgeText) {
      badgeText.innerText = `Chrome Sync (${usage.percentUsed}% storage)`;
    }
  }

  /**
   * Apply Search & Filter criteria, then re-render
   */
  function applyFiltersAndRender() {
    filteredJobs = allJobs.filter(job => {
      // Search text match
      if (activeSearchQuery) {
        const q = activeSearchQuery.toLowerCase();
        const matchCompany = (job.company || '').toLowerCase().includes(q);
        const matchTitle = (job.title || '').toLowerCase().includes(q);
        const matchLoc = (job.location || '').toLowerCase().includes(q);
        const matchNotes = (job.notes || '').toLowerCase().includes(q);
        if (!matchCompany && !matchTitle && !matchLoc && !matchNotes) return false;
      }

      // Source filter
      if (activeSourceFilter !== 'all') {
        if (job.source !== activeSourceFilter) return false;
      }

      // Active Only filter
      if (activeOnlyFilter) {
        if (['rejected', 'withdrawn'].includes(job.status)) return false;
      }

      // Stage filter from funnel click
      if (activeStageFilter !== 'all') {
        if (job.status !== activeStageFilter) return false;
      }

      return true;
    });

    renderStats();
    renderFunnel();
    renderKanban();
  }

  /**
   * Render Top Quick Stats
   */
  function renderStats() {
    const funnelData = CareerStorage.calculateFunnel(allJobs);
    statTotalJobs.innerText = funnelData.counts.total;
    statActiveJobs.innerText = funnelData.counts.activePipelines;
    statInterviewRate.innerText = `${funnelData.funnel.rates.appliedToScreen}%`;
    statTotalOffers.innerText = funnelData.counts.offer;
    statOfferConversionRate.innerText = `${funnelData.funnel.rates.overall}% conversion from applied`;
  }

  /**
   * Render Recruitment Funnel Visualizer
   */
  function renderFunnel() {
    const data = CareerStorage.calculateFunnel(allJobs);
    const f = data.funnel;
    const c = data.counts;

    funnelCountApplied.innerText = f.applied;
    funnelCountScreening.innerText = f.screening;
    funnelCountInterview.innerText = f.interview;
    funnelCountOffer.innerText = f.offer;

    // Relative bar widths compared to total applied
    const base = f.applied || 1;
    const screenWidth = Math.max(12, Math.round((f.screening / base) * 100));
    const interviewWidth = Math.max(12, Math.round((f.interview / base) * 100));
    const offerWidth = Math.max(12, Math.round((f.offer / base) * 100));

    funnelBarApplied.style.width = '100%';
    funnelBarScreening.style.width = `${screenWidth}%`;
    funnelBarInterview.style.width = `${interviewWidth}%`;
    funnelBarOffer.style.width = `${offerWidth}%`;

    barTextScreening.innerText = `${screenWidth}% reach`;
    barTextInterview.innerText = `${interviewWidth}% reach`;
    barTextOffer.innerText = `${offerWidth}% reach`;

    rateAppliedToScreen.innerText = `${f.rates.appliedToScreen}%`;
    rateScreenToInterview.innerText = `${f.rates.screenToInterview}%`;
    rateInterviewToOffer.innerText = `${f.rates.interviewToOffer}%`;

    // Dropoffs
    const dropApplied = Math.max(0, f.applied - f.screening);
    const dropScreening = Math.max(0, f.screening - f.interview);
    const dropInterview = Math.max(0, f.interview - f.offer);

    dropoffApplied.innerText = `${dropApplied} drop-offs`;
    dropoffScreening.innerText = `${dropScreening} rejected`;
    dropoffInterview.innerText = `${dropInterview} post-interview`;

    // Closed / Rejections Branch
    const rejections = allJobs.filter(j => ['rejected', 'withdrawn'].includes(j.status));
    branchRejectionsCount.innerText = rejections.length;

    rejectionPills.innerHTML = '';
    if (rejections.length === 0) {
      rejectionPills.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">No rejected applications</span>';
    } else {
      rejections.slice(0, 8).forEach(r => {
        const pill = document.createElement('span');
        pill.className = 'cf-closed-pill';
        pill.innerText = `${r.company} (${r.title})`;
        pill.title = r.notes || r.rejectionReason || 'No notes';
        rejectionPills.appendChild(pill);
      });
      if (rejections.length > 8) {
        const more = document.createElement('span');
        more.className = 'cf-closed-pill';
        more.innerText = `+${rejections.length - 8} more`;
        rejectionPills.appendChild(more);
      }
    }
  }

  /**
   * Render Kanban Pipeline Board
   */
  function renderKanban() {
    kanbanBoard.innerHTML = '';

    STAGES.forEach(stage => {
      const stageJobs = filteredJobs.filter(j => j.status === stage.key);

      const col = document.createElement('div');
      col.className = 'cf-kanban-column';
      col.dataset.stage = stage.key;

      col.innerHTML = `
        <div class="cf-col-header">
          <div class="cf-col-title-wrap">
            <span class="cf-dot" style="background: ${stage.color}"></span>
            <span class="cf-col-title">${stage.label}</span>
          </div>
          <span class="cf-col-badge">${stageJobs.length}</span>
        </div>
        <div class="cf-col-cards" data-stage="${stage.key}">
          <!-- Cards injected here -->
        </div>
      `;

      const cardsContainer = col.querySelector('.cf-col-cards');

      const EMPTY_MESSAGES = {
        wishlist: "The 'maybe once I hype myself up' pile ☕",
        applied: "Sent into the resume black hole. Godspeed 🚀",
        screening: "Recruiter screening vibes incoming 📞",
        technical: "LeetCode medium prayers go here 💻",
        interview: "Final rounds! Stay hydrated & impress the VP ✨",
        offer: "Manifesting that sweet offer letter 🏆"
      };

      if (stageJobs.length === 0) {
        cardsContainer.innerHTML = `
          <div style="padding: 28px 12px; text-align: center; color: var(--text-muted); font-size: 12px; font-style: italic; line-height: 1.4;">
            ${EMPTY_MESSAGES[stage.key] || 'No applications'}
          </div>
        `;
      } else {
        stageJobs.forEach(job => {
          const card = createJobCard(job);
          cardsContainer.appendChild(card);
        });
      }

      // Drag & Drop event listeners for column
      setupColumnDragEvents(cardsContainer, stage.key);
      kanbanBoard.appendChild(col);
    });
  }

  /**
   * Create an interactive Job Card
   */
  function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'cf-job-card';
    card.draggable = true;
    card.dataset.jobId = job.id;

    // Calculate days ago
    const daysAgo = calculateDaysAgo(job.appliedDate);

    // Source class
    const sourceClass = (job.source || 'other').toLowerCase();

    // Check for upcoming interview
    let interviewBadge = '';
    if (job.interviews && job.interviews.length > 0) {
      const nextRound = job.interviews.find(i => !i.completed) || job.interviews[job.interviews.length - 1];
      if (nextRound) {
        interviewBadge = `
          <div class="cf-card-interview-pill">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${escapeHtml(nextRound.title || 'Round')}: ${nextRound.date || 'TBD'}</span>
          </div>
        `;
      }
    }

    // Offer badge
    let offerBadge = '';
    if (job.status === 'offer' && job.offerDetails?.baseSalary) {
      offerBadge = `
        <div class="cf-card-interview-pill" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.3);">
          <span>Offer: ${escapeHtml(job.offerDetails.baseSalary)}</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="cf-card-top">
        <span class="cf-card-company">${escapeHtml(job.company)}</span>
        <span class="cf-card-source ${sourceClass}">${escapeHtml(job.source)}</span>
      </div>

      <div class="cf-card-role">${escapeHtml(job.title)}</div>

      <div class="cf-card-meta">
        ${job.location ? `<span class="cf-meta-pill">📍 ${escapeHtml(job.location)}</span>` : ''}
        ${job.salary ? `<span class="cf-meta-pill cf-meta-salary">💰 ${escapeHtml(job.salary)}</span>` : ''}
      </div>

      ${interviewBadge}
      ${offerBadge}

      <div class="cf-card-footer">
        <span>${daysAgo}</span>
        <div class="cf-card-actions-quick">
          ${job.url ? `
            <a href="${escapeHtml(job.url)}" target="_blank" class="cf-action-icon-btn" title="Open Job Link">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </a>
          ` : ''}
          <button class="cf-action-icon-btn btn-edit-job" data-id="${job.id}" title="Edit / Details">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="cf-action-icon-btn btn-delete-job" data-id="${job.id}" title="Delete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Drag start / end
    card.addEventListener('dragstart', (e) => {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', job.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    // Quick action buttons
    card.querySelector('.btn-edit-job').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(job);
    });

    card.querySelector('.btn-delete-job').addEventListener('click', (e) => {
      e.stopPropagation();
      promptDelete(job.id, `${job.title} at ${job.company}`);
    });

    // Click card to open edit
    card.addEventListener('click', () => {
      openModal(job);
    });

    return card;
  }

  /**
   * Drag & Drop between Kanban columns
   */
  function setupColumnDragEvents(container, targetStage) {
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.closest('.cf-kanban-column').classList.add('drag-over');
    });

    container.addEventListener('dragleave', () => {
      container.closest('.cf-kanban-column').classList.remove('drag-over');
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      container.closest('.cf-kanban-column').classList.remove('drag-over');
      const jobId = e.dataTransfer.getData('text/plain');
      if (!jobId) return;

      const job = allJobs.find(j => j.id === jobId);
      if (job && job.status !== targetStage) {
        job.status = targetStage;
        await CareerStorage.updateStatus(jobId, targetStage);
        if (targetStage === 'offer') {
          fireCelebration();
        }
        applyFiltersAndRender();
      }
    });
  }

  /**
   * Pure Canvas Confetti Burst Celebration
   */
  function fireCelebration() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#3b82f6', '#14b8a6', '#fbbf24'];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.85) * 18,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.02 + 0.015
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35;
        p.alpha -= p.decay;
        if (p.alpha > 0) {
          alive = true;
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      if (alive) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    }
    animate();
  }

  /**
   * Open Add/Edit Modal
   */
  function openModal(job = null) {
    interviewRoundsList.innerHTML = '';

    if (job) {
      modalTitle.innerText = `Edit: ${job.company}`;
      document.getElementById('jobFormId').value = job.id;
      document.getElementById('formCompany').value = job.company || '';
      document.getElementById('formTitle').value = job.title || '';
      document.getElementById('formStatus').value = job.status || 'applied';
      document.getElementById('formAppliedDate').value = job.appliedDate || '';
      document.getElementById('formLocation').value = job.location || '';
      document.getElementById('formSalary').value = job.salary || '';
      document.getElementById('formSource').value = job.source || 'other';
      document.getElementById('formUrl').value = job.url || '';
      document.getElementById('formNotes').value = job.notes || '';

      // Interviews
      if (Array.isArray(job.interviews)) {
        job.interviews.forEach(round => addInterviewRoundRow(round));
      }

      // Offer details
      if (job.offerDetails) {
        document.getElementById('formOfferBase').value = job.offerDetails.baseSalary || '';
        document.getElementById('formOfferBonus').value = job.offerDetails.bonus || '';
        document.getElementById('formOfferDeadline').value = job.offerDetails.deadline || '';
      }
    } else {
      modalTitle.innerText = 'Track New Job Application';
      jobForm.reset();
      document.getElementById('jobFormId').value = '';
      document.getElementById('formAppliedDate').value = new Date().toISOString().split('T')[0];
    }

    toggleOfferSection(formStatus.value === 'offer');
    jobModal.classList.add('active');
  }

  function closeModal() {
    jobModal.classList.remove('active');
  }

  function toggleOfferSection(show) {
    offerSection.style.display = show ? 'block' : 'none';
  }

  function addInterviewRoundRow(round = { title: '', date: '', completed: false }) {
    const row = document.createElement('div');
    row.className = 'cf-round-row';
    row.innerHTML = `
      <input type="text" class="round-name" placeholder="Round name (e.g. Technical Screen)" value="${escapeHtml(round.title || '')}">
      <input type="date" class="round-date" value="${round.date || ''}">
      <button type="button" class="cf-action-icon-btn btn-remove-round" title="Remove">✕</button>
    `;

    row.querySelector('.btn-remove-round').addEventListener('click', () => {
      row.remove();
    });

    interviewRoundsList.appendChild(row);
  }

  /**
   * Prompt confirmation to delete
   */
  function promptDelete(jobId, jobName) {
    jobToDeleteId = jobId;
    document.getElementById('confirmMessage').innerText = `Are you sure you want to remove "${jobName}"?`;
    confirmDialog.classList.add('active');
  }

  /**
   * Set up all UI event listeners
   */
  function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', (e) => {
      activeSearchQuery = e.target.value.trim();
      applyFiltersAndRender();
    });

    // Source filter
    filterSource.addEventListener('change', (e) => {
      activeSourceFilter = e.target.value;
      applyFiltersAndRender();
    });

    // Demo Data Button
    btnDemoData.addEventListener('click', async () => {
      btnDemoData.disabled = true;
      btnDemoData.innerText = 'Loading...';
      await CareerStorage.loadDemoData();
      await loadJobs();
      btnDemoData.disabled = false;
      btnDemoData.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
        </svg>
        Demo Data Loaded!
      `;
      setTimeout(() => {
        btnDemoData.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          Demo Data
        `;
      }, 2000);
    });

    // Data Menu Dropdown
    btnDataMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      dataDropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dataDropdown.classList.remove('active');
    });

    // Export JSON
    btnExportJSON.addEventListener('click', async () => {
      const json = await CareerStorage.exportJSON();
      downloadFile(json, 'career_funnel_backup.json', 'application/json');
    });

    // Export CSV
    btnExportCSV.addEventListener('click', async () => {
      const csv = await CareerStorage.exportCSV();
      downloadFile(csv, 'career_funnel_applications.csv', 'text/csv');
    });

    // Import JSON
    btnImportJSON.addEventListener('click', () => {
      fileImportJSON.click();
    });

    fileImportJSON.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const count = await CareerStorage.importJSON(ev.target.result);
          alert(`Successfully imported ${count} job applications!`);
          await loadJobs();
        } catch (err) {
          alert('Failed to import JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      fileImportJSON.value = '';
    });

    // Clear All Action
    async function handleClearAll() {
      if (confirm('Are you sure you want to clear all job applications? This will reset your funnel to empty.')) {
        await CareerStorage.clearAll();
        await loadJobs();
      }
    }

    if (btnClearAll) btnClearAll.addEventListener('click', handleClearAll);
    if (btnDirectClearAll) btnDirectClearAll.addEventListener('click', handleClearAll);

    // Modal Triggers
    btnOpenAddModal.addEventListener('click', () => openModal());
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);

    formStatus.addEventListener('change', (e) => {
      toggleOfferSection(e.target.value === 'offer');
    });

    btnAddInterviewRound.addEventListener('click', () => {
      addInterviewRoundRow();
    });

    // Form Submit
    jobForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const id = document.getElementById('jobFormId').value || undefined;
      const company = document.getElementById('formCompany').value.trim();
      const title = document.getElementById('formTitle').value.trim();
      const status = document.getElementById('formStatus').value;
      const appliedDate = document.getElementById('formAppliedDate').value;
      const location = document.getElementById('formLocation').value.trim();
      const salary = document.getElementById('formSalary').value.trim();
      const source = document.getElementById('formSource').value;
      const url = document.getElementById('formUrl').value.trim();
      const notes = document.getElementById('formNotes').value.trim();

      // Collect rounds
      const rounds = [];
      const roundRows = interviewRoundsList.querySelectorAll('.cf-round-row');
      roundRows.forEach(r => {
        const nameVal = r.querySelector('.round-name').value.trim();
        const dateVal = r.querySelector('.round-date').value;
        if (nameVal) {
          rounds.push({ title: nameVal, date: dateVal, completed: false });
        }
      });

      // Collect offer details
      let offerDetails = null;
      if (status === 'offer') {
        offerDetails = {
          baseSalary: document.getElementById('formOfferBase').value.trim(),
          bonus: document.getElementById('formOfferBonus').value.trim(),
          deadline: document.getElementById('formOfferDeadline').value
        };
      }

      const jobData = {
        id,
        company,
        title,
        status,
        appliedDate,
        location,
        salary,
        source,
        url,
        notes,
        interviews: rounds,
        offerDetails
      };

      await CareerStorage.saveJob(jobData);
      closeModal();
      await loadJobs();
    });

    // Confirm Delete Dialog
    btnConfirmCancel.addEventListener('click', () => {
      confirmDialog.classList.remove('active');
      jobToDeleteId = null;
    });

    btnConfirmDelete.addEventListener('click', async () => {
      if (jobToDeleteId) {
        await CareerStorage.deleteJob(jobToDeleteId);
        confirmDialog.classList.remove('active');
        jobToDeleteId = null;
        await loadJobs();
      }
    });

    // Funnel stage clicks filter board
    document.querySelectorAll('.cf-funnel-step').forEach(step => {
      step.addEventListener('click', () => {
        const stage = step.dataset.stage;
        if (activeStageFilter === stage) {
          activeStageFilter = 'all';
          step.style.outline = 'none';
        } else {
          activeStageFilter = stage;
          document.querySelectorAll('.cf-funnel-step').forEach(s => s.style.outline = 'none');
          step.style.outline = '2px solid #6366f1';
        }
        applyFiltersAndRender();
      });
    });

    // Funnel toggle pills
    const btnFilterFunnelAll = document.getElementById('btnFilterFunnelAll');
    const btnFilterActiveOnly = document.getElementById('btnFilterActiveOnly');

    btnFilterFunnelAll.addEventListener('click', () => {
      btnFilterFunnelAll.classList.add('active');
      btnFilterActiveOnly.classList.remove('active');
      activeOnlyFilter = false;
      applyFiltersAndRender();
    });

    btnFilterActiveOnly.addEventListener('click', () => {
      btnFilterActiveOnly.classList.add('active');
      btnFilterFunnelAll.classList.remove('active');
      activeOnlyFilter = true;
      applyFiltersAndRender();
    });
  }

  /**
   * Helper: Download File
   */
  function downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * Helper: Days Ago
   */
  function calculateDaysAgo(dateStr) {
    if (!dateStr) return '';
    const diffTime = Math.abs(new Date() - new Date(dateStr));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Applied today';
    if (diffDays === 1) return 'Applied yesterday';
    return `Applied ${diffDays}d ago`;
  }

  /**
   * Helper: Escape HTML
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Start on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
