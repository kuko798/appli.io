let currentPage = 1;
const itemsPerPage = 20;
let allJobs = [];

document.addEventListener('DOMContentLoaded', loadJobs);
document.getElementById('refresh').addEventListener('click', loadJobs);
document.getElementById('prev-page').addEventListener('click', () => changePage(-1));
document.getElementById('next-page').addEventListener('click', () => changePage(1));

// Live Updates
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.jobs) {
        console.log("Jobs updated, reloading dashboard...");
        loadJobs();
    }
});

function loadJobs() {
    chrome.storage.local.get("jobs", (result) => {
        allJobs = result.jobs || [];
        currentPage = 1; // Reset to first page on reload
        updateStats();
        renderTable();
    });
}

function updateStats() {
    let counts = {
        "Applied": 0,
        "Interview": 0,
        "Offer": 0,
        "Rejected": 0
    };

    allJobs.forEach(job => {
        if (counts[job.status] !== undefined) {
            counts[job.status]++;
        } else {
            // Handle edge cases or map unknown to Applied?
            counts["Applied"]++;
        }
    });

    document.getElementById('count-applied').textContent = counts["Applied"];
    document.getElementById('count-interview').textContent = counts["Interview"];
    document.getElementById('count-offer').textContent = counts["Offer"];
    document.getElementById('count-rejected').textContent = counts["Rejected"];
}

function changePage(delta) {
    const maxPage = Math.ceil(allJobs.length / itemsPerPage);
    const newPage = currentPage + delta;

    if (newPage >= 1 && newPage <= maxPage) {
        currentPage = newPage;
        renderTable();
    }
}

function renderTable() {
    const tbody = document.getElementById('job-list');
    const paginationControls = document.getElementById('pagination-controls');
    const emptyMsg = document.getElementById('empty-msg');

    tbody.innerHTML = '';

    if (allJobs.length === 0) {
        emptyMsg.style.display = 'block';
        paginationControls.style.display = 'none';
        return;
    }

    emptyMsg.style.display = 'none';
    paginationControls.style.display = 'flex';

    // Sort by date descending (newest first)
    allJobs.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination Logic
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageJobs = allJobs.slice(startIndex, endIndex);
    const maxPage = Math.ceil(allJobs.length / itemsPerPage);

    // Update Controls
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${maxPage}`;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === maxPage;

    // Render Rows
    pageJobs.forEach(job => {
        const tr = document.createElement('tr');

        // Status Class
        let statusClass = 'status-applied';
        if (job.status === 'Interview') statusClass = 'status-interview';
        if (job.status === 'Offer') statusClass = 'status-offer';
        if (job.status === 'Rejected') statusClass = 'status-rejected';

        tr.innerHTML = `
      <td>${job.company || 'Unknown'}</td>
      <td>${job.subject}</td>
      <td><span class="status-badge ${statusClass}">${job.status}</span></td>
      <td>${new Date(job.date).toLocaleDateString()}</td>
    `;

        tbody.appendChild(tr);
    });
}
