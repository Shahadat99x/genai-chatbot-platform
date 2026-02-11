# Phase 5: Demo & Report Hardening

## Goal

To polish the user experience for a professional demo and ensure reproducibility for the final report/thesis.

## User Review Required

> [!NOTE]
> **UI Changes**: The chat interface will be updated with a cleaner look, markdown support, and a demo scenario panel.
> **Backend**: A new `/export` endpoint will be added to save session data for evidence.

## Proposed Changes

### Backend (`apps/api`)

#### [MODIFY] [models.py](file:///w:/healthcare-assistant-ai/apps/api/models.py)

- Add `response_kind` enum field to `ChatResponse`.

#### [MODIFY] [main.py](file:///w:/healthcare-assistant-ai/apps/api/main.py)

- Populate `response_kind` based on intent and logic.
- Ensure `assistant_message` ignores internal formatting quirks (though markdown rendering on FE handles most).
- Include `routes/export.py`.

#### [NEW] [routes/export.py](file:///w:/healthcare-assistant-ai/apps/api/routes/export.py)

- Endpoint `POST /export/chat` to retrieve session history.
- Saves to `eval/evidence/` (server-side) or returns JSON (client-side). I will implement both (save file + return JSON).

### Frontend (`apps/web`)

#### [MODIFY] [page.tsx](file:///w:/healthcare-assistant-ai/apps/web/app/chat/page.tsx)

- **Markdown**: Use `react-markdown` (if available) or basic regex replacement for headers/lists. _Decision: Check package.json. If missing, use simple regex formatter to avoid heavy install deps if possible, or `npm install react-markdown`._
- **UI Polish**:
  - Distinct bubbles for User vs Assistant.
  - Badges for Urgency and Intent.
  - Collapsible "Sources" section.
- **Demo Panel**:
  - Add buttons for "Fever", "Rash" (Unknown), "Stroke" (Emergency), "Chitchat".
  - These buttons strictly send pre-defined messages.

### Documentation

- Update `README.md`, `STATUS.md`, `ARCHITECTURE.md` to reflect the final state of the system.

## Verification Plan

1.  **Visual Check**: Verify chat bubbles, markdown rendering, and badges.
2.  **Scenario Test**: Click "Fever" -> Verify grounded response + NHS citation.
3.  **Scenario Test**: Click "Rash" -> Verify "No guidelines" warning.
4.  **Export Test**: Run a session, call `/export/chat`, verify JSON content.
