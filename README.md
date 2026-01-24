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

### 5. Saving Data
* **Save Button:** Located at the bottom left.
* **Storage:** Currently uses Local Storage (browser memory) and connects to Firebase for cloud backup (in progress).

---

## 🛠 Technical Documentation

### Tech Stack
* **Frontend:** React.js (Create React App)
* **Hosting:** GitHub Pages
* **Database:** Firebase (Google Cloud)
* **Routing:** React Router DOM

### Installation (For Developers)
If you need to download this to a new computer, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/markmonie/bodyshop-manager-app.git](https://github.com/markmonie/bodyshop-manager-app.git)
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run locally:**
    ```bash
    npm start
    ```
    *Runs on http://localhost:3000*

4.  **Deploy to live site:**
    ```bash
    npm run deploy
    ```

### Troubleshooting
* **White Screen of Death:** If the screen goes blank after an update, check `package.json` to ensure the `"homepage"` line matches the GitHub URL exactly.
* **Mobile Cache:** If updates don't appear on mobile, clear Chrome Browser cache (Settings > Site Settings > All Sites > Clear & Reset).

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
### 🔧 Vehicle Lookup Integration (VRM)

The application uses an external API to automatically populate vehicle details (Make, Model, Colour, Engine, etc.) based on the Registration Mark (VRM).

#### How it works
1.  **Trigger:** User enters a registration (e.g., "AB12 CDE") in the estimate form.
2.  **Request:** The app sends a secure `GET` request to the VRM Provider (e.g., DVLA/UKVD).
3.  **Security:** The API Key is **not** hardcoded in the application files. It is injected during the build process via GitHub Secrets.
4.  **Response:** The returned JSON data is mapped to the application state (`setVehicleDetails`) and automatically fills the "Vehicle" section of the Job Card.

#### Security Configuration
To protect the API usage from unauthorised access, this project uses **GitHub Actions Secrets**:
* **Storage:** Keys are stored in `Settings > Secrets and variables > Actions`.
* **Injection:** The workflow file (`.github/workflows/deploy.yml`) injects these secrets into the React build environment as:
    * `REACT_APP_VRM_API_KEY`
    * `REACT_APP_FIREBASE_API_KEY`

#### Code Reference (Snippet)
The lookup function utilizes the environment variable to authenticate the request:

```javascript
const fetchVehicleDetails = async (registration) => {
  const apiKey = process.env.REACT_APP_VRM_API_KEY; // Pulled from Secrets
  const response = await fetch(`https://api.vrm-provider.com/v1/vehicles/${registration}?apikey=${apiKey}`);
  const data = await response.json();
  // ... map data to form fields
};
