const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyOur4oshQes29wnuaVa_grPmOt4m8sJ2ug-FgRcsEdErOZL5ItgziT1NMiaZX5LLreZA/exec';
let sheetData = [];
let currentMapLink = "";

document.addEventListener('DOMContentLoaded', () => {
  const statusLine = document.getElementById('db-status');
  const CACHE_KEY = 'cachedSheetData';
  const input = document.getElementById('branchInput');
  const ncSettingsPanel = document.getElementById('ncSettingsPanel');
  const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const suggs = document.getElementById('suggestions');
  const findBtn = document.getElementById('findBtn');
  
  input.focus();

  function showNotification(msg) {
    const toast = document.getElementById('toast-notification');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  function loadNextcloudConfig() {
    const url = localStorage.getItem('pm_nc_url');
    const user = localStorage.getItem('pm_nc_user');
    const pass = localStorage.getItem('pm_nc_pass');
    if (url) document.getElementById('nc_url').value = url;
    if (user) document.getElementById('nc_user').value = user;
    if (pass) document.getElementById('nc_pass').value = pass;
  }
  loadNextcloudConfig();

  toggleSettingsBtn.addEventListener('click', () => {
    const isCollapsed = !ncSettingsPanel.classList.contains('show');
    if (isCollapsed) {
      ncSettingsPanel.classList.add('show');
    } else {
      ncSettingsPanel.classList.remove('show');
    }
  });

  saveSettingsBtn.addEventListener('click', () => {
    const url = document.getElementById('nc_url').value.trim().replace(/\/$/, "");
    const user = document.getElementById('nc_user').value.trim();
    const pass = document.getElementById('nc_pass').value.trim();

    if (!url || !user || !pass) {
      showNotification("Please fill in all connection fields.");
      return;
    }

    localStorage.setItem('pm_nc_url', url);
    localStorage.setItem('pm_nc_user', user);
    localStorage.setItem('pm_nc_pass', pass);
    ncSettingsPanel.classList.remove('show');
    showNotification("Nextcloud config saved locally.");
  });

  const loadCache = (callback) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([CACHE_KEY], (result) => callback(result[CACHE_KEY]));
    } else {
      const data = localStorage.getItem(CACHE_KEY);
      callback(data ? JSON.parse(data) : null);
    }
  };

  const saveCache = (data) => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [CACHE_KEY]: data });
    } else {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    }
  };

  // Step 1: Initialize Cache Load
  loadCache((cachedData) => {
    if (cachedData) {
      sheetData = cachedData;
      if (statusLine) {
        statusLine.textContent = "● Using Cached Data (Refreshing...)";
        statusLine.style.color = "#ff9800";
        statusLine.style.display = 'block';
      }
    }
  });

  // Step 2: Fetch Active Database Updates
  fetch(WEB_APP_URL, { method: 'POST' })
    .then(res => res.json())
    .then(data => {
      sheetData = data;
      saveCache(data);
      if (statusLine) {
        statusLine.textContent = "● Database Connected (Fresh)";
        statusLine.style.color = "#198754";
        statusLine.style.display = 'block';
      }
    })
    .catch(err => {
      console.error("Fetch failed:", err);
      if (statusLine && !sheetData.length) {
        statusLine.textContent = "● Connection failed";
        statusLine.style.color = "#dc3545";
      }
    });

  input.addEventListener('input', () => {
    const selectedBank = document.getElementById('bankSelect').value.toLowerCase().trim();
    const query = input.value.toLowerCase().trim();
    suggs.innerHTML = '';

    if (query.length < 1) return;

    const matches = sheetData.filter(item => {
      const keys = Object.keys(item);
      const bankKey = keys.find(k => k.toLowerCase().includes('bank'));
      const nameKey = keys.find(k => k.toLowerCase().includes('branch name'));
      const codeKey = keys.find(k => k.toLowerCase().includes('br code') || k.toLowerCase().includes('code'));

      const itemBank = String(item[bankKey] || "").toLowerCase().trim();
      const itemName = String(item[nameKey] || "").toLowerCase();
      const itemCode = String(item[codeKey] || "").toLowerCase();

      return (itemBank === selectedBank) && (itemName.includes(query) || itemCode.includes(query));
    }).slice(0, 5);

    if (matches.length > 0) {
      matches.forEach(item => {
        const nameKey = Object.keys(item).find(k => k.toLowerCase().includes('branch name'));
        const codeKey = Object.keys(item).find(k => k.toLowerCase().includes('br code') || k.toLowerCase().includes('code'));
        
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action p-2';
        li.textContent = `${item[nameKey]} (${item[codeKey]})`;
        
        li.addEventListener('click', () => {
          input.value = item[nameKey];
          suggs.innerHTML = '';
        });
        suggs.appendChild(li);
      });
    }
  });

  async function queryNextcloudReports(branchCode) {
    const reportsList = document.getElementById('ncReportsList');
    const ncUrl = localStorage.getItem('pm_nc_url');
    const ncUser = localStorage.getItem('pm_nc_user');
    const ncPass = localStorage.getItem('pm_nc_pass');

    if (!ncUrl || !ncUser || !ncPass) {
      reportsList.innerHTML = `
        <div class="text-center p-2 text-warning border border-warning border-dashed rounded-3 bg-light">
          Configure Nextcloud Sync settings above to display live reports.
        </div>
      `;
      return;
    }

    const credentials = btoa(`${ncUser}:${ncPass}`);
    const apiEndpoint = `${ncUrl}/index.php/apps/pmreport/search?branch=${encodeURIComponent(branchCode)}`;

    try {
      const res = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'OCS-APIRequest': 'true',
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        reportsList.innerHTML = `<span class="text-danger">Failed to search Nextcloud server (Status ${res.status}).</span>`;
        return;
      }

      const data = await res.json();
      renderNextcloudReports(data);

    } catch (err) {
      console.error("Nextcloud sync error:", err);
      reportsList.innerHTML = `<span class="text-danger">Sync unreachable. Verify credentials or URL.</span>`;
    }
  }

  function renderNextcloudReports(files) {
    const container = document.getElementById('ncReportsList');
    container.innerHTML = '';

    if (!files || files.length === 0) {
      container.innerHTML = '<div class="text-muted text-center py-2">No matching digital reports found on server.</div>';
      return;
    }

    const listGroup = document.createElement('div');
    listGroup.className = 'list-group list-group-flush border rounded-3 bg-white mt-2';

    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'list-group-item p-2 d-flex justify-content-between align-items-center flex-wrap gap-1';

      const getTitleHtml = () => {
        const badge = file.shared ? ' <span class="badge bg-indigo-50 text-indigo-700 border border-indigo-100 ms-1" style="font-size: 10px; color:#4f46e5;">🔗 Shared</span>' : '';
        return `<div class="text-truncate" style="max-width: 200px;" title="${file.name}">📄 ${file.name}${badge}</div>`;
      };

      const labelDiv = document.createElement('div');
      labelDiv.innerHTML = getTitleHtml();
      item.appendChild(labelDiv);

      const actionGroup = document.createElement('div');
      actionGroup.className = 'd-flex gap-1';

      // View Button
      const btnView = document.createElement('button');
      btnView.className = 'btn btn-sm btn-light py-1 px-2 border';
      btnView.textContent = 'View';
      btnView.style.fontSize = '11px';
      const updateViewAction = () => {
        btnView.onclick = () => window.open(file.publicUrl || file.downloadUrl, '_blank');
      };
      updateViewAction();
      actionGroup.appendChild(btnView);

      // Copy/Share Button
      const btnCopyShare = document.createElement('button');
      btnCopyShare.className = 'btn btn-sm btn-primary py-1 px-2';
      btnCopyShare.style.fontSize = '11px';
      btnCopyShare.textContent = 'Copy Link';

      btnCopyShare.addEventListener('click', async () => {
        if (file.shared && file.publicUrl) {
          copyToClipboard(file.publicUrl);
        } else {
          btnCopyShare.disabled = true;
          btnCopyShare.textContent = 'Sharing...';

          const sharedUrl = await autoShareFileOnServer(file.id);
          if (sharedUrl) {
            file.shared = true;
            file.publicUrl = sharedUrl;
            
            labelDiv.innerHTML = getTitleHtml();
            updateViewAction();
            copyToClipboard(sharedUrl);
            
            btnCopyShare.textContent = 'Copied!';
            setTimeout(() => { btnCopyShare.textContent = 'Copy Link'; }, 3000);
          } else {
            btnCopyShare.textContent = 'Copy Link';
          }
          btnCopyShare.disabled = false;
        }
      });

      actionGroup.appendChild(btnCopyShare);
      item.appendChild(actionGroup);
      listGroup.appendChild(item);
    });

    container.appendChild(listGroup);
  }

  async function autoShareFileOnServer(id) {
    const ncUrl = localStorage.getItem('pm_nc_url');
    const ncUser = localStorage.getItem('pm_nc_user');
    const ncPass = localStorage.getItem('pm_nc_pass');
    const credentials = btoa(`${ncUser}:${ncPass}`);

    try {
      const res = await fetch(`${ncUrl}/index.php/apps/pmreport/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'OCS-APIRequest': 'true',
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ id: parseInt(id) })
      });

      if (!res.ok) {
        showNotification("Public sharing could not be initiated.");
        return null;
      }

      const data = await res.json();
      return data.publicUrl || null;
    } catch (err) {
      console.error("Auto-share call failed:", err);
      showNotification("Share failed. Server connection error.");
      return null;
    }
  }

  function copyToClipboard(text) {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      showNotification("Report Link copied to clipboard!");
    } catch (err) {
      showNotification("Failed to copy link.");
    }
    document.body.removeChild(el);
  }

  findBtn.addEventListener('click', () => {
    const resBranch = document.getElementById('resBranch');
    const resDetails = document.getElementById('resDetails');
    const selectedBank = document.getElementById('bankSelect').value.toLowerCase().trim();
    const val = input.value.toLowerCase().trim();

    const match = sheetData.find(item => {
      const keys = Object.keys(item);
      const bankKey = keys.find(k => k.toLowerCase().includes('bank'));
      const nameKey = keys.find(k => k.toLowerCase().includes('branch name'));
      const codeKey = keys.find(k => k.toLowerCase().includes('br code') || k.toLowerCase().includes('code'));

      const itemBank = String(item[bankKey] || "").toLowerCase().trim();
      const itemName = String(item[nameKey] || "").toLowerCase().trim();
      const itemCode = String(item[codeKey] || "").toLowerCase().trim();
      
      return itemBank === selectedBank && (itemName === val || itemCode === val);
    });

    if (match) {
      const keys = Object.keys(match);
      const bankKey = keys.find(k => k.toLowerCase().includes('bank'));
      const nameKey = keys.find(k => k.toLowerCase().includes('branch name'));
      const codeKey = keys.find(k => k.toLowerCase().includes('br code') || k.toLowerCase().includes('code'));
      const teamKey = keys.find(k => k.toLowerCase().includes('apsg team') || k.toLowerCase().includes('team'));
      const unitsKey = keys.find(k => k.toLowerCase().includes('units') || k.toLowerCase().includes('units'));
      const lastpmKey = keys.find(k => k.toLowerCase().includes('last pm') || k.toLowerCase().includes('last'));
      const reportKey = keys.find(k => k.toLowerCase().includes('report file') || k.toLowerCase().includes('file'));
      const linkKey = keys.find(k => k.toLowerCase().includes('map link') || k.toLowerCase().includes('link'));

      currentMapLink = match[linkKey] || "";
      const branchCode = match[codeKey] || "";

      const reportUrl = match[reportKey];
      let reportHtml = 'N/A';
      if (reportUrl && reportUrl.startsWith('http')) {
        reportHtml = `<a href="${reportUrl}" target="_blank" class="text-decoration-none fw-bold">View Report 📃</a>`;
      } else if (reportUrl) {
        reportHtml = 'no report available for this period';
      }
      
      const linkUrl = match[linkKey];
      let linkHtml = 'N/A';
      if (linkUrl && linkUrl.startsWith('http')) {
        linkHtml = `<a href="${linkUrl}" target="_blank" class="text-decoration-none fw-bold text-success">Open Map 📌</a>`;
      } else if (linkUrl) {
        linkHtml = 'no location available';
      }

      resBranch.textContent = `${match[bankKey]} - ${match[nameKey]}`;
      resDetails.innerHTML = `
        <strong>Code:</strong> ${branchCode}<br>
        <strong>Team:</strong> ${match[teamKey] || 'N/A'}<br>
        <strong>Units:</strong> ${match[unitsKey] || 'N/A'}<br>
        <strong>Last PM:</strong> ${match[lastpmKey] || 'N/A'}<br>
        <strong>Manual Report:</strong> ${reportHtml}<br>
        <strong>GPS:</strong> ${linkHtml}
      `;

      // Trigger UI Transitions
      document.getElementById('searchform').style.setProperty('display', 'none', 'important');
      document.getElementById('resultoverlay').style.setProperty('display', 'flex', 'important');

      // Initiate Nextcloud reports query
      document.getElementById('ncReportsList').innerHTML = `
        <div class="text-center py-2 text-muted">
          <span class="spinner-border spinner-border-sm me-1 text-indigo-500" style="color:#4f46e5" role="status"></span>
          Searching digital reports...
        </div>
      `;
      queryNextcloudReports(branchCode);

    } else {
      showNotification('Match failed. Please select from the dropdown suggestions.');
    }
  });

  // Close and reset panel state
  document.getElementById('closeOverlayBtn').addEventListener('click', () => {
    input.value = '';     
    input.focus();
    document.getElementById('searchform').style.setProperty('display', 'block', 'important');
    document.getElementById('resultoverlay').style.setProperty('display', 'none', 'important');
  });

  // Handle GPS location copying
  document.getElementById('copyBtn').addEventListener('click', () => {
    if (currentMapLink) {
      navigator.clipboard.writeText(currentMapLink).then(() => {
        const btn = document.getElementById('copyBtn');
        btn.textContent = "Location Copied!";
        setTimeout(() => { btn.textContent = "Copy GPS Location"; }, 2000);
      });
    }
  });
});
