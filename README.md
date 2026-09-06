# Manasyn — Personal Conversational Journal

> **Live Application:** [https://manasyn-ai-37.ai.studio](https://manasyn-ai-37.ai.studio)  
> **Tagline:** Talk freely. Find clarity. Move forward.

A production-grade, privacy-first conversational journal companion built with **Google Gemini**, **Firebase Authentication**, **Cloud Firestore**, and **Google Cloud Run**.

---

## Architecture & Threat Countermeasures

Manasyn was built using Google AI Studio configured with strict threat-modeling directives and secure coding standards:

| Threat Zone | Identified Vector | OWASP Standard | Implemented Countermeasure |
| :--- | :--- | :--- | :--- |
| **Input Surfaces** | Malicious prompt injections; SSRF via custom webhook URLs | OWASP A03 / LLM02 | Strict schema validation; server-side URL filtering blocking loopback (`127.0.0.1`), private IP subnets (`10.0.0.0/8`), and cloud metadata (`169.254.169.254`). |
| **Planning & Reasoning** | Prompt injection attempting to force clinical psychological diagnoses | OWASP LLM01 | Server-side Gemini system instructions enforce tentative, non-clinical phrasing, explicit evidence citations, and structured JSON constraints. |
| **Tool Execution** | Model timeouts, quota exhaustion, or service disruptions | OWASP A01 / LLM10 | Automated multi-tier resilient model fallback ladder (`gemini-2.5-flash` → `gemini-2.0-flash` → `gemini-flash-latest`). |
| **Memory & State** | Cross-user data leakage and unauthorized access to private reflections | OWASP A01 / Firebase Security | User Data Isolation via owner-bound Firestore security rules (`request.auth.uid == userId`) across all subcollections. |
| **Inter-System Comm.** | API key leakage or external endpoint exposure | OWASP A02 / A05 | `GEMINI_API_KEY` stored in Google Cloud Secret Manager; Express proxy routes handle all downstream calls server-side. |

---

## Core Capabilities & Original Features

1. **Conversational Clarity:** Multi-turn conversational journaling that untangles thoughts, helps weigh trade-offs, and suggests next steps with explicit user confirmation.
2. **Patterns & Journey:** Evidence-backed cross-reflection theme detection citing specific source reflections without clinical overreach.
3. **Places:** Contextual place tagging with adjustable precision (approximate area vs. specific location) and non-continuous tracking.
4. **Commitments:** Explicit, consent-driven action item tracking separated from speculative AI suggestions.
5. **Data Portability & Export:** Comprehensive Markdown ZIP and structured JSON export with automated manifest generation (`README.md`).
6. **In-App Feedback:** Direct, owner-isolated Firestore feedback channel with optional diagnostic previews.

---

## Setup & Deployment

```bash
# Set active project
export PROJECT_ID="streamlit-rag-agent-507111"
gcloud config set project $PROJECT_ID

# Enable required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

### Secret Manager Configuration

```bash
# Store the Gemini API key in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant Cloud Run service account access to read the secret
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Cloud Run Deployment

```bash
# Deploy container to Cloud Run
gcloud run deploy manasyn-ai \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --port 8080

# Verification label for challenge tracking
gcloud run services update manasyn-ai \
  --update-labels dev-tutorial=cloud-run-ai-challenge \
  --region asia-southeast1
```

---

## Functional Verification Matrix

| Test ID | Interaction / Flow | Expected System Outcome |
| --- | --- | --- |
| **TC-01** | User signs in via Google Account on Landing View | Firebase Authentication initializes session; user state isolates strictly to `/users/{userId}`. |
| **TC-02** | User writes a reflection prompt and selects intent | Prompt persists to Firestore; server invokes Gemini API and renders tentative, grounding guidance. |
| **TC-03** | User opens Places and tags location | Approximate place name saves to reflection metadata without continuous GPS tracking. |
| **TC-04** | User reviews Patterns & Journey | System analyzes selected reflections, identifies recurring themes with supporting reflection citations, and presents optional next steps. |
| **TC-05** | User saves a suggested next step | Item is explicitly added to Commitments only upon clicking `Save as commitment`. |
| **TC-06** | User configures Webhook or Export | SSRF protection blocks private IPs; Archive Exporter packages reflections and manifest into a structured ZIP. |
| **TC-07** | User submits in-app feedback | Form sanitizes input and writes to Firestore feedback collection with opt-in email association. |
