# Manasyn — Personal Gemini Journal for Busy-Minded Non-Journalers

A modern, production-grade voice-first personal journal companion powered by **Google Gemini**, **Google Maps Platform**, and **Firebase Cloud Firestore**.

> **Tagline:** *Talk freely. Find clarity. Move forward.*

---

## Threat Summary & Security Countermeasures

| Threat Zone | Identified Vector | OWASP / Mitigation Standard | Implemented Countermeasure |
| :--- | :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection in reflection prompts, SSRF via arbitrary webhook URLs | OWASP A03 / LLM02 | Strict schema validation, parameterization, and server-side URL filtering blocking private IP ranges (127.0.0.1, 10.0.0.0/8, 169.254.169.254). |
| **Planning & Reasoning** | System prompt hijacking or context manipulation in multi-turn dialogues | OWASP LLM01 | Strong system instruction boundaries with persona isolation; structured role partitioning (`user` vs `model`). |
| **Tool Execution & APIs** | Model failure, quota exhaustion, or privilege escalation | OWASP A01 / LLM10 | Automated 4-tier resilient model fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`). |
| **Memory & State** | Cross-user data leakage and unauthorized reading of private reflections | OWASP A01 / Firebase Security | User Data Isolation via owner-bound Firestore security rules (`request.auth.uid == userId`) and undef-stripped payloads. |
| **Inter-System Communication**| Leaking API keys or secret webhook URLs to client browsers | OWASP A02 / A05 | API keys (`GEMINI_API_KEY`) and webhook dispatch handled exclusively server-side via Express proxy routes. |

---

## 1. Prerequisites & Environment Setup

Ensure you have the Google Cloud CLI installed and authenticated:

```bash
# Set your active GCP project ID
export PROJECT_ID="YOUR_GCP_PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Secret Manager Configuration

Store your Gemini API key in Google Cloud Secret Manager and grant access to the Cloud Run runtime service account:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant Cloud Run service account access to read the secret
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Firestore Security Rules

Deploy the owner-bound security rules to ensure user data isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // RBAC: strictly checks whether the user's UID exists in the /admins collection
    function isAdmin() {
      return isSignedIn() && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    match /{document=**} {
      allow read, write: if false;
    }

    // User data isolation: each user can only read and write their own documents
    match /users/{userId} {
      allow read, write: if isOwner(userId);
      
      match /interactions/{interactionId} {
        allow read, write: if isOwner(userId);
      }

      match /webhookConfigs/{configId} {
        allow read, write: if isOwner(userId);
      }

      match /milestones/{milestoneId} {
        allow read, write: if isOwner(userId);
      }
    }

    // RBAC: Admins collection
    match /admins/{adminId} {
      allow read: if isSignedIn() && (request.auth.uid == adminId || isAdmin());
      allow write: if false;
    }

    // System security audit logs: readable only by authenticated designated admins
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow write: if false;
    }
  }
}
```

---

## 4. Building & Running Locally

```bash
# Install dependencies
npm install

# Run the unified Express + Vite development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 5. Google Cloud Run Deployment

Deploy the container directly to Cloud Run:

```bash
# Build and deploy service to Cloud Run
gcloud run deploy synthetix-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 3000
```

### Mandatory Verification Labeling

Apply the mandatory challenge campaign label to register the service for verification:

```bash
gcloud run services update synthetix-app \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 6. Functional Stability & Walkthrough Test Steps

| Test ID | User Interaction / Flow | Expected System Outcome |
| :--- | :--- | :--- |
| **TC-01** | User clicks **"Continue with Google Account"** on Landing View | Firebase Authentication popup opens; upon approval, user session initializes and displays the private dashboard with isolated Firestore sync. |
| **TC-02** | User writes a reflection prompt and selects **"Reflect"** mode | Prompt is persisted to `/users/{userId}/interactions/{id}`; backend initiates Gemini 3.6 Flash fallback ladder and renders formatted markdown guidance. |
| **TC-03** | User clicks **"Attach Location"** and picks a location or preset | `LocationPickerModal` opens with interactive Google Maps canvas/coordinates; user confirms, and `location` object is saved to the active Firestore entry. |
| **TC-04** | User clicks **"Tools &rarr; Admin RBAC"** in Navbar (as designated admin) | `AdminDashboardModal` opens, querying `/api/admin/system-stats`. Requires a verified Firebase ID token JWT in the Authorization header. Verifies server health, Gemini ladder readiness, and security audit trail without leaking private journal text. |
| **TC-05** | User clicks **"Tools &rarr; Webhooks"**, adds Slack/Discord URL, and clicks **"Test Connection"** | Server validates endpoint against SSRF blacklist, dispatches ping payload, and displays live status badge. |
| **TC-06** | User clicks **"Dispatch"** on an active reflection | Reflection summary is sanitized and delivered server-side to the user's configured destination webhook. |
| **TC-07** | User clicks **"Synthesize Journey"** in Sidebar or Tools dropdown | `JourneySynthesisModal` opens; queries user's recent reflections from Firestore, invokes `/api/gemini/synthesize-journey` with Gemini 3.6 Flash, and visualizes longitudinal themes, emotional trajectory, and open action items. |
| **TC-08** | User toggles **"Spatial Map"** in Navbar | Switches from Chat stream to full interactive Spatial Map Canvas; renders all geographic pins with place metadata, dialog turn counts, and one-click jump back to session chat. |
| **TC-09** | User clicks the **Microphone** icon in the chat input bar | Web Speech API initializes native speech recognition; audio pulses while listening, transcribes spoken reflections continuously into the input buffer. |
| **TC-10** | User clicks **"Export Archive"** in Tools menu or Sidebar | `WorkspaceExportModal` opens; client generates a complete structured Markdown (.md) archive with frontmatter and TOC, or machine-readable JSON backup (.json) downloaded directly. |
| **TC-11** | User engages in reflection mentioning an architectural target or technical ambition | Gemini system instructions autonomously harvest strategic milestones in a structured `<<<SYNTHETIX_MILESTONES>>>` block; backend persists milestones to `/users/{userId}/milestones/{milestoneId}` and frontend triggers a real-time toast banner. |
| **TC-12** | User clicks **"Milestones"** tab in Sidebar or Navbar | `MilestonesTrackerView` opens with category badges (infra, product, career, research), target dates, status toggle buttons (In Progress, Done, Paused), and direct links back to the originating reflection session. |
| **TC-13** | User clicks **"Load Demo Sandbox"** in Sidebar or Milestones view | System populates the user's Firestore state with 4 realistic engineering sessions (Kubernetes Zero-Downtime Migration, Multi-Region Spanner Topology, Zero-Trust Identity Gateway, and Distributed Tracing) and linked strategic milestones. |
| **TC-14** | User types a custom tag with Enter or clicks a quick chip (`#infra`, `#scaling`, `#k8s`) | Tag is immediately attached to the current reflection and persisted to Firestore. |

