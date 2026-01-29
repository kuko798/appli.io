// Saves options to chrome.storage
const saveOptions = () => {
    const spreadsheetId = document.getElementById('spreadsheetId').value;

    chrome.storage.sync.set(
        { spreadsheetId: spreadsheetId },
        () => {
            // Update status to let user know options were saved.
            const status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }
    );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
    chrome.storage.sync.get(
        { spreadsheetId: '' },
        (items) => {
            document.getElementById('spreadsheetId').value = items.spreadsheetId;
        }
    );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
