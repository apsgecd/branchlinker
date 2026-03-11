const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyOur4oshQes29wnuaVa_grPmOt4m8sJ2ug-FgRcsEdErOZL5ItgziT1NMiaZX5LLreZA/exec';
let sheetData = [];
let currentMapLink = "";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}

document.addEventListener('DOMContentLoaded', () => {
    const statusLine = document.getElementById('db-status');
    const CACHE_KEY = 'cachedSheetData';
	const input = document.getElementById('branchInput');
	input.focus();
	
    // --- HELPER: Detect Environment & Load Cache ---
    const loadCache = (callback) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            // Extension Mode
            chrome.storage.local.get([CACHE_KEY], (result) => callback(result[CACHE_KEY]));
        } else {
            // Webpage Mode
            const data = localStorage.getItem(CACHE_KEY);
            callback(data ? JSON.parse(data) : null);
        }
    };

    // --- HELPER: Detect Environment & Save Cache ---
    const saveCache = (data) => {
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ [CACHE_KEY]: data });
        } else {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
        }
    };

    // --- STEP 1: LOAD FROM CACHE (Any environment) ---
    loadCache((cachedData) => {
        if (cachedData) {
            sheetData = cachedData;
            console.log("Loaded from cache (" + (typeof chrome !== "undefined" ? "Extension" : "Web") + ")");
            if (statusLine) {
                statusLine.textContent = "● Using Cached Data (Refreshing...)";
                statusLine.style.color = "#ff9800";
                statusLine.style.display = 'block';
            }
        }
    });

    // --- STEP 2: FETCH FRESH DATA ---
    fetch(WEB_APP_URL, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            sheetData = data;
            
            // --- STEP 3: SAVE TO CACHE ---
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
    

    
    const suggs = document.getElementById('suggestions');
    const findBtn = document.getElementById('findBtn');

    input.addEventListener('input', () => {
    const selectedBank = document.getElementById('bankSelect').value.toLowerCase().trim();
    const query = input.value.toLowerCase().trim();
    suggs.innerHTML = '';

    if (query.length < 1) return;

    // DEBUG: Let's see what we are looking for
    console.log(`Searching for "${query}" in bank "${selectedBank}"`);

    const matches = sheetData.filter(item => {
        // We use Object.keys to find the right property regardless of exact casing
        const keys = Object.keys(item);
        
        // Find values by searching for keys that include our target words
        const bankKey = keys.find(k => k.toLowerCase().includes('bank'));
        const nameKey = keys.find(k => k.toLowerCase().includes('branch name'));
        const codeKey = keys.find(k => k.toLowerCase().includes('br code') || k.toLowerCase().includes('code'));

        const itemBank = String(item[bankKey] || "").toLowerCase().trim();
        const itemName = String(item[nameKey] || "").toLowerCase();
        const itemCode = String(item[codeKey] || "").toLowerCase();

        const isSameBank = itemBank === selectedBank;
        const nameMatch = itemName.includes(query);
        const codeMatch = itemCode.includes(query);

        return isSameBank && (nameMatch || codeMatch);
    }).slice(0, 5);
	
		
    console.log("Matches found:", matches.length);

    if (matches.length > 0) {
        matches.forEach(item => {
            // Find keys again for display
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

findBtn.addEventListener('click', () => {
    const searchForm = document.getElementById('search-form');
    const resArea = document.getElementById('result-area');
    const resBranch = document.getElementById('resBranch');
    const resDetails = document.getElementById('resDetails');

    const selectedBank = document.getElementById('bankSelect').value.toLowerCase().trim();
    const val = input.value.toLowerCase().trim();
	console.log("Search input:", val);
    
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
	console.log("Search success:", currentMapLink );

        // Fill data
		const reportUrl = match[reportKey];
				let reportHtml = 'N/A';
	if (reportUrl && reportUrl.startsWith('http')) {
    // If it's a valid link, make it a clickable anchor tag
    reportHtml = `<a href="${reportUrl}" target="_blank" class="text-decoration-none fw-bold">View Report 📃</a>`;
	} else if (reportUrl) {
    // If there is text but it's not a link, just show the text
    reportHtml = 'no report available for this period';
	}
	
			const linkUrl = match[linkKey];
				let linkHtml = 'N/A';
	if (linkUrl && linkUrl.startsWith('http')) {
    // If it's a valid link, make it a clickable anchor tag
    linkHtml = `<a href="${linkUrl}" target="_blank" class="text-decoration-none fw-bold">Open Map 📌</a>`;
	} else if (linkUrl) {
    // If there is text but it's not a link, just show the text
    linkHtml = 'no location available';
	}

        resBranch.textContent = match[bankKey] + " - " + match[nameKey] || "Branch Found";
        resDetails.innerHTML = `
            <strong>Code:</strong> ${match[codeKey] || 'N/A'}<br>
            <strong>Team:</strong> ${match[teamKey] || 'N/A'}<br>
			<strong>Units:</strong> ${match[unitsKey] || 'N/A'}<br>
			<strong>Last PM:</strong> ${match[lastpmKey] || 'N/A'}<br>
			<strong>Report:</strong> ${reportHtml}<br>
			<strong>GPS:</strong> ${linkHtml}
        `;

        // UI SWITCH
        searchform.style.setProperty('display', 'none', 'important');
        resultoverlay.style.setProperty('display', 'block', 'important');
		document.body.style.minHeight = '390px';
		document.body.style.height = '390px';
        console.log("Results displayed!");


        // FORCED RESIZE: This tells Chrome "Hey, I changed size, don't go blank!"
        setTimeout(() => {
            const currentHeight = document.body.scrollHeight;
            document.body.style.height = (currentHeight + 1) + 'px';
        }, 50);

    } else {
        alert('Match failed. Please select from the dropdown suggestions.');
    }
});

    // Reset, Open, and Copy remain the same...

   document.getElementById('closeOverlayBtn').addEventListener('click', () => {
        
    
		input.value = '';     // Clear data
		input.focus();
		searchform.style.setProperty('display', 'block', 'important');
        resultoverlay.style.setProperty('display', 'none', 'important');
		document.body.style.minHeight = 'auto';
		document.body.style.height = 'auto';

    });

 
    document.getElementById('copyBtn').addEventListener('click', () => {
        if (currentMapLink) {
            navigator.clipboard.writeText(currentMapLink).then(() => {
                const btn = document.getElementById('copyBtn');
                btn.textContent = "Copied!";
                setTimeout(() => { btn.textContent = "Copy Link"; }, 2000);
            });
        }
    });
});