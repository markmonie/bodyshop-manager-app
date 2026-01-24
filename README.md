# Bodyshop Manager App
**Triple MMM Body Repairs Specialists**

A bespoke estimation and management system built for independent body repair shops. This application streamlines the process of capturing client details, managing insurance claims, and generating job cards.

## 🚀 Live Application
**Access the app here:** [https://markmonie.github.io/bodyshop-manager-app/](https://markmonie.github.io/bodyshop-manager-app/)

---

## 📖 User Manual

### 1. Client Management
* **Purpose:** Capture essential customer contact information.
* **Fields:** Full Name, Address, Phone Number, Email.
* **Action:** Fill these out first to link a new job to a specific customer.

### 2. Insurance Handling
* **Purpose:** Manage third-party payer details.
* **Fields:** Claim Number, Insurer Name, Insurer Email.
* **Feature:** Includes a quick-email button to contact the insurer directly from the app.

### 3. Estimating (Vehicle Lookup)
* **Function:** Enter the vehicle registration number (VRM) to automatically pull vehicle details (Make, Model, Colour) via the network connection.
* **Output:** Generates a preliminary cost estimate based on labour and parts required.

### 4. Job Card Generation
* **Purpose:** The internal document for the workshop floor.
* **Content:** Converts the estimate into a task list for technicians, hiding costs and focusing on repair instructions.

### 5. Data Export & Backup (The "Zip" Feature)
* **Function:** Uses `JSZip` to bundle the current job data (images, PDF estimates, and text files) into a single compressed folder.
* **Action:** Pressing "Save/Export" triggers `FileSaver`, instantly downloading a `.zip` archive to your device for offline storage or email attachments.

---

## 🛠 Technical Documentation

### Tech Stack
* **Frontend:** React.js (Create React App)
* **Hosting:** GitHub Pages
* **Database:** Firebase (Google Cloud)
* **File Handling:** JSZip & File-Saver (for local backups)
* **Routing:** React Router DOM

### Security & Secrets
This repository is configured with **GitHub Actions Secrets** to prevent API key leakage.
* **API Keys:** Keys for Firebase and VRM Lookups are NOT hardcoded.
* **Injection:** They are injected at build time via `Settings > Secrets and variables`.
* **Private vs Public:** The `private: true` flag in `package.json` prevents accidental publishing to the NPM registry, while the repository itself remains Public for GitHub Pages deployment.

### Vehicle Lookup Integration (VRM)
The app uses a secure server-side request pattern (via injected keys) to fetch vehicle data:
1.  **Trigger:** User inputs VRM.
2.  **Process:** App validates the format and sends a request using `process.env.REACT_APP_VRM_KEY`.
3.  **Result:** Returns standard UK vehicle data (DVLA format) to populate the estimate.

### Installation (For Developers)
1.  **Clone:** `git clone https://github.com/markmonie/bodyshop-manager-app.git`
2.  **Install:** `npm install`
3.  **Run:** `npm start`
4.  **Deploy:** `npm run deploy` (Ensure `homepage` in `package.json` is correct).

---

## ⚖️ Terms and Conditions of Repair
*Standard terms applied to all jobs managed through this system.*

**1. ESTIMATES:** Estimates are approximations of cost. Additional damage found during repair will require fresh authorisation.
**2. PAYMENT:** Full payment is due upon completion. We retain a lien on the vehicle until paid in full.
**3. PARTS:** We reserve the right to use high-quality aftermarket or green parts unless "Manufacturer Only" is specified.
**4. WARRANTY:** Paintwork and labour are guaranteed for 12 months.
**5. LIABILITY:** We are not responsible for personal items left in the vehicle.

*Full T&Cs available upon request at the workshop.*

---

**© 2026 Mark Monie / Triple MMM Body Repairs**
