# Phase 5 Research Documentation — Pedagogical Intelligence

Phase 5 of Synapse introduces computational models of modern educational theory. This document outlines the theoretical foundations of the Intelligence Stack upgrade.

## 1. Concept Prerequisite Graph + ZPD

**Theory**: Vygotsky's Zone of Proximal Development (1978).
**Implementation**: The system computes the "readiness" of a learner for any concept by analyzing the prerequisite graph against their current mastery (Layer 2 Memory). A concept is in the ZPD if its prerequisites are met but the concept itself is not yet mastered.

## 2. Scaffolding Level Engine

**Theory**: Bruner's Scaffolding Theory (1976).
**Implementation**: The system uses a deterministic algorithm to select the appropriate pedagogical strategy:
- **Full Scaffolding**: Direct explanation for novices.
- **Mild Scaffolding**: Hints and leading questions for intermediates.
- **Challenge Mode**: Advanced push for learners nearing mastery.

## 3. Hybrid Intelligence Architecture

**Theory**: Reliable Pedagogical AI.
**Implementation**: Synapse uses LLMs for high-stakes Natural Language Understanding (confusion detection, concept extraction) but relies on **Deterministic Rules** for high-stakes decision-making (ZPD alignment, strategy selection). This ensures pedagogical integrity while maintaining conversational flexibility.

## 4. Multi-Timescale Learning Analytics

**Theory**: Real-time Cognitive Modeling.
**Implementation**: The system tracks learning at three distinct scales:
- **Seconds**: Clarity and confusion scoring of the immediate turn.
- **Minutes**: Session momentum and goal progress.
- **Days/Weeks**: Learning velocity, struggle patterns, and profile evolution.

## 5. Closed-Loop Adaptive Teaching

**Theory**: Cybernetic Feedback in Education.
**Implementation**: Synapse creates a genuine feedback loop where assessment results (Evaluator) directly update the session context, which the Planner must read before generating the next response. This prevents "open-loop" conversational drift.
