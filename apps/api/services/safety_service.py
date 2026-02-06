import re
from pydantic import BaseModel
from typing import List, Literal, Optional, Dict

class SafetyResult(BaseModel):
    urgency: Literal["self_care", "gp", "urgent", "emergency"]
    flags: List[str]
    action: Literal["allow", "refuse", "escalate", "clarify"]
    message_override: Optional[str] = None
    questions: Optional[List[str]] = []

class SafetyService:
    def __init__(self):
        # 1. Emergency Escalation (Red Flags)
        self.emergency_patterns = [
            r"shortness of breath", r"difficulty breathing", r"can't breathe", r"severe breathing",
            r"chest pain", r"pressure in chest", r"tightness in chest",
            r"face droop", r"slurred speech", r"one[- ]sided weakness", r"stroke",
            r"uncontrolled bleeding", r"severe bleeding", r"blood everywhere",
            r"car accident", r"hit by car", r"major accident",
            r"throat swelling", r"swollen tongue", r"anaphylaxis", r"severe allergic reaction",
            r"seizure", r"fainted", r"passed out", r"unconscious",
            r"suicidal", r"kill myself", r"self harm",
            r"overdose", r"took too many pills", r"poisoned", r"drank bleach"
        ]
        
        # 2. Urgent Clarifiers (Vague Symptoms)
        self.urgent_patterns = [
            r"accident", r"injury", r"hurt badly", r"bleeding",
            r"severe pain", r"worst headache",
            r"dizzy", r"confused",
            r"pregnant",
            r"fever 40", r"fever 104", r"high fever"
        ]
        
        # 3. Refusal Patterns (Medical Advice)
        self.refusal_patterns = [
            r"\bdosage\b", r"\bdose\b", r"\bmg\b",
            r"how many", r"how often", r"times a day",
            r"\bprescribe\b", r"\bantibiotic\b", r"\bamoxicillin\b", r"\bazithromycin\b",
            r"do i have", r"is it definitely", r"confirm diagnosis"
        ]

        # 4. Unlock Phrases
        self.unlock_patterns = [
            r"false alarm", r"joke", r"not real", r"symptoms gone",
            r"called 112", r"at the hospital", r"doctor is coming"
        ]

        # 5. Non-compliance Phrases
        self.non_compliance_patterns = [
            r"no doctor", r"won't go", r"not going", r"i will take medicine",
            r"just tell medicine", r"no hospital"
        ]

    def _matches_any(self, text: str, patterns: List[str]) -> bool:
        text_lower = text.lower()
        for pattern in patterns:
            if re.search(pattern, text_lower):
                return True
        return False

    def evaluate_user_message(self, text: str, session: Dict) -> SafetyResult:
        """
        Stateful evaluation pipeline.
        session dict structure: 
        { "emergency_lock": bool, "last_triage": str, "urgent_pending": bool }
        """
        
        # --- 0. Check Unlock (Always First) ---
        if session.get("emergency_lock", False):
            if self._matches_any(text, self.unlock_patterns):
                # Unlock
                session["emergency_lock"] = False
                session["last_triage"] = "self_care"
                return SafetyResult(
                    urgency="self_care",
                    flags=["emergency_lock_cleared"],
                    action="allow",
                    message_override="I understand. I'm glad you're safe. How else can I help you today?"
                )
            else:
                # Still Locked
                flags = ["emergency_lock_active"]
                msg = "EMERGENCY LOCK ACTIVE: I cannot continue this conversation until you confirm your safety. If this is a real emergency, call 112 immediately."
                
                # Check Non-compliance while locked
                if self._matches_any(text, self.non_compliance_patterns):
                    flags.append("non_compliance_detected")
                    msg = "I can't help with medication. This could be life-threatening. Call 112 now."
                
                return SafetyResult(
                    urgency="emergency",
                    flags=flags,
                    action="escalate",
                    message_override=msg
                )

        # --- 1. Emergency Red Flags ---
        if self._matches_any(text, self.emergency_patterns):
            session["emergency_lock"] = True
            session["last_triage"] = "emergency"
            
            msg = (
                "EMERGENCY ALERT: Based on your symptoms, you may be experiencing a life-threatening medical emergency.\n\n"
                "Call 112 (or your local emergency number) immediately or go to the nearest emergency room.\n"
                "Do not delay care."
            )
            return SafetyResult(
                urgency="emergency",
                flags=["red_flag_detected", "emergency_lock_active"],
                action="escalate",
                message_override=msg
            )
        
        # --- 2. Urgent Clarifiers (Vague Symptoms) ---
        # Only if not already pending clarification
        if self._matches_any(text, self.urgent_patterns) and not session.get("urgent_pending", False):
            session["urgent_pending"] = True
            session["last_triage"] = "urgent"
            
            questions = [
                "Are you having trouble breathing or chest pain?",
                "Are you bleeding heavily?",
                "Did you faint or lose consciousness?",
                "Is there severe weakness on one side?"
            ]
            
            return SafetyResult(
                urgency="urgent",
                flags=["clarification_needed"],
                action="clarify",
                questions=questions,
                message_override="These symptoms could be serious. Before I can answer, please reply 'Yes' or 'No' to these questions:\n\n" + "\n".join([f"- {q}" for q in questions])
            )

        # Clear pending flag if they respond (simplified logic: any response clears pending for now)
        if session.get("urgent_pending", False):
            session["urgent_pending"] = False

        # --- 3. Non-compliance (Urgent but refusing help) ---
        if session.get("last_triage") in ["urgent", "emergency"] and self._matches_any(text, self.non_compliance_patterns):
            return SafetyResult(
                urgency="urgent",
                flags=["non_compliance_detected"],
                action="escalate",
                message_override="I can't safely guide treatment without medical assessment. Please contact urgent care or a doctor immediately."
            )

        # --- 4. Refusal (Prescriptions/Diagnosis) ---
        if self._matches_any(text, self.refusal_patterns):
            msg = (
                "I cannot provide specific medical diagnoses, prescriptions, or dosage instructions. "
                "Please consult a doctor or pharmacist for medication advice. "
            )
            return SafetyResult(
                urgency="self_care",
                flags=["refusal_applied"],
                action="refuse",
                message_override=msg
            )

        # --- 5. Allow ---
        return SafetyResult(
            urgency="self_care",
            flags=[],
            action="allow"
        )

safety_service = SafetyService()
