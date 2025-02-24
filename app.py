from flask import Flask, request, jsonify, render_template, Response
from flask_cors import CORS
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import socket
import os.path
import json
import nmap
import logging
import threading

app = Flask(__name__)

# Enable CORS for all routes (for local development)
CORS(app, resources={r"/scan": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)

# Global flag to handle scan cancellation
scan_cancelled = False

# Set the nmap path
NMAP_PATH = r"D:\current_projects\port\Nmap\nmap.exe"
os.environ["PATH"] += os.pathsep + os.path.dirname(NMAP_PATH)
# Global variable to store OS information
os_info = "OS detection pending"

# Function to detect OS (to be run in a separate thread)
def detect_os_threaded(target):
    global os_info
    try:
        scanner = nmap.PortScanner()
        # Ensure that the target is an IP address for OS detection
        try:
            socket.inet_aton(target)  # Check if target is a valid IP address
            ip_address = target
        except socket.error:
            try:
                ip_address = socket.gethostbyname(target)  # Resolve hostname to IP
            except socket.gaierror as e:
                os_info = "OS detection failed: Could not resolve hostname"
                return

        scanner.scan(ip_address, arguments="-O --osscan-guess")
        for host in scanner.all_hosts():
            if 'osmatch' in scanner[host] and len(scanner[host]['osmatch']) > 0:
                os_info = scanner[host]['osmatch'][0]['name']
                return  # Exit after the first match
        os_info = "OS detection failed: No match found"
    except Exception as e:
        os_info = f"OS detection failed: {e}"

# Function to scan a single port
def scan_port(target, port, scan_type='tcp'):
    try:
        if scan_type == 'tcp':
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        elif scan_type == 'udp':
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(1)
        result = sock.connect_ex((target, port))
        if result == 0:
            try:
                service = socket.getservbyport(port, scan_type)
            except socket.error:
                service = 'Unknown'
            sock.close()

            # Use nmap to get more detailed information about the service
            nm = nmap.PortScanner()
            nm.scan(target, str(port))
            product = nm[target]['tcp'][port]['product'] if 'product' in nm[target]['tcp'][port] else ''

            return {'port': port, 'protocol': scan_type, 'state': 'Open', 'service': service, 'product': product}
        else:
            sock.close()
            return None
    except socket.gaierror:
        return None
    except socket.error as e:
        return {'port': port, 'protocol': scan_type, 'state': 'Invalid', 'error': str(e)}  # Capture the error

# Function to scan ports
def scan_ports(target, start_port, end_port, scan_type):
    global scan_cancelled, os_info
    nm = nmap.PortScanner()
    open_ports = []
    progress = 0
    total_ports = end_port - start_port + 1
    start_time = datetime.now()
    os_info = "OS detection pending"  # Reset OS info for each scan
    errors = [] # Initialize errors list

    try:
        target_ip = socket.gethostbyname(target)
    except socket.gaierror as e:
        yield f"data: {json.dumps({'complete': True, 'error': 'Please enter valid hostname or ip'})}\n\n"
        return

    # Start OS detection in a separate thread
    os_thread = threading.Thread(target=detect_os_threaded, args=(target,))
    os_thread.start()

    with ThreadPoolExecutor(max_workers=100) as executor:
        futures = {executor.submit(scan_port, target_ip, port, scan_type): port for port in range(start_port, end_port + 1)}
        for future in as_completed(futures):
            if scan_cancelled:
                break
            port = futures[future]
            result = future.result()
            if result:
                open_ports.append(result)
            progress += 1
            current_progress = min(99, progress / total_ports * 100)
            yield f"data: {json.dumps({'complete': False, 'progress': current_progress, 'open_ports': open_ports, 'os_info': os_info})}\n\n"

    # Wait for OS detection thread to complete
    os_thread.join()

    end_time = datetime.now()
    duration_seconds = (end_time - start_time).total_seconds()
    minutes, seconds = divmod(duration_seconds, 60)
    if minutes > 0:
        duration_str = f"{int(minutes)} min, {int(seconds)} sec"
    else:
        duration_str = f"{int(seconds)} sec"
    target_is_hostname = target != target_ip

    try:
        target_hostname = socket.gethostbyaddr(target_ip)[0] if not target_is_hostname else target_ip
    except (socket.herror, socket.gaierror):
        target_hostname = "Unknown"

    open_ports.sort(key=lambda x: x['port'])  # Sort open ports by port number

    yield f"data: {json.dumps({'complete': True, 'progress': 100, 'open_ports': open_ports, 'target': target_ip, 'target_hostname': target_hostname, 'total_open_ports': len(open_ports), 'start_time': start_time.strftime('%Y-%m-%d %H:%M:%S'), 'end_time': end_time.strftime('%Y-%m-%d %H:%M:%S'), 'duration': duration_str, 'os_info': os_info, 'scan_type': scan_type, 'actual_target': target, 'status': 'completed'})}\n\n"

# Function to scan common ports
def scan_common_ports(target, scan_type):
    common_ports = [21, 22, 23, 25, 53, 80, 110, 143, 443, 3389, 3306, 8080]  # List of common ports
    start_port = min(common_ports)
    end_port = max(common_ports)
    return scan_ports(target, start_port, end_port, scan_type)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/help')
def how_it_works():
    return render_template('help.html')

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/faqs')
def faqs():
    return render_template('faqs.html')

@app.route('/scan', methods=['POST'])
def scan():
    global scan_cancelled
    scan_cancelled = False
    data = request.get_json()
    target = data['target']
    start_port = int(data['start_port'])
    end_port = int(data['end_port'])
    scan_type = data['scan_type']
    response = Response(scan_ports(target, start_port, end_port, scan_type), content_type='text/event-stream')
    return response

@app.route('/scan_common', methods=['POST'])
def scan_common():
    global scan_cancelled
    scan_cancelled = False
    data = request.get_json()
    target = data['target']
    scan_type = data['scan_type']
    response = Response(scan_common_ports(target, scan_type), content_type='text/event-stream')
    return response

@app.route('/cancel_scan', methods=['POST'])
def cancel_scan():
    global scan_cancelled
    scan_cancelled = True
    return jsonify({"status": "Scan cancelled"})

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0')