# Phase 1: Intent Router & Emergency Lock

- [ ] Explore existing codebase
- [ ] Create Implementation Plan
- [/] Backend Implementation
  - [/] Create `IntentService` or add to `SafetyService`
  - [/] Implement Intent Router logic
  - [/] Implement Emergency Lock State Machine
  - [/] Update Chat Endpoint to use new services
- [/] Frontend Implementation
  - [/] Update Chat Interface to handle new response fields
  - [/] Add "I am safe" button and logic
- [x] Verification
  - [x] Test Chitchat/Meta intents
  - [x] Test Medical Symptoms intent
  - [x] Test Emergency Lock flow

# Phase 2: Local Logistics Module

- [x] Create Local Dataset (Bucharest)
- [x] Create Triage Service
  - [x] Create `triage_service.py`
  - [x] Implement `parse_symptoms`
  - [x] Implement `triage` rules (Urgency/Follow-ups)
  - [x] Unit test Triage Service
- [x] Backend Integation
  - [x] Update `models.py` (Triage fields)
  - [x] Update `main.py` to use `TriageService`
  - [x] Implement "Unknown" urgency flow (Exploratory questions)
  - [x] Implement Grounding Check (RAG validation)
- [x] Frontend UI Improvements
  - [x] Update `page.tsx` for Triage Chips & Questions
  - [x] Hide/Show sources based on citations_used
- [x] Evaluation & Documentation
  - [x] Create/Update `summarize_eval.py`
  - [x] Update `SAFETY_POLICY.md` / `ARCHITECTURE.md`
- [x] Verification
  - [x] Test Hello (Chitchat)
  - [x] Test Fever (Urgent/Self-care)
  - [x] Test Vague (Unknown)
  - [x] Test Emergency (Lock)
- [x] Backend: Logistics Service
  - [x] Create `logistics_service.py`
  - [x] Implement loading and search logic
  - [x] Implement sector extraction
  - [x] Update `main.py` routing
- [x] Frontend UI
  - [x] Update `page.tsx` to show Local Resources
- [x] Documentation
  - [x] Update `ARCHITECTURE.md`
  - [x] Update `API_SPEC.md`
  - [x] Update `README.md`
- [x] Verification
  - [x] Test Emergency Lock with resources

# Phase 4: Trusted Corpus RAG v2

- [x] Data Setup
  - [x] Create `rag/corpus_raw/trusted_guidelines/`
  - [x] Create `manifest.json`
  - [x] Add dummy trusted content (NHS/WHO snippets)
- [x] Ingestion Upgrade
  - [x] Update `ingest_rag.py` to use manifest metadata
  - [x] Improve chunking (size/overlap)
- [x] Backend: Retrieval & Citation
  - [x] Update `models.py` (Citation object)
  - [x] Update `rag_service.py` (Query expansion, Re-ranking)
  - [x] Update `main.py` (Prompt engineering, Citation generation)
- [x] Frontend UI
  - [x] Update `page.tsx` for structured citations
- [x] Evaluation
  - [x] Create `scripts/rag_health_check.py`
  - [x] Run health check
- [x] Verification
  - [x] Test Medical Symptoms (Grounded) [Coverage: 50%]
  - [x] Test Unknown (No Hallucination)
  - [x] Test Medical Symptoms (Grounded) [Coverage: 50%]
  - [x] Test Unknown (No Hallucination)
  - [x] Test Chitchat (No Citations)

# Phase 5: Demo & Report Hardening

- [x] Backend: Output & Export
  - [x] Update `models.py` (response_kind)
  - [x] Update `main.py` (Consistent formatting)
  - [x] Create `routes/export.py` (Session export)
- [x] Frontend: UI Polish
  - [x] Implement Markdown rendering
  - [x] visual polish (badges, bubbles, spacing)
  - [x] Add "Demo Scenarios" panel
- [x] Documentation
  - [x] Update `README.md`
  - [x] Update `STATUS.md`
  - [x] Update `ARCHITECTURE.md`
- [x] Verification
  - [x] Test Demo Scenarios
  - [x] Test Export Endpoint

# Phase 5.3: UI/UX Refinements

- [x] Implement Light Mode default + Theme Toggle
- [x] Replace chunk-id citations with clean numeric `[1]` format
- [x] Unify Upload button styling across Chat and Intake
- [x] Verification
  - [x] Verify API returns `[1]` citations
  - [x] Verify Theme Toggle works
  - [x] Verify Button Consistency
