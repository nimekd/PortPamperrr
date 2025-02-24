let scanController = null;
let scanData = {};

function togglePortInputs() {
    const portRange = document.getElementById('port-range').value;
    const manualPortInputs = document.getElementById('manual-port-inputs');
    if (portRange === 'manual') {
        manualPortInputs.style.display = 'block';
    } else {
        manualPortInputs.style.display = 'none';
    }
}

function toggleScan() {
    const disclaimerCheckbox = document.getElementById('disclaimer-checkbox');
    if (!disclaimerCheckbox.checked) {
        showPopup('Please agree to the disclaimer before starting the scan.');
        return;
    }

    const scanButton = document.getElementById('scan-button');
    if (scanButton.textContent === 'Start Scan') {
        startScan();
    } else {
        stopScan();
    }
}



function startScan() {
    const target = document.getElementById('target').value;
    const portRange = document.getElementById('port-range').value;
    const scanType = document.getElementById('scan-type').value;
    let startPort, endPort;

    if (!portRange) {
        showPopup('Please select a port range.');
        return;
    }

    if (portRange === 'manual') {
        startPort = parseInt(document.getElementById('start-port').value);
        endPort = parseInt(document.getElementById('end-port').value);
    } else if (portRange === 'top10') {
        startPort = 1;
        endPort = 10;
    } else if (portRange === 'top100') {
        startPort = 1;
        endPort = 100;
    } else if (portRange === 'top1000') {
        startPort = 1;
        endPort = 1000;
    }

    // Validate input
    if (!target || (portRange === 'manual' && (isNaN(startPort) || isNaN(endPort)))) {
        showPopup('Please enter a valid target and port range.');
        return;
    }

    // Validate IP address or hostname
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const hostnamePattern = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}?$/;

    if (!ipPattern.test(target) && !hostnamePattern.test(target)) {
        showPopup('Invalid IP address or hostname.');
        return;
    }

    // Clear previous results
    document.getElementById('status').textContent = 'Scanning in progress...';
    document.getElementById('open-ports').innerHTML = '';
    document.getElementById('scan-summary').innerHTML = '';
    document.getElementById('scan-parameters').innerHTML = '';
    document.getElementById('open-ports-table').style.display = 'none';
    document.getElementById('output-container').style.display = 'none';
    document.getElementById('scan-parameters-container').style.display = 'none';
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-percentage').textContent = '0%';
    document.getElementById('scan-summary-container').style.display = 'block';
    document.getElementById('download-pdf-container').style.display = 'none';

    // Change button text to "Stop Scan"
    document.getElementById('scan-button').textContent = 'Stop Scan';

    // Start the scan
    scanController = new AbortController();
    const signal = scanController.signal;

    fetch('/scan', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            target: target,
            start_port: startPort,
            end_port: endPort,
            scan_type: scanType
        }),
        signal: signal
    })

    .then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let receivedLength = 0;

        reader.read().then(function processText({ done, value }) {
            if (done) {
                console.log("Stream complete");
                return;
            }

            receivedLength += value.length;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            lines.forEach(line => {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));
                    scanData = data;
                    scanData.start_port = startPort; // Ensure start_port is set
                    scanData.end_port = endPort; // Ensure end_port is set
                    if (data.complete) {
                        if (data.error) {
                            document.getElementById('status').textContent = `Error: ${data.error}`;
                            document.getElementById('progress-container').style.display = 'none';
                            document.getElementById('scan-button').textContent = 'Start Scan';
                            return;
                        }
                        document.getElementById('status').textContent = 'Scan complete';
                        document.getElementById('progress-bar').style.width = '100%';
                        document.getElementById('progress-percentage').textContent = '100%';
                        uncheckDisclaimer(); // Uncheck the disclaimer checkbox
                        if (data.open_ports.length > 0) {
                            // Sort open ports by port number in ascending order
                            data.open_ports.sort((a, b) => a.port - b.port);
                            document.getElementById('open-ports').innerHTML = data.open_ports.map(port => `
                                <tr>
                                    <td class="px-4 py-2 border-b text-green-500">${port.port}</td>
                                    <td class="px-4 py-2 border-b text-green-500">${port.protocol}</td>
                                    <td class="px-4 py-2 border-b text-green-500">${port.service}</td>
                                    <td class="px-4 py-2 border-b text-green-500">${port.product || ''}</td>
                                </tr>
                            `).join('');
                            document.getElementById('open-ports-table').style.display = 'table';
                            document.getElementById('output-container').style.display = 'block';
                        } else {
                            document.getElementById('output-container').style.display = 'none';
                        }
                        document.getElementById('scan-summary').innerHTML = `
                            <tr><td class="px-4 py-2 border-b">Target</td><td class="px-4 py-2 border-b">${data.actual_target}</td></tr>
                            <tr><td class="px-4 py-2 border-b">Port Range</td><td class="px-4 py-2 border-b">${startPort} - ${endPort}</td></tr>
                            <tr><td class="px-4 py-2 border-b">Total Open Ports</td><td class="px-4 py-2 border-b">${data.total_open_ports}</td></tr>
                            <tr><td class="px-4 py-2 border-b">Scan Status</td><td class="px-4 py-2 border-b">Complete</td></tr>
                            <tr><td class="px-4 py-2 border-b">Start Time</td><td class="px-4 py-2 border-b">${data.start_time}</td></tr>
                            <tr><td class="px-4 py-2 border-b">End Time</td><td class="px-4 py-2 border-b">${data.end_time}</td></tr>
                            <tr><td class="px-4 py-2 border-b">Duration</td><td class="px-4 py-2 border-b">${data.duration}</td></tr>
                        `;
                        let scanParametersHTML = '';
                        scanParametersHTML += `<tr><td class="px-4 py-2 border-b">IP address</td><td class="px-4 py-2 border-b">${data.target_hostname}</td></tr>`;
                        scanParametersHTML += `<tr><td class="px-4 py-2 border-b">Operating System</td><td class="px-4 py-2 border-b">${data.os_info}</td></tr>`;
                        scanParametersHTML += `<tr><td class="px-4 py-2 border-b">Scan Type</td><td class="px-4 py-2 border-b">${data.scan_type}</td></tr>`;
                        scanParametersHTML += `<tr><td class="px-4 py-2 border-b">Total Number of Ports</td><td class="px-4 py-2 border-b">${data.total_open_ports}</td></tr>`;
                        document.getElementById('scan-parameters').innerHTML = scanParametersHTML;
                        document.getElementById('scan-parameters-container').style.display = 'block';
                        document.getElementById('scan-button').textContent = 'Start Scan';
                        document.getElementById('download-pdf-container').style.display = 'block';

                        // Show the toast notification
                        showToast('Scanning is completed!');

                        // Call onScanComplete after scan completes
                        onScanComplete();
                    } else {
                        document.getElementById('progress-bar').style.width = `${data.progress}%`;
                        document.getElementById('progress-percentage').textContent = `${Math.round(data.progress)}%`;

                        // Update open ports immediately
                        if (data.open_ports && data.open_ports.length > 0) {
                            // Sort open ports by port number in ascending order
                            data.open_ports.sort((a, b) => a.port - b.port);
                            const openPortsHTML = data.open_ports.map(port => `
                                <tr>
                                    <td class="px-4 py-2 border-b text-green-500">${port.port}</td>
                                    <td class="px-4 py-2 border-b text-green-500">${port.protocol}</td>
                                    <td class="px-4 py-2 border-b text-green-500">${port.service}</td>
                                    <td class="px-4 py-2 border-b text-green-500">${port.product || ''}</td>
                                </tr>
                            `).join('');
                            document.getElementById('open-ports').innerHTML = openPortsHTML;
                            document.getElementById('open-ports-table').style.display = 'table';
                            document.getElementById('output-container').style.display = 'block';
                        }
                    }
                }
            });

            return reader.read().then(processText);
        });
    })
    .catch(error => {
        document.getElementById('status').textContent = `Error: ${error.message}`;
        document.getElementById('progress-container').style.display = 'none';
        document.getElementById('scan-button').textContent = 'Start Scan';
    });
}
function stopScan() {
    if (scanController) {
        scanController.abort();
        fetch('cancel_scan', {
            method: 'POST'
        }).then(() => {
            document.getElementById('status').textContent = 'Scan stopped';
            document.getElementById('progress-container').style.display = 'none';
            document.getElementById('scan-button').textContent = 'Start Scan';
            uncheckDisclaimer(); // Uncheck the disclaimer checkbox
            // Call onStopScan after scan stops
            onStopScan();
        }).catch(error => {
            console.error('Error stopping scan:', error);
        });
    }
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Scan Results", 14, 22);

    doc.setFontSize(12);
    doc.text("Scan Summary", 14, 32);
    doc.autoTable({
        startY: 36,
        head: [['Field', 'Value']],
        body: [
            ['Target', scanData.actual_target],
            ['Port Range', `${scanData.start_port} - ${scanData.end_port}`],
            ['Total Open Ports', scanData.total_open_ports],
            ['Scan Status', 'Complete'],
            ['Start Time', scanData.start_time],
            ['End Time', scanData.end_time],
            ['Duration', scanData.duration],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        bodyStyles: { fillColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.text("Scan Parameters", 14, doc.autoTable.previous.finalY + 10);
    doc.autoTable({
        startY: doc.autoTable.previous.finalY + 14,
        head: [['Field', 'Value']],
        body: [
            ['IP address', scanData.target_hostname],
            ['Operating System', scanData.os_info],
            ['Scan Type', scanData.scan_type],
            ['Total Number of Ports', scanData.total_open_ports],
        ],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        bodyStyles: { fillColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.text("Open Ports", 14, doc.autoTable.previous.finalY + 10);
    doc.autoTable({
        startY: doc.autoTable.previous.finalY + 14,
        head: [['Port', 'Protocol', 'Service Name', 'Service product']],
        body: scanData.open_ports.length > 0 ? scanData.open_ports.map(port => [port.port, port.protocol, port.service, port.product || '']) : [['0 open ports', '', '', '']],
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
        bodyStyles: { fillColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save("scan_results.pdf");
}

// Dark mode toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    document.body.classList.toggle('bg-gray-900');
    document.body.classList.toggle('text-pink-500');
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Show popup message
function showPopup(message) {
    const errorModal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorModal.style.display = 'block';
}

// Function to close the error modal
function closeErrorModal() {
    const errorModal = document.getElementById('errorModal');
    errorModal.style.display = 'none';
}

// Function to uncheck the legal disclaimer checkbox
function uncheckLegalDisclaimer() {
    document.getElementById('legal-disclaimer').checked = false;
}

// Call uncheckLegalDisclaimer after scan completes or stops
function onScanComplete() {
    document.getElementById('status').textContent = 'Scan complete.';
    uncheckLegalDisclaimer();
    const downloadContainer = document.getElementById('download-pdf-container');
    console.log('Setting download-pdf-container to block');
    downloadContainer.style.display = 'block';
}

function onStopScan() {
    document.getElementById('status').textContent = 'Scan stopped.';
    uncheckLegalDisclaimer();
}

// Uncheck the legal disclaimer checkbox
function uncheckDisclaimer() {
    document.getElementById('disclaimer-checkbox').checked = false;
}

// Format duration in minutes and seconds
function formatDuration(durationStr) {
    const duration = new Date(durationStr * 1000);
    const minutes = duration.getUTCMinutes();
    const seconds = duration.getUTCSeconds();
    return `${minutes} minutes ${seconds} seconds`;
}

// Initialize the page with the manual port inputs hidden and add event listener for Enter key
document.addEventListener('DOMContentLoaded', () => {
    togglePortInputs();
    document.getElementById('target').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            toggleScan();
        }
    });
    document.getElementById('port-range').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            toggleScan();
        }
    });
    document.getElementById('start-port').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            toggleScan();
        }
    });
    document.getElementById('end-port').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            toggleScan();
        }
    });
});

// Function to load the Terms of Service content
async function loadTermsContent() {
    const termsModalContent = document.getElementById('termsModalContent');
    try {
        const response = await fetch('/terms'); // Fetch the terms.html content
        const html = await response.text();
        // Extract content from the terms.html
        const start = html.indexOf('<div class="container mx-auto p-4 content">');
        const end = html.indexOf('</div>', start + 6);
        const content = html.substring(start, end + 6);
        termsModalContent.innerHTML = content; // Insert the content into the modal
    } catch (error) {
        console.error('Error fetching terms content:', error);
        termsModalContent.innerHTML = '<p>Failed to load terms content.</p>';
    }
}    

// Function to load the Help content
async function loadHelpContent() {
    const helpModalContent = document.getElementById('helpModalContent');
    try {
        const response = await fetch('/help'); // Fetch the help.html content
        const html = await response.text();
        // Extract content from the help.html
        const start = html.indexOf('<div class="container mx-auto p-4 content">');
        const end = html.indexOf('</div>', start + 6);
        const content = html.substring(start, end + 6);
        helpModalContent.innerHTML = content; // Insert the content into the modal
    } catch (error) {
        console.error('Error fetching help content:', error);
        helpModalContent.innerHTML = '<p>Failed to load help content.</p>';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const rightExpandButton = document.getElementById('right-expand-button');
    if (rightExpandButton) {
        rightExpandButton.addEventListener('click', function(event) {
            event.preventDefault();
            const rightSidebar = document.getElementById('right-sidebar');
            rightSidebar.classList.toggle('expanded');

            // Remove 'expanded' class from the left sidebar
            const leftSidebar = document.getElementById('left-sidebar');
            leftSidebar.classList.remove('expanded');
        });
    }

    const closeHelpModalButton = document.querySelector('#helpModal .modal-close-button');
    if (closeHelpModalButton) {
        closeHelpModalButton.addEventListener('click', closeHelpModal);
    }

    const closeTermsModalButton = document.querySelector('#termsModal .modal-close-button');
    if (closeTermsModalButton) {
        closeTermsModalButton.addEventListener('click', closeTermsModal);
    }

    const closeFaqModalButton = document.querySelector('#faqModal .modal-close-button');
    if (closeFaqModalButton) {
        closeFaqModalButton.addEventListener('click', closeFaqModal);
    }
});

function openHelpModal() {
    const helpModal = document.getElementById('helpModal');
    helpModal.style.display = 'block';
}

function closeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    helpModal.style.display = 'none';
}

function openTermsModal() {
    const termsModal = document.getElementById('termsModal');
    termsModal.style.display = 'block';
}

function closeTermsModal() {
    const termsModal = document.getElementById('termsModal');
    termsModal.style.display = 'none';
}

function openFaqModal() {
    const faqModal = document.getElementById('faqModal');
    faqModal.style.display = 'block';
}

function closeFaqModal() {
    const faqModal = document.getElementById('faqModal');
    faqModal.style.display = 'none';
}
