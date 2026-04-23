"""Generates pedagogical mentor responses and structured learning roadmaps.

By translating abstract planning strategies and memory context into concrete,
natural language or structured data, this agent ensures the user receives
personalized, actionable, and encouraging guidance.
"""
from google import genai
import json
import uuid
from typing import Dict, Any, Optional, List
from app.core.config import settings
from app.services.llm_utils import strip_json_fences
from app.utils.logger import logger

class ExecutorAgent:
    def __init__(self):
        """Internal helper."""
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def _build_response_prompt(
        self,
        user_context: Dict[str, Any],
        current_message: str,
        strategy: Dict[str, Any],
    ) -> str:
        """Build the shared mentor-response prompt for sync and streaming generation.

        Redesigned to inject the full user_context as discrete labeled sections
        rather than relying on a single context_summary string. The system prompt
        defines the persona, pedagogical obligations, strategy contracts, depth
        standards, and explicit prohibitions.
        """
        # ── Extract structured context from all memory layers ──────────
        profile = user_context.get("profile", {})
        session = user_context.get("session", {})
        concepts = user_context.get("concepts", {})
        recent_messages = user_context.get("recent_messages", [])
        last_eval = user_context.get("last_evaluation", {})

        experience_level = profile.get("experience_level", "beginner")
        mentoring_tone = profile.get("mentoring_tone", "balanced")
        career_interests = ", ".join(profile.get("career_interests", [])) or "not specified"
        strengths = ", ".join(profile.get("strengths_summary", [])) or "none identified yet"
        weaknesses = ", ".join(profile.get("weaknesses_summary", [])) or "none identified yet"

        session_goal = session.get("session_goal") or session.get("goal") or "not yet established"
        session_momentum = session.get("session_momentum") or session.get("momentum", "cold_start")
        session_clarity = session.get("session_clarity") or session.get("clarity", 50.0)
        active_concepts = session.get("active_concepts", [])
        confusion_points = session.get("session_confusion_points") or session.get("confusion_points", [])

        # ── Build concept mastery block ────────────────────────────────
        concept_lines = []
        active = concepts.get("active", {})
        if active:
            for cid, info in active.items():
                mastery = info.get("mastery", 0.0)
                misconceptions = info.get("misconceptions", [])
                miscon_str = f" | Known misconceptions: {', '.join(misconceptions)}" if misconceptions else ""
                concept_lines.append(f"  - {cid}: mastery={mastery:.0%}, exposure={info.get('exposure_count', 0)}{miscon_str}")
        else:
            concept_lines.append("  (No concepts tracked yet for this learner)")
        related_weak = concepts.get("related_weak", [])
        if related_weak:
            concept_lines.append("  Weak related concepts (may need prerequisite review):")
            for rw in related_weak:
                concept_lines.append(f"    - {rw.get('concept_name', '?')}: mastery={rw.get('mastery', 0.0):.0%}")
        concept_block = "\n".join(concept_lines)

        # ── Build misconceptions block ─────────────────────────────────
        misconception_lines = []
        if active:
            for cid, info in active.items():
                for m in info.get("misconceptions", []):
                    misconception_lines.append(f"  - {cid}: {m}")
        if last_eval.get("misconception_detail"):
            misconception_lines.append(f"  - (Latest) {last_eval.get('misconception_detail', '')}")
        misconceptions_block = "\n".join(misconception_lines) if misconception_lines else "  None known."

        # ── Build recent conversation block ────────────────────────────
        convo_lines = []
        if recent_messages:
            for msg in recent_messages[-6:]:
                role = "Learner" if msg.get("sender") == "user" else "Mentor"
                content = msg.get("content", "")[:300]
                convo_lines.append(f"  {role}: {content}")
        convo_block = "\n".join(convo_lines) if convo_lines else "  (This is the first message in this session)"

        # ── Strategy and pacing ────────────────────────────────────────
        current_strategy = strategy.get("strategy", "guide")
        tone = strategy.get("tone", "warm")
        pacing = strategy.get("pacing", "medium")
        response_depth = strategy.get("response_depth", "standard")
        should_ask_question = strategy.get("should_ask_question", True)

        # ── Strategy overlay (per-strategy behavioral instructions) ────
        strategy_overlay = ""
        if current_strategy == "redirect":
            prereqs = strategy.get("redirect_to_concepts", [])
            target = prereqs[0] if prereqs else "foundational concepts"
            strategy_overlay = f"""
REDIRECT INSTRUCTIONS:
The learner is attempting material beyond their current readiness.
1. Acknowledge what they're trying to learn and validate their ambition.
2. Explain specifically which prerequisite concept ({target}) they would benefit from strengthening first and WHY it matters for the topic they asked about.
3. Begin teaching that prerequisite concept right here — define it, give an example, and connect it to what they already know.
4. End by connecting this prerequisite back to their original question so they see the path forward.
Do NOT just tell them to "review {target} first" — actually teach it."""

        elif current_strategy == "correct_misconception":
            misconception = strategy.get("misconception_to_address", "this concept")
            correct_model = strategy.get("correct_model", "a different understanding")
            strategy_overlay = f"""
MISCONCEPTION CORRECTION INSTRUCTIONS:
The learner has a specific incorrect mental model that must be addressed.
1. Name the misconception clearly: "{misconception}"
2. Explain why this belief is reasonable — where it comes from and why many learners develop it.
3. Present the correct model: "{correct_model}" — explain it step by step with a concrete example.
4. Show a specific scenario where the misconception would lead to the wrong answer and the correct model leads to the right one.
5. Summarize the key distinction so the learner has a clear "rule" to remember."""

        elif current_strategy == "simplify":
            strategy_overlay = """
SIMPLIFY INSTRUCTIONS:
The learner is overwhelmed. Too many concepts at once or too complex an explanation.
1. Strip the topic to its absolute core idea — one sentence.
2. Use the simplest possible analogy from everyday life.
3. Build back up with ONE additional layer of detail only.
4. Do not introduce any new terminology. Use words they already know.
5. Break any multi-step process into numbered steps with one idea per step."""

        elif current_strategy == "encourage":
            strategy_overlay = """
ENCOURAGE INSTRUCTIONS:
The learner is stuck and their confidence is low.
1. Acknowledge their frustration genuinely — name the specific difficulty, don't be generically positive.
2. Normalize the struggle by explaining that this specific concept is genuinely challenging and why.
3. Identify something concrete they already understand that is RELATED to this topic.
4. Rebuild from that known foundation toward the concept they're struggling with, using smaller steps.
5. End with a specific, small next step they can try — not a vague "keep going!"."""

        # ── Assemble the full prompt ───────────────────────────────────
        return f"""You are an expert mentor — a knowledgeable, patient human teacher who happens to be available 24/7. You are NOT a chatbot, NOT a search engine, and NOT an AI assistant. You are a real mentor who has deep domain expertise and genuinely cares about this specific learner's growth.

YOUR OBLIGATIONS AS A MENTOR:
- You teach at the learner's level — not above (which alienates) and not below (which patronizes).
- You use analogies, concrete examples, and worked-through demonstrations — not abstract summaries.
- You acknowledge what the learner specifically said before responding — you prove you listened.
- You never give one-line answers to conceptual questions. If someone asks "how does X work?", a one-sentence answer is a failure.
- You connect new concepts to what the learner already knows — you build bridges, not islands.
- You speak as a peer who knows more, not as an authority pronouncing facts.

STRATEGY CONTRACTS — what "{current_strategy}" requires you to do:

  "guide" = Walk the learner through understanding step by step. Don't just explain — build incrementally. Start from what they know, add one layer at a time, check understanding at each step. Use questions to lead them to insights rather than handing answers directly.

  "explain" = Full comprehensive explanation. Must include: (1) plain-language definition, (2) the intuition behind it — WHY it works this way, (3) a concrete example worked through step by step, and (4) connections to what the learner already knows. This is teaching, not summarizing.

  "challenge" = The learner understands the basics. Push deeper. Pose a problem or edge case that requires them to APPLY the concept, not just recite it. Present a scenario and ask them to reason through it. After they think about it, explain the nuances they might miss.

  "encourage" = The learner is stuck or losing confidence. Address the emotional state FIRST, then simplify and rebuild. Use smaller steps. Normalize the difficulty. Find something they already understand and build from there.

  "correct_misconception" = The learner has a specific wrong mental model. Name it, explain why it's wrong, rebuild the correct model with evidence and examples. Don't just say "actually, X" — show WHY X is correct through demonstration.

  "simplify" = The learner is overwhelmed. Strip to the absolute core idea. One concept at a time. Everyday analogies. No jargon. Numbered steps for processes.

  "redirect" = The learner needs prerequisites before they can understand this topic. Explain which prerequisite is missing and WHY it matters, then BEGIN teaching that prerequisite right here.

RESPONSE DEPTH — what "{response_depth}" requires:

  "surface" = Brief acknowledgment, encouragement, or simple factual answer. 2-4 sentences. Use ONLY for greetings, casual chat, or simple yes/no questions.

  "standard" = Thorough explanation with at least one example. Definition + intuition + example. Typically 150-250 words. This is your default depth for most learning interactions.

  "deep" = Comprehensive treatment. Definition + intuition + multiple examples + edge cases + connections to related concepts. Typically 250-400 words. Use for important conceptual questions or when the learner is building a new mental model.

  "comprehensive" = Full teaching module. Everything in "deep" plus worked-through problems, common pitfalls, and how this concept fits into the broader picture. 400+ words. Use for complex topics or when the learner explicitly asks for thorough understanding.

DEPTH STANDARDS BY QUERY TYPE:
- Conceptual question ("how does X work?", "explain Y"): Include definition, intuition, concrete example traced step by step, and connection to what the learner knows. Never shorter than "standard" depth.
- Debugging/problem-solving ("why is X doing Y?", "I'm getting an error"): Include what the problem is, why it happens mechanically, how to fix it specifically, and how to prevent it in future.
- Review/clarification ("did I understand correctly?", "so X means Y?"): Confirm what they got right (be specific), precisely correct what they got wrong, and solidify the distinction with a brief example.
- Emotional/motivational ("I'm stuck", "this is hard"): Acknowledge genuinely (not generically), normalize the difficulty, identify a concrete strength they've shown, and provide a specific small next step.

PROHIBITIONS — you must NEVER:
- Produce a response shorter than the query type warrants (a conceptual question answered in one sentence is a failure)
- Summarize without explaining (summaries are what search engines do, not mentors)
- Repeat the user's question back at them as a stall ("So you're asking about X...")
- End a conceptual explanation without a concrete example
- Use the words "simply" or "just" — these minimize difficulty and alienate struggling learners
- Suggest the learner "look it up" or "check the documentation" — you ARE their resource
- Give a response that would be identical regardless of the learner's profile
- Open with "Great question!" or "Of course!" or any formulaic praise
- Use filler phrases that add no information

═══════════════════════════════════════════════════════
LEARNER PROFILE:
  Experience level: {experience_level}
  Communication preference: {mentoring_tone}
  Areas of interest: {career_interests}
  Known strengths: {strengths}
  Known weaknesses: {weaknesses}

SESSION STATE:
  Session goal: {session_goal}
  Momentum: {session_momentum}
  Current clarity: {session_clarity}/100
  Active concepts: {', '.join(active_concepts) if active_concepts else 'none yet'}
  Confusion points: {', '.join(confusion_points) if confusion_points else 'none'}

RELEVANT CONCEPTS (learner's current mastery):
{concept_block}

KNOWN MISCONCEPTIONS (avoid reinforcing these):
{misconceptions_block}

CONVERSATION HISTORY:
{convo_block}

PEDAGOGICAL STRATEGY FOR THIS RESPONSE:
  Strategy: {current_strategy}
  Tone: {tone}
  Pacing: {pacing}
  Response depth: {response_depth}
  Ask a follow-up question: {should_ask_question}
{strategy_overlay}
═══════════════════════════════════════════════════════

CONTEXT SUMMARY:
{user_context.get('context_summary', 'A learner seeking guidance.')}

THE LEARNER SAYS:
"{current_message}"

YOUR RESPONSE (use markdown formatting where helpful — headers for distinct sections, code blocks for code, bullet points for lists):"""
    
    def generate_response(self, user_context: Dict[str, Any], current_message: str, strategy: Dict[str, Any]) -> str:
        """Generate a natural language mentor response based on context and strategy.

        Args:
            user_context: Aggregated identity and knowledge context.
            current_message: The latest user input string.
            strategy: Pedagogical controls (tone, verbosity, strategy type).

        Returns:
            A string containing the mentor's response, constrained by strategy.
        """
        prompt = self._build_response_prompt(user_context, current_message, strategy)

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            logger.error("Executor response error: %s", e)
            return "I'm with you. Tell me more about what's on your mind."

    def generate_response_stream(
        self,
        user_context: Dict[str, Any],
        current_message: str,
        strategy: Dict[str, Any],
    ):
        """Yield raw model chunks for real-time WebSocket streaming."""
        prompt = self._build_response_prompt(user_context, current_message, strategy)

        try:
            for chunk in self.client.models.generate_content_stream(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            ):
                text = getattr(chunk, "text", None)
                if text:
                    yield text
        except Exception as e:
            logger.error("Executor streaming error: %s", e)
            raise

    async def generate_response_stream_async(
        self,
        user_context: Dict[str, Any],
        current_message: str,
        strategy: Dict[str, Any],
    ):
        """Yield raw model chunks asynchronously for real-time WebSocket streaming."""
        prompt = self._build_response_prompt(user_context, current_message, strategy)

        try:
            response_stream = await self.client.aio.models.generate_content_stream(
                model=settings.GEMINI_MODEL,
                contents=prompt,
            )
            async for chunk in response_stream:
                text = getattr(chunk, "text", None)
                if text:
                    yield text
        except Exception as e:
            logger.error("Executor async streaming error: %s", e)
            raise
    
    def generate_voice_response(self, user_context: Dict[str, Any], current_message: str, strategy: Dict[str, Any]) -> str:
        """Generate a voice-optimized response for text-to-speech.

        Args:
            user_context: Aggregated identity and knowledge context.
            current_message: The latest user input string.
            strategy: Basic pedagogical controls.

        Returns:
            A string (max 6-8 sentences) optimized for natural speech.
        """
        experience = user_context.get("profile", {}).get("experience_level", "beginner")
        prompt = f"""You are a mentor speaking directly to a {experience}-level learner. This will be read aloud by text-to-speech.

MESSAGE: "{current_message}"

Approach: {strategy.get('strategy', 'guide')}
Tone: {strategy.get('tone', 'warm')}

VOICE RULES:
1. MAX 6-8 natural sentences
2. Use conversational spoken language — no bullet points, no markdown, no headers
3. Warm but substantive — actually teach, don't just encourage
4. Lead with the key insight, then explain with a brief analogy or example
5. If this is a conceptual question, give the answer with a concrete example
6. End with one forward-looking thought or question
7. Avoid words that sound awkward when spoken aloud

Voice response:"""

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            logger.error("Executor voice error: %s", e)
            return "I hear you. Let's explore that together."
    
    async def generate_roadmap(self, user_id: str, goal: str, context: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Synthesize a personalized, multi-stage learning roadmap for a specific goal.

        Args:
            user_id: The learner for whom the roadmap is generated.
            goal: The primary objective or topic to master.
            context: Optional additional constraints or preferences.

        Returns:
            Structured roadmap Dict containing stages and steps, or None on failure.
        """
        from app.agents.memory_agent import MemoryAgent
        memory = MemoryAgent()
        user_context = await memory.get_user_context(user_id)
        
        learning_pace = user_context.get('profile', {}).get('learning_pace', 'moderate')
        onboarding = user_context.get('onboarding', {})
        
        prompt = f"""Create a personalized growth roadmap for this goal.

GOAL: {goal}

ABOUT THIS PERSON:
- Interests: {user_context.get('profile', {}).get('interests', [])}
- Current stage: {user_context.get('profile', {}).get('stage', 'seedling')}
- Past struggles: {[s.get('topic') for s in user_context.get('struggles', [])[:3]]}
- Learning pace: {learning_pace}
- Mentoring style preferred: {onboarding.get('mentoring_style', 'supportive')}
- Experience level: {onboarding.get('experience_level', 'intermediate')}
- Additional context: {context or 'None provided'}

Create a roadmap with 3-4 stages. Each stage should have 3-5 clear, achievable steps.
The language should be encouraging, not demanding.

IMPORTANT: Generate JSON that can be DIRECTLY rendered by the frontend.
Include UI hints for visual styling.

OUTPUT AS JSON:
{{
    "title": "A warm title for this journey",
    "stages": [
        {{
            "id": "stage-1",
            "name": "Stage name (growth metaphor)",
            "description": "What this stage cultivates",
            "status": "pending",
            "order": 1,
            "ui_hints": {{
                "color": "#5C6B4A",
                "icon": "sprout"
            }},
            "steps": [
                {{
                    "id": "step-1-1",
                    "title": "Step title (action-oriented)",
                    "description": "What this step nurtures and why it matters",
                    "status": "pending",
                    "step_type": "learn|practice|build|reflect|milestone",
                    "resources": ["optional resource links"],
                    "ui_hints": {{
                        "estimated_time": "30 mins",
                        "priority": "medium"
                    }},
                    "user_feedback": []
                }}
            ]
        }}
    ]
}}

STEP TYPES:
- "learn": Reading/watching content
- "practice": Hands-on exercise
- "build": Create something
- "reflect": Journal/think deeply
- "milestone": Celebrate achievement

USE ENCOURAGING COLORS:
- #5C6B4A (sage green)
- #D4A574 (warm tan)
- #8B8178 (soft gray)
- #4A5A3A (deep green)

RESPOND ONLY WITH VALID JSON."""

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            text = strip_json_fences(response.text.strip())
            
            roadmap = json.loads(text)
            
            # Ensure all IDs are unique and structure is complete
            total_steps = 0
            for i, stage in enumerate(roadmap.get("stages", [])):
                if not stage.get("id"):
                    stage["id"] = f"stage-{uuid.uuid4().hex[:8]}"
                stage["status"] = stage.get("status", "pending")
                stage["order"] = stage.get("order", i + 1)
                if not stage.get("ui_hints"):
                    stage["ui_hints"] = {"color": "#5C6B4A"}
                
                for j, step in enumerate(stage.get("steps", [])):
                    if not step.get("id"):
                        step["id"] = f"step-{uuid.uuid4().hex[:8]}"
                    step["status"] = step.get("status", "pending")
                    step["step_type"] = step.get("step_type", "learn")
                    step["user_feedback"] = step.get("user_feedback", [])
                    if not step.get("ui_hints"):
                        step["ui_hints"] = {}
                    total_steps += 1
            
            roadmap["total_steps"] = total_steps
            roadmap["completed_steps"] = 0
            
            return roadmap
        except Exception as e:
            logger.error("Executor roadmap error: %s", e)
            return None
    
    async def regenerate_roadmap(self, user_id: str, old_roadmap: Dict[str, Any], feedback: List[Dict], evaluator_analysis: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Adjust an existing roadmap based on learner feedback and evaluator insights.

        Args:
            user_id: The learner.
            old_roadmap: The previous roadmap structure to be modified.
            feedback: List of user feedback events (stuck points, clarity).
            evaluator_analysis: Optional deep analysis of learning pace and difficulty.

        Returns:
            A modified, often simplified or refined roadmap structure.
        """
        from app.agents.planner_agent import PlannerAgent
        planner = PlannerAgent()
        
        # Get adjustment plan
        adjustment = planner.plan_roadmap_adjustment(old_roadmap, feedback)
        
        # Summarize stuck points
        stuck_topics = []
        for f in feedback:
            if f.get("feedback_type") in ["stuck", "not_clear", "needs_help"]:
                stuck_topics.append(f.get("step_id"))
        
        # Use evaluator analysis for smarter regeneration
        learning_pace = "moderate"
        should_simplify = False
        difficulty_areas = []
        
        if evaluator_analysis:
            learning_pace = evaluator_analysis.get("new_learning_pace") or "moderate"
            should_simplify = evaluator_analysis.get("should_simplify", False)
            difficulty_areas = evaluator_analysis.get("difficulty_areas", [])
        
        pace_instruction = ""
        if learning_pace == "slow":
            pace_instruction = "This user learns best with SLOW, methodical steps. Break everything into small pieces."
        elif learning_pace == "fast":
            pace_instruction = "This user can handle a faster pace. Keep steps concise but don't oversimplify."
        
        prompt = f"""Regenerate this learning roadmap to be more supportive.

ORIGINAL GOAL: {old_roadmap.get('goal', 'Unknown')}
ORIGINAL TITLE: {old_roadmap.get('title', 'Unknown')}

ADJUSTMENT PLAN:
- Action: {adjustment.get('action')}
- Reasoning: {adjustment.get('reasoning')}
- Add prerequisites: {adjustment.get('add_prerequisites')}
- Focus on: {adjustment.get('recommended_focus')}

STEPS USER STRUGGLED WITH: {stuck_topics}
DIFFICULTY AREAS: {difficulty_areas}
LEARNING PACE: {learning_pace}
SHOULD SIMPLIFY: {should_simplify}

{pace_instruction}

Create a gentler, more supportive roadmap. If the user was stuck:
- Break complex steps into smaller pieces
- Add foundational steps if needed
- Use more encouraging language
- Ensure nothing feels overwhelming

OUTPUT AS JSON (same structure as before):
{{
    "title": "An encouraging new title",
    "stages": [...]
}}

The new roadmap should acknowledge growth while providing an easier path.
RESPOND ONLY WITH VALID JSON."""

        try:
            response = self.client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt
            )
            text = strip_json_fences(response.text.strip())
            
            roadmap = json.loads(text)
            
            # Ensure IDs
            for i, stage in enumerate(roadmap.get("stages", [])):
                if not stage.get("id"):
                    stage["id"] = f"stage-{uuid.uuid4().hex[:8]}"
                for j, step in enumerate(stage.get("steps", [])):
                    if not step.get("id"):
                        step["id"] = f"step-{uuid.uuid4().hex[:8]}"
                    step["status"] = step.get("status", "pending")
            
            return roadmap
        except Exception as e:
            logger.error("Executor regenerate error: %s", e)
            return None
