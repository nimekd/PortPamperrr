# PortPamper

PortPamper is a simple online port scanner web application built with Flask. It allows users to scan a range of ports on a target IP or hostname and view the results in real-time. Users can also download the scan results as a PDF.

## Features

-   Scan a range of ports on a target IP or hostname
-   View scan progress and results in real-time
-   Download scan results as a PDF
-   Common ports and their uses information
-   Legal disclaimer and terms of service
-   FAQ section

## Prerequisites

-   Python 3.x
-   pip

## Installation

### Setting Up the Virtual Environment

1.  Clone the repository:

    ```sh
    git clone https://github.com/your-repo/portpamper.git
    cd portpamper
    ```

2.  Create a virtual environment:

    ```sh
    python -m venv venv
    ```

3.  Activate the virtual environment:

    -   On Windows:

        ```sh
        .\venv\Scripts\activate
        ```

    -   On macOS/Linux:

        ```sh
        source venv/bin/activate
        ```

4.  Install the required packages:

    ```sh
    pip install -r requirements.txt
    ```

## Usage

1.  Set the Nmap path in [app.py](http://_vscodecontentref_/0):

    -   Modify the [NMAP_PATH](http://_vscodecontentref_/1) variable in [app.py](http://_vscodecontentref_/2) to point to the location of your [nmap.exe](http://_vscodecontentref_/3) file.

        ```python
        NMAP_PATH = r"D:\current_projects\port\Nmap\nmap.exe"  # Example
        ```

2.  Run the Flask application:

    ```sh
    python app.py
    ```

3.  Open your web browser and navigate to `http://127.0.0.1:5000`.

4.  Enter the target IP or hostname, select the port range and scan type, and click the "Start Scan" button to begin the scan.

5.  View the scan progress and results in real-time.

6.  Download the scan results as a PDF by clicking the "Download PDF" button.

## Important Notes

-   **Legal Disclaimer**: Ensure you have explicit permission to scan any network or IP address. Unauthorized scanning of networks is illegal and unethical.
-   **Nmap Installation**: This application requires Nmap to be installed on your system. Download and install Nmap from [https://nmap.org/download.html](https://nmap.org/download.html).

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Contact

For any questions or inquiries, please contact [your-email@example.com](mailto:your-email@example.com).

## Acknowledgements

-   [Flask](https://flask.palletsprojects.com/)
-   [jsPDF](https://github.com/parallax/jsPDF)
-   [Tailwind CSS](https://tailwindcss.com/)
-   [Icons8](https://icons8.com/)
