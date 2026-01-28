Triple MMM Enterprise Master Suite v47.0
​This industrial-grade workshop management application is designed to handle the end-to-end workflow of a professional body repair business, specifically optimized for Triple MMM Body Repairs.
​🛠 Project Overview
​We have built a comprehensive, cloud-integrated ERP (Enterprise Resource Planning) tool that bridges the gap between technical vehicle intake, workshop repair tracking, and financial claim submission. The system is built using React and Firebase, ensuring real-time data persistence and dual-layer locking to prevent data loss.
​💎 Key Departments Integrated
​The Hub (Intake): Features a locked DVLA Handshake API that pulls vehicle make, year, fuel type, and MOT status instantly based on a registration number.
​The Estimator: A professional math engine that calculates parts markup, VAT, and labor across MET, Panel, and Paint categories. It also handles the "Golden Split" calculation for Customer Excess vs. Insurer Balance.
​The Workshop: A dedicated Jobsheet view for technicians showing the vehicle's technical specs and their allocated repair hours.
​The Deal Folder (Vault): A digital claim package that archives every saved invoice snapshot, repair photos, and the digital Satisfaction Note signed by the client.
​The Finance Vault: A centralized CSR (Customer Service Record) log that aggregates total workshop revenue against expenditure photo receipts.
​Recent Jobs (History): A master recovery list that allows for seamless "gliding" between different repair sheets and reloading previous work.
​Master Settings: Full control over business branding, PayPal QR integration (for Scan. Pay. Go.), and Google Calendar links for markmonie72@gmail.com.
​🚀 Accomplishments & Fixes
​Print Force-Hide Logic: Implemented an absolute CSS isolation layer (!important) to ensure interactive app elements (buttons/cards) are completely stripped from official PDF printouts, leaving only a clean document.
​Native Signature Pad: Developed a build-safe HTML5 Canvas signature engine to collect legal sign-offs directly on-screen without requiring external libraries that cause build failures.
​Technical Specification Block: Engineered an insurer-compliant technical block on the final invoice that displays the VIN, Engine Capacity, and Colour specs alongside the repair description.
​Archiving Engine: Linked the "Save Master" function to automatically snapshot the financial state of a job and file it into the Deal Folder's history.
​Finance CSR Link: Added a real-time Income & Expenditure log to the Finance department, allowing for quick "VIEW CSR" links for all receipts.
​⚙️ Technical Configuration
​Frontend: React
​Database: Firebase Firestore (Real-time Sync)
​Storage: Firebase Storage (Photos/Signatures)
​API: DVLA Vehicle Enquiry Service
​Calendar: Linked to markmonie72@gmail.com
