"""
Executor Agent
Generates mentor responses and roadmaps using planner strategy and memory context.
This is the main user-facing output generator.

CONSTRAINTS:
- Text responses: 6-8 lines max
- Voice output: 5-6 lines max
- Must obey planner controls (verbosity, tone)
- No filler language, be concise
"""
import google.generativeai as genai
import os
import json
import uuid
from typing import Dict, Any, Optional, List

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


class ExecutorAgent:
    def __init__(self):
        self.model = genai.GenerativeModel("gemini-2.5-flash")
    
    def generate_response(
        self, 
        user_context: Dict[str, Any],
        current_message: str, 
        strategy: Dict[str, Any]
    ) -> str:
        """
        Generate a mentor response based on context and planner strategy.
        CONSTRAINED to 6-8 lines max for faster, focused responses.
        """
        # Get planner controls
        verbosity = strategy.get("verbosity", "normal")
        max_lines = strategy.get("max_lines", 6)
        pacing = strategy.get("pacing", "normal")
        
        # Adjust max lines based on verbosity
        if verbosity == "brief":
            max_lines = 8
        elif verbosity == "detailed":
            max_lines = 12
        
        prompt = f"""You are a wise, gentle mentor. Respond warmly but CONCISELY.

CONTEXT:
{user_context.get('context_summary', 'A person on their growth journey.')}
Interests: {user_context.get('profile', {}).get('interests', [])}
Goals: {user_context.get('profile', {}).get('goals', [])}

MESSAGE: "{current_message}"

PLANNER CONTROLS:
- Approach: {strategy.get('strategy', 'support')}
- Tone: {strategy.get('tone', 'warm')}
- Verbosity: {verbosity}
- Pacing: {pacing}
- Ask question: {strategy.get('should_ask_question', True)}

STRICT RULES:
1. DEFAULT STYLE: Point-to-point explanations. One sentence per point.
2. Paragraphs allowed ONLY for emotional reassurance or motivation.
3. MAX {max_lines} LINES total.
4. Stop once clarity is achieved. Do not over-explain.
5. Avoid repetition and filler.
6. If pacing is "slow", use simpler language.
7. One thoughtful question max if appropriate.

Respond now (max {max_lines} lines):"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Executor response error: {e}")
            return "I'm with you. Tell me more about what's on your mind."
    
    def generate_voice_response(
        self, 
        user_context: Dict[str, Any],
        current_message: str, 
        strategy: Dict[str, Any]
    ) -> str:
        """
        Generate a voice-optimized response (5-6 lines max).
        Even more concise for TTS output.
        """
        prompt = f"""You are a gentle mentor. Respond for VOICE output.

MESSAGE: "{current_message}"

Approach: {strategy.get('strategy', 'support')}
Tone: {strategy.get('tone', 'warm')}

VOICE RULES:
1. MAX 5 SHORT sentences
2. Easy to speak naturally
3. Warm but direct
4. No complex words

Voice response:"""

        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"Executor voice error: {e}")
            return "I hear you. Let's explore that together."
    
    async def generate_roadmap(
        self, 
        user_id: str, 
        goal: str,
        context: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Generate a personalized learning roadmap.
        Returns structured roadmap data designed for direct frontend rendering.
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
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            # Clean JSON
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            roadmap = json.loads(text.strip())
            
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
            print(f"Executor roadmap error: {e}")
            return None
    
    async def regenerate_roadmap(
        self, 
        user_id: str,
        old_roadmap: Dict[str, Any],
        feedback: List[Dict],
        evaluator_analysis: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Regenerate a roadmap based on feedback.
        Makes the path gentler where the user struggled.
        Uses evaluator analysis for learning pace adjustments.
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
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            
            roadmap = json.loads(text.strip())
            
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
            print(f"Executor regenerate error: {e}")
            return None
