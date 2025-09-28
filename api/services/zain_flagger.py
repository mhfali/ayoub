#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
from typing import Dict, Tuple, List, Optional

from api.db.services.llm_service import LLMBundle
from api.db import LLMType


class ZainContentFlagger:
    """LLM-only flagger to decide if a question can be answered from the Zain Kuwait knowledge base.

    Removal notice:
    - All keyword heuristics have been removed per requirement.
    - Only the LLM decides (ALLOW vs FLAG) using provided domain context + available document names.
    - A question is flagged ONLY when it cannot be answered from the knowledge base scope.
    """

    KNOWLEDGE_BASE_CONTEXT = """
You have access to Zain Kuwait's internal policy & procedure documents. They cover ONLY these domains:

1. Revenue & Receivables Accounting
   - Revenue Accounting Policy (IFRS 15): product setup, prepaid/postpaid, roaming, interconnect, VAS cost recognition.
   - Subscriber Receivables & Provision (IFRS 9): Expected Credit Loss (ECL) methodology, segmentation, ageing buckets, provisioning logic.

2. Fixed Asset Lifecycle Management (IAS 16)
   - Asset Receiving (vendor validation, MOBINET entry)
   - Asset Movement (transfers, ERP <-> MOBINET sync)
   - ERP–MOBINET Reconciliation (Fixed Asset Register alignment)
   - Asset Item Code Creation (classification, useful life setup)
   - Physical Inventory (bi-annual scanning, discrepancy handling)
   - Capitalization & Depreciation (criteria, methods, postings)
   - Asset Retirement (disposal, approvals, gain/loss calculation)

OUT OF SCOPE examples (should be FLAGGED): cooking, weather, sports, politics, unrelated companies, HR policies outside receivables/assets scope, network engineering specifics (unless directly tied to capitalization), generic trivia, personal advice.

IN SCOPE examples (should be ALLOWED): questions about revenue recognition steps, prepaid vs postpaid recognition, ECL calculation inputs, provisioning logic, depreciation method, capitalization criteria, asset reconciliation steps, retirement approvals, IFRS compliance in these covered processes.
"""

    def __init__(self, tenant_id: str, llm_id=None):
        self.tenant_id = tenant_id
        self.llm_id = llm_id
        try:
            if llm_id:
                # Try with specific LLM ID first
                self.llm_bundle = LLMBundle(tenant_id, LLMType.CHAT, llm_id)
            else:
                # Fall back to default LLM for tenant
                self.llm_bundle = LLMBundle(tenant_id, LLMType.CHAT)
            print(f"DEBUG: ZainFlagger initialized - tenant_id: {tenant_id}, llm_id: {llm_id}, llm_bundle: {'Available' if self.llm_bundle else 'None'}")
        except Exception as e:
            print(f"DEBUG: Failed to create LLM bundle: {e}")
            self.llm_bundle = None

    def _get_document_names(self, kb_ids: list) -> list:
        """Fetch document names for additional grounding (best-effort)."""
        try:
            if not kb_ids:
                return []
            from api.db.services.document_service import DocumentService
            names = []
            for kb_id in kb_ids:
                docs = DocumentService.query(kb_id=kb_id, status="1")
                for d in docs:
                    if getattr(d, "name", None):
                        names.append(d.name)
            return names
        except Exception:
            return []

    def _llm_decide(self, question: str, kb_ids: Optional[List[str]]) -> Tuple[bool, str]:
        """Core LLM decision: returns (is_answerable, reason)."""
        print(f"DEBUG: _llm_decide called with question: {question[:50]}...")
        print(f"DEBUG: LLM bundle available: {self.llm_bundle is not None}")
        
        if not self.llm_bundle:
            # Fallback: allow so user still gets an answer (can't safely decide)
            print("DEBUG: No LLM bundle available, defaulting to ALLOW")
            return True, "LLM unavailable; default allow"

        doc_names = self._get_document_names(kb_ids or [])
        doc_context = ("Available documents: " + ", ".join(doc_names[:12])) if doc_names else "(No document names retrieved)"
        print(f"DEBUG: Document context: {doc_context}")

        prompt = f"""You are reviewing a question for Zain Kuwait's finance knowledge base.

Question: {question}

Available documents: {doc_context}

The knowledge base covers:
- Revenue & Receivables Accounting (IFRS 15 & 9)
- Fixed Asset Management (IAS 16)
- Asset processes, depreciation, capitalization

Respond with exactly one of these formats:
ALLOW: reason
FLAG: reason

ALLOW if the question relates to revenue, receivables, fixed assets, depreciation, or capitalization.
FLAG if the question is about other topics like people, weather, sports, or unrelated subjects."""

        try:
            print("DEBUG: Calling LLM...")
            # Use similar parameters to successful calls
            raw = self.llm_bundle.chat(prompt, [], {"temperature": 0.3, "max_tokens": 200}).strip()
            print(f"DEBUG: LLM response: '{raw}'")
        except Exception as e:
            print(f"DEBUG: LLM call failed: {e}")
            # If LLM fails, allow the question to pass through for better UX
            return True, f"LLM failure, allowing question: {e}"

        # Handle empty or whitespace-only responses
        if not raw or not raw.strip():
            print("DEBUG: Empty LLM response, defaulting to ALLOW for better UX")
            return True, "Empty LLM response, allowing question"

        upper = raw.upper()
        if upper.startswith("ALLOW:"):
            print("DEBUG: LLM decided ALLOW")
            return True, raw.split(":", 1)[1].strip()
        if upper.startswith("FLAG:"):
            print("DEBUG: LLM decided FLAG")
            return False, raw.split(":", 1)[1].strip()
        
        # Unparseable response - be more lenient and allow for better UX
        print("DEBUG: Unparseable LLM response, defaulting to ALLOW for better UX")
        return True, f"Unrecognized LLM response format, allowing: {raw}"

    def check_question(self, question: str, kb_ids=None, use_llm: bool = True) -> Dict:
        is_answerable, reason = self._llm_decide(question, kb_ids if use_llm else [])
        return {
            "is_related": is_answerable,
            "is_flagged": not is_answerable,
            "reason": ("Answerable from KB: " + reason) if is_answerable else ("Not answerable from KB: " + reason),
            "method": "llm_only",
            "question": question,
            "response_message": None if is_answerable else "Your answer has been flagged"
        }

    def get_flag_reason(self, question: str, kb_ids=None, use_llm: bool = True) -> str:
        result = self.check_question(question, kb_ids, use_llm)
        if result["is_flagged"]:
            return f"Question flagged: {result['reason']} (method: {result['method']})"
        return ""


def create_zain_flagger(tenant_id: str, llm_id=None) -> ZainContentFlagger:
    return ZainContentFlagger(tenant_id, llm_id)