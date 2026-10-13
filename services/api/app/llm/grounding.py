"""Grounding verification for persona claims and hypotheses."""

from app.llm.templates import PersonaWordingResult


class GroundingReport:
    def __init__(self, is_grounded: bool, ungrounded_claims: list[str], violations: list[str]):
        self.is_grounded = is_grounded
        self.ungrounded_claims = ungrounded_claims
        self.violations = violations


def verify_grounding(
    wording: PersonaWordingResult,
    valid_evidence_ids: set[str],
) -> GroundingReport:
    """
    Verifies that:
    1. Every observation claim references at least one valid evidence ID.
    2. No claims reference non-existent or other segment evidence IDs.
    3. Length bounds are strictly observed (name <= 60 chars, claims <= 160 chars).
    """
    violations = []
    ungrounded = []

    if len(wording.display_name) > 60:
        violations.append(f"Persona name exceeds 60 characters ({len(wording.display_name)} chars).")

    for claim in wording.summary_claims:
        if len(claim.text) > 160:
            violations.append(f"Claim text exceeds 160 characters: '{claim.text[:30]}...'")

        if claim.kind == "observation":
            if not claim.evidence_ids:
                ungrounded.append(claim.text)
                violations.append(f"Observation lacks supporting evidence IDs: '{claim.text}'")
            else:
                for eid in claim.evidence_ids:
                    if eid not in valid_evidence_ids:
                        ungrounded.append(claim.text)
                        violations.append(f"Referenced invalid evidence ID '{eid}' in claim '{claim.text}'")

    for hypo in wording.test_hypotheses:
        if len(hypo.text) > 160:
            violations.append(f"Hypothesis text exceeds 160 characters: '{hypo.text[:30]}...'")

    return GroundingReport(
        is_grounded=(len(violations) == 0 and len(ungrounded) == 0),
        ungrounded_claims=ungrounded,
        violations=violations,
    )
