# UniGen - AI University Database Assignment Generator

## Prerequisites

Before running this project, make sure the following are installed on your machine:

- Node.js version 20 or higher
- npm
- Graphviz (the dot command must be available in your PATH)
- A Google Gemini API key (free at https://aistudio.google.com/app/apikey)

To install Graphviz:

Windows (using winget):

    winget install Graphviz.Graphviz

After installation, add the Graphviz bin folder to your PATH. The default location is:

    C:\Program Files\Graphviz\bin

To add it to PATH, open System Properties, go to Environment Variables, find the Path variable under System Variables, click Edit, and add the path above. Then close and reopen any terminals for the change to take effect. Verify it works by running:

    dot -version

Windows (manual): download from https://graphviz.org/download/ and add the bin folder to your PATH manually as described above.

Ubuntu/Debian:

    sudo apt-get install graphviz

macOS:

    brew install graphviz

## Installation

Clone or download the project, then open a terminal in the project root.

Install backend dependencies:

    cd backend
    npm install

Install frontend dependencies:

    cd ../frontend
    npm install

## Configuration

Copy the backend environment example file:

    cd backend
    cp .env.example .env

The default .env values work for local development. You do not need to change anything unless you want a different port.

The frontend does not require any environment configuration for local development.

## Running the Project

You need three terminal windows open at the same time.

Terminal 1 - start the backend server:

    cd backend
    npm run dev

Terminal 2 - start the background worker:

    cd backend
    node worker.js

Terminal 3 - start the frontend:

    cd frontend
    npm run dev

Once all three are running, open your browser and go to:

    http://localhost:5173

## First-Time Setup in the Browser

1. Enter your Google Gemini API key on the login screen. The key is validated against the Gemini API and stored on the server at data/[userId]/meta.json. It is never sent anywhere else.

2. On the main screen, type a description of your database scenario or leave the field blank to use the default University Management System example.

3. Click Generate Full Assignment. The worker will run six steps and you can watch live progress on screen.

4. When complete, download the generated files: ERD diagrams in PNG format, a Word report, and a Python script.

## Generated Files

Each job creates a folder at backend/data/[userId]/[jobId]/ containing:

- erd.dot - Graphviz source for the crow's foot ERD
- erd.png - Rendered crow's foot ERD at 300 DPI
- erd_chen.dot - Graphviz source for the Chen notation ERD
- erd_chen.png - Rendered Chen notation ERD at 300 DPI
- report.json - Structured report data from Gemini
- report.docx - Formatted Word document
- create_database.py - Python script to create the MS Access database
- README.md - Instructions for running the Python script

## Generating the MS Access Database File

The Python script requires Windows with the Microsoft Access Database Engine installed. It will not run on Linux or macOS.

Step 1 - Install the Microsoft Access Database Engine 2016 Redistributable:

    https://www.microsoft.com/en-us/download/details.aspx?id=54920

Download and run the installer. If you are using 64-bit Python, install the 64-bit version of the engine. If you already have 32-bit Microsoft Office installed, you may need to use the 32-bit version instead or run the installer with the /quiet flag from an administrator command prompt:

    accessdatabaseengine.exe /quiet

Step 2 - Install the required Python packages:

    pip install pyodbc pywin32

Step 3 - Run the script:

    python create_database.py

This creates a .accdb file in the same folder as the script.

If you get an error saying "Data source name not found" or "Could not find installable ISAM", it means the Access Database Engine is not installed or the architecture (32-bit vs 64-bit) does not match your Python installation. Reinstall the engine with the matching architecture.

## Redis

The project uses Redis via BullMQ for the job queue. A connection string for a hosted Redis instance (Upstash) is already hardcoded in backend/seg/seg.js, so you do not need to install or configure Redis locally.

If you want to use your own Redis instance, update the REDIS_URL value in that file.

## Notes

- The backend runs on port 3001 by default. Change PORT in backend/.env to use a different port.
- The frontend dev server runs on port 5173 and proxies all /api requests to the backend automatically.
- All job data is stored on the local filesystem under backend/data/. This folder is created automatically and is excluded from version control.
- The worker and the API server are separate processes. Both must be running for jobs to be processed.