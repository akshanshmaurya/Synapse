"""
Concept Prerequisite Graph

Encodes the dependency relationships between concepts.
A concept's prerequisites must be sufficiently mastered before the
concept itself can be effectively taught — based on Vygotsky's Zone
of Proximal Development (1978).

This is a STATIC graph — it represents domain knowledge, not user state.
User-specific readiness is computed by combining this graph with the
user's ConceptMemory mastery scores.
"""
from typing import List, Set, Dict

# Each concept maps to its direct prerequisites and its domain.
# Prerequisites are concept_ids (slugified).
# A concept is "teachable" when ALL prerequisites have mastery >= threshold.

PREREQUISITE_GRAPH = {
    # ─── Python Fundamentals ───────────────────────────
    "variables": {
        "domain": "python",
        "prerequisites": [],
        "description": "Variable declaration, assignment, naming"
    },
    "data-types": {
        "domain": "python",
        "prerequisites": ["variables"],
        "description": "int, float, str, bool, type conversion"
    },
    "operators": {
        "domain": "python",
        "prerequisites": ["variables", "data-types"],
        "description": "Arithmetic, comparison, logical, assignment operators"
    },
    "conditionals": {
        "domain": "python",
        "prerequisites": ["operators"],
        "description": "if, elif, else, nested conditions"
    },
    "loops": {
        "domain": "python",
        "prerequisites": ["conditionals"],
        "description": "for, while, break, continue, nested loops"
    },
    "functions": {
        "domain": "python",
        "prerequisites": ["loops"],
        "description": "def, parameters, return, scope"
    },
    "strings": {
        "domain": "python",
        "prerequisites": ["data-types", "loops"],
        "description": "String methods, slicing, formatting"
    },
    "lists": {
        "domain": "python",
        "prerequisites": ["loops"],
        "description": "List operations, slicing, comprehensions"
    },
    "dictionaries": {
        "domain": "python",
        "prerequisites": ["lists"],
        "description": "Dict operations, iteration, nesting"
    },
    "file-io": {
        "domain": "python",
        "prerequisites": ["strings", "functions"],
        "description": "Reading, writing, with statement"
    },
    "error-handling": {
        "domain": "python",
        "prerequisites": ["functions"],
        "description": "try, except, finally, custom exceptions"
    },
    "oop-basics": {
        "domain": "python",
        "prerequisites": ["functions", "dictionaries"],
        "description": "Classes, objects, __init__, self"
    },
    "oop-inheritance": {
        "domain": "python",
        "prerequisites": ["oop-basics"],
        "description": "Inheritance, super(), method overriding"
    },
    "decorators": {
        "domain": "python",
        "prerequisites": ["functions", "oop-basics"],
        "description": "Function decorators, @syntax, closures"
    },
    "generators": {
        "domain": "python",
        "prerequisites": ["functions", "loops"],
        "description": "yield, generator expressions, lazy evaluation"
    },

    # ─── DSA ───────────────────────────────────────────
    "arrays": {
        "domain": "dsa",
        "prerequisites": ["lists"],
        "description": "Array operations, traversal, in-place modification"
    },
    "recursion": {
        "domain": "dsa",
        "prerequisites": ["functions"],
        "description": "Base case, recursive case, call stack"
    },
    "searching": {
        "domain": "dsa",
        "prerequisites": ["arrays", "loops"],
        "description": "Linear search, binary search"
    },
    "sorting": {
        "domain": "dsa",
        "prerequisites": ["arrays", "recursion"],
        "description": "Bubble, merge, quick sort, time complexity"
    },
    "linked-lists": {
        "domain": "dsa",
        "prerequisites": ["oop-basics", "recursion"],
        "description": "Singly, doubly linked lists, operations"
    },
    "stacks": {
        "domain": "dsa",
        "prerequisites": ["arrays", "linked-lists"],
        "description": "LIFO, push, pop, applications"
    },
    "queues": {
        "domain": "dsa",
        "prerequisites": ["arrays", "linked-lists"],
        "description": "FIFO, enqueue, dequeue, circular queue"
    },
    "hash-tables": {
        "domain": "dsa",
        "prerequisites": ["arrays", "dictionaries"],
        "description": "Hashing, collisions, hash maps"
    },
    "trees": {
        "domain": "dsa",
        "prerequisites": ["recursion", "linked-lists"],
        "description": "Binary trees, traversals, BST"
    },
    "graphs": {
        "domain": "dsa",
        "prerequisites": ["trees", "hash-tables", "queues"],
        "description": "BFS, DFS, adjacency list/matrix"
    },
    "dynamic-programming": {
        "domain": "dsa",
        "prerequisites": ["recursion", "arrays"],
        "description": "Memoization, tabulation, optimal substructure"
    },
    "time-complexity": {
        "domain": "dsa",
        "prerequisites": ["loops", "recursion"],
        "description": "Big O, analyzing algorithms"
    },

    # ─── System Design (Basics) ────────────────────────
    "api-basics": {
        "domain": "system_design",
        "prerequisites": ["functions", "dictionaries"],
        "description": "REST, HTTP methods, status codes"
    },
    "databases-intro": {
        "domain": "system_design",
        "prerequisites": ["dictionaries", "file-io"],
        "description": "SQL vs NoSQL, basic queries, schemas"
    },
    "caching": {
        "domain": "system_design",
        "prerequisites": ["hash-tables", "databases-intro"],
        "description": "Cache strategies, TTL, invalidation"
    },
    "load-balancing": {
        "domain": "system_design",
        "prerequisites": ["api-basics"],
        "description": "Round robin, consistent hashing"
    }
}

# Mastery threshold for a prerequisite to be considered "satisfied"
PREREQUISITE_MASTERY_THRESHOLD = 0.5


def get_prerequisites(concept_id: str) -> List[str]:
    """Return direct prerequisite concept_ids for a given concept."""
    concept = PREREQUISITE_GRAPH.get(concept_id)
    if not concept:
        return []
    return concept["prerequisites"]


def get_all_prerequisites(concept_id: str) -> Set[str]:
    """Return ALL prerequisites (transitive) using DFS.
    If recursion requires functions, and functions requires loops,
    then all_prerequisites(recursion) = {functions, loops}."""
    visited = set()
    stack = get_prerequisites(concept_id).copy()
    while stack:
        prereq = stack.pop()
        if prereq not in visited:
            visited.add(prereq)
            stack.extend(get_prerequisites(prereq))
    return visited


def get_dependents(concept_id: str) -> List[str]:
    """Return concepts that list this concept as a prerequisite.
    Useful for: 'now that user mastered X, what's unlocked?'"""
    dependents = []
    for cid, data in PREREQUISITE_GRAPH.items():
        if concept_id in data["prerequisites"]:
            dependents.append(cid)
    return dependents


def is_in_zpd(concept_id: str, user_mastery: Dict[str, float]) -> bool:
    """Check if a concept is in the user's Zone of Proximal Development.

    A concept is in the ZPD if:
    1. The user hasn't mastered it yet (mastery < 0.7)
    2. ALL prerequisites are sufficiently mastered (>= threshold)

    Args:
        concept_id: The concept to check
        user_mastery: Dict of {concept_id: mastery_score} from ConceptMemory

    Returns:
        True if the concept is in the user's ZPD
    """
    # Already mastered — not in ZPD (Zone 1)
    current_mastery = user_mastery.get(concept_id, 0.0)
    if current_mastery >= 0.7:
        return False

    # Check all prerequisites
    prereqs = get_prerequisites(concept_id)
    if not prereqs:
        # No prerequisites — always in ZPD if not mastered
        return True

    for prereq_id in prereqs:
        prereq_mastery = user_mastery.get(prereq_id, 0.0)
        if prereq_mastery < PREREQUISITE_MASTERY_THRESHOLD:
            # Prerequisite not met — this is Zone 3 (too hard)
            return False

    return True


def get_zpd_concepts(user_mastery: Dict[str, float],
                     domain: str = None) -> List[str]:
    """Return all concepts currently in the user's ZPD.
    Optionally filter by domain.

    These are the concepts the system SHOULD be teaching —
    they're the sweet spot where learning is most effective."""
    zpd = []
    for concept_id, data in PREREQUISITE_GRAPH.items():
        if domain and data["domain"] != domain:
            continue
        if is_in_zpd(concept_id, user_mastery):
            zpd.append(concept_id)
    return zpd


def get_recommended_next(user_mastery: Dict[str, float],
                          domain: str = None) -> List[Dict]:
    """Return ZPD concepts sorted by 'readiness' — how close the user
    is to being able to learn them effectively.

    Readiness = average mastery of prerequisites.
    Higher readiness = more prepared = should learn this first.

    Returns list of {concept_id, concept_name, domain, readiness,
    prerequisite_status: [{id, mastery, met: bool}]}"""
    zpd_concepts = get_zpd_concepts(user_mastery, domain)
    recommendations = []

    for concept_id in zpd_concepts:
        data = PREREQUISITE_GRAPH[concept_id]
        prereqs = get_prerequisites(concept_id)

        if not prereqs:
            readiness = 1.0  # No prereqs = fully ready
        else:
            readiness = sum(
                user_mastery.get(p, 0.0) for p in prereqs
            ) / len(prereqs)

        prereq_status = [
            {
                "id": p,
                "mastery": user_mastery.get(p, 0.0),
                "met": user_mastery.get(p, 0.0) >= PREREQUISITE_MASTERY_THRESHOLD
            }
            for p in prereqs
        ]

        recommendations.append({
            "concept_id": concept_id,
            "concept_name": data.get("description", concept_id),
            "domain": data["domain"],
            "readiness": round(readiness, 2),
            "current_mastery": user_mastery.get(concept_id, 0.0),
            "prerequisite_status": prereq_status
        })

    # Sort by readiness descending — most ready first
    recommendations.sort(key=lambda x: x["readiness"], reverse=True)
    return recommendations
