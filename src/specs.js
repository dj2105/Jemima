// /src/specs.js
// Daniel’s generation specs — exported as plain JS objects for easy import.

export const JEMIMA_MATH_INTERLUDES_SPEC = {
  "meta": {
    "title": "Jemima Maths Interludes (Version D) — Few-Shot Prompt Pack for Gemini 2.0 Flash",
    "language": "en-GB",
    "style": "Playful, camp, concise. British English. Use metric and euros by default unless the location implies pounds.",
    "goal": "Generate a 4-beat mini-story (between quiz rounds) + 2 simple questions with single whole-number answers and explicit units.",
    "output_format": {
      "type": "object",
      "required": ["location", "beats", "questions", "answers"],
      "properties": {
        "location": "string — one of the allowed places or a sensible variant",
        "beats": "array[4] of strings — 1–2 sentences each, numbered details included",
        "questions": "array[2] of strings — each includes a blank and unit, e.g. 'How much change did Jemima get? ___ euros'",
        "answers": "array[2] of integers — whole-number solutions to the two questions, order-aligned with 'questions'"
      }
    }
  },
  "constraints": {
    "beats": {
      "count": 4,
      "numbers": "Each beat must contain at least one definite numeric fact.",
      "difficulty": "One-step maths only (add, subtract, simple multiply/divide by small integers).",
      "surrealism": "Allowed (e.g., goose honks, laughs) but keep the maths trivial and the units explicit if used in questions.",
      "red_herrings": "Permitted, but answers must be derivable from included facts without ambiguity."
    },
    "questions": {
      "count": 2,
      "units_required": true,
      "whole_number_answers": true,
      "types": [
        "money (euros/pounds contextually correct)",
        "counts (items, steps, tickets, laughs, goose honks, etc.)",
        "distance/time/volume/weight (m, km, minutes, ml, kg, etc.)"
      ]
    },
    "locations_allowed": [
      "Lidl", "Tesco", "Aldi", "Marks and Spencer", "JD Sports",
      "Galway", "Tower of London", "Praha", "supermarket", "DIY shop",
      "theme park", "Irish castle", "Black Forest, Germany",
      "Marlborough", "Panama City", "Panama Canal"
    ],
    "units_examples_realistic": [
      "euros", "pounds", "minutes", "hours", "metres", "kilometres",
      "millilitres", "litres", "grams", "kilograms", "tickets", "steps"
    ],
    "units_examples_surreal": [
      "goose honks", "laughs", "cat naps", "giant steps", "slices of cake",
      "clouds", "hats", "unicorns", "pages", "post-it notes"
    ],
    "randomisation": {
      "instruction": "Pick 4 distinct beats from the beat_library (or improvise similar) and present them in any order that still reads like a whimsical mini-story.",
      "note": "The four-beat prompts listed under 'beat_library' are examples; choose any 4 at random and shuffle."
    }
  },
  "beat_library": [
    "Jemima bought X bananas for €Y each and called them haute couture.",
    "She ate X biscuits out of a packet of Y and hid the rest under her hat.",
    "Jemima dropped X coins down a drain with theatrical sorrow.",
    "She sneezed X times in front of a stone-faced guard.",
    "Jemima strutted X metres with her shopping, winking at a pigeon.",
    "She counted X clouds shaped like sandwiches.",
    "Jemima bought X tickets at €Y each (one may be for an imaginary friend).",
    "She twirled her moustache X times (she does not have one).",
    "Jemima carried X bags but lost Y to a gust of wind.",
    "She drank X ml from a Y ml bottle and burped politely.",
    "Jemima tipped a busker X euros for a kazoo solo.",
    "She discovered X slices of toast in her handbag.",
    "Jemima climbed X steps while humming the wrong anthem.",
    "She laughed X times at a squid-shaped hat.",
    "Jemima bought X apples weighing Y kg in total.",
    "She spotted X unicorns dancing in a shop window.",
    "Jemima held X tickets, used Y, and hid the rest in her shoe.",
    "She tied her shoelaces X times and still tripped once.",
    "Jemima saw X geese and honked back Y times.",
    "She read X pages of a guidebook before a shiny spoon distracted her."
  ],
  "system_prompt": "You are Gemini 2.0 Flash. Generate a whimsical 4-beat Jemima mini-story set at a chosen location, then 2 clear questions with explicit units and whole-number answers. Use British English. Keep maths one-step simple. Include small red herrings. Return JSON precisely matching the output_format. Do not include explanations.",
  "examples": [
    {
      "location": "Lidl",
      "beats": [
        "Jemima arrived with €5 and a grin, declaring she would only buy essentials (bananas count as essentials).",
        "She bought 2 bananas at €1 each and a bread roll for €1.",
        "On the way out, she gifted 1 banana to a toddler wearing a cape.",
        "She performed 3 goose honks at the automatic doors for luck."
      ],
      "questions": [
        "How much change did Jemima get? ___ euros",
        "How many bananas did Jemima have left? ___ bananas"
      ],
      "answers": [2, 1]
    },
    {
      "location": "Tower of London",
      "beats": [
        "Jemima paid £12 for a ticket and £3 for a guide leaflet.",
        "She climbed 10 steps, then 5 more, announcing each step like a royal decree.",
        "A raven stared until she laughed 4 times and curtseyed.",
        "She found £5 in her pocket but kept it for a souvenir magnet later."
      ],
      "questions": [
        "How many steps did Jemima climb in total? ___ steps",
        "How much did she spend before the souvenir? ___ pounds"
      ],
      "answers": [15, 15]
    },
    {
      "location": "Panama City",
      "beats": [
        "Jemima swapped a 20-balboa note for a taxi ride costing 15 balboas.",
        "She counted 6 clouds shaped like ships while the taxi idled.",
        "At the market she bought 2 mangoes for 1 balboa each.",
        "She gave 1 mango to a busker who replied with 2 goose honks."
      ],
      "questions": [
        "How much money did Jemima have left after the taxi and mangoes? ___ balboas",
        "How many mangoes did Jemima still have? ___ mangoes"
      ],
      "answers": [3, 1]
    },
    {
      "location": "DIY shop",
      "beats": [
        "Jemima brought €10 to buy hooks for her glamorous bags.",
        "She bought 2 hooks at €2 each and a tiny 50 mm screw pack for €1.",
        "Outside, she gave €1 to a juggler because the juggling was ‘adequate’.",
        "She measured her patience at exactly 3 laughs."
      ],
      "questions": [
        "How much change did Jemima have left? ___ euros",
        "How many hooks did Jemima buy? ___ hooks"
      ],
      "answers": [4, 2]
    },
    {
      "location": "Galway",
      "beats": [
        "With €8 in her paw, Jemima bought a warm pastry for €3.",
        "She walked 400 metres along the quay practising her wave.",
        "Then she bought a tea for €2 and added 1 sugar (measured in exactly 1 spoon).",
        "A gull heckled her exactly 5 laughs’ worth."
      ],
      "questions": [
        "How much money remained after the pastry and tea? ___ euros",
        "How far did Jemima walk along the quay? ___ metres"
      ],
      "answers": [3, 400]
    },
    {
      "location": "Marks and Spencer",
      "beats": [
        "Jemima entered with £20 and a mission: fancy biscuits.",
        "She bought 1 tin for £6 and another for £6 (the tin matches her eyes).",
        "At the till she added a sparkling water for £2.",
        "She clinked the tins together exactly 4 times like tiny cymbals."
      ],
      "questions": [
        "How much change did Jemima have left? ___ pounds",
        "How many tins of biscuits did she buy? ___ tins"
      ],
      "answers": [6, 2]
    },
    {
      "location": "JD Sports",
      "beats": [
        "Jemima had €30 and very athletic intentions.",
        "She bought 1 headband for €5 and 1 water bottle for €7.",
        "She did 8 giant steps to test the headband’s speed properties.",
        "Then she added 1 pair of colourful laces for €3."
      ],
      "questions": [
        "How much money was left after all purchases? ___ euros",
        "How many items did she buy in total? ___ items"
      ],
      "answers": [15, 3]
    },
    {
      "location": "Irish castle",
      "beats": [
        "Jemima bought 2 tickets at €4 each (one for her, one for the ghost).",
        "She climbed 12 steps, then paused for 2 cat naps.",
        "In the gift nook she bought 1 postcard for €1.",
        "A suit of armour made her laugh 6 times."
      ],
      "questions": [
        "How much did Jemima spend in total? ___ euros",
        "How many steps did she climb? ___ steps"
      ],
      "answers": [9, 12]
    },
    {
      "location": "Aldi",
      "beats": [
        "Jemima entered with €10 and a tote bag that says ‘Yes Chef’.",
        "She bought 3 apples for €1 each and a 500 ml lemonade for €2.",
        "She drank 250 ml immediately because fizz is urgent.",
        "She waved at 4 trolley coins like old friends."
      ],
      "questions": [
        "How much change did Jemima get? ___ euros",
        "How much lemonade was left? ___ millilitres"
      ],
      "answers": [5, 250]
    },
    {
      "location": "Theme park",
      "beats": [
        "Jemima purchased 4 ride tickets at €3 each.",
        "She rode 3 times and saved 1 for later (responsible thrills).",
        "A mascot made her laugh 7 times, which she counted carefully.",
        "She bought a cone for €2 but the wind stole exactly 0 sprinkles."
      ],
      "questions": [
        "How much did the ride tickets cost in total? ___ euros",
        "How many ride tickets does Jemima have left? ___ tickets"
      ],
      "answers": [12, 1]
    }
  ]
};

export const QUIZ_MECHANICS_SPEC = {
  "version": "1.0",
  "purpose": "Mechanics and guardrails for constructing high-quality two-choice quiz questions using Gemini, with excellent multi-difficulty examples (not to be reproduced in generation).",
  "delivery_format": {
    "answer_options_per_question": 2,
    "option_roles": {
      "correct": "Absolutely, verifiably true.",
      "wrong": "Factually false. Plausibility tuned to round difficulty."
    },
    "distractor_difficulty_rules": {
      "easy": "Clearly implausible to an informed layperson.",
      "medium": "Plausible at a glance; wrong on a key fact.",
      "hard": "Close to correct but still false (date off, near-miss term, adjacent concept)."
    },
    "round_progression": [
      "pub",
      "enthusiast",
      "specialist"
    ],
    "wrong_option_selection_policy": "When delivering two-choice questions in-game, pick ONE distractor matching the current round difficulty from the authored set."
  },
  "selection_rules": {
    "max_questions_per_subject_per_game": 2,
    "min_unique_subjects_per_game": 6,
    "avoid_repetition_window_games": 3,
    "ban_list_of_trivial_patterns": [
      "What is the capital of {well-known country}?",
      "2+2=?, basic arithmetic",
      "Who wrote ‘Romeo and Juliet’?",
      "Which planet is known as the Red Planet?",
      "Largest ocean on Earth?",
      "Primary colours lists",
      "Obvious national animals/flags for most famous countries"
    ],
    "freshness_rules": {
      "when_applicable": "For current-events or evolving science/tech topics, only generate if a reliable source consensus exists and a date scope is included.",
      "avoid_speculation": true
    }
  },
  "constraints": {
    "max_question_length_chars": 160,
    "max_question_length_words": 28,
    "max_answer_length_chars": 80,
    "style": {
      "use_plain_British_English": true,
      "no_unnecessary_adjectives": true,
      "single_fact_per_question": true,
      "no_open_ended_or_opinion": true
    },
    "content_safety": {
      "no_hate_harassment": true,
      "no_medical_or_legal_advice_questions": true,
      "no_personal_data": true
    },
    "do_not_copy_examples": true
  },
  "screening_and_verification": {
    "factuality_pipeline": [
      "Draft with Gemini using the generation prompt.",
      "Self-check with Gemini using the verification prompt—require explicit justification + cited sources (names only) in the hidden rationale.",
      "Reject any item where verification returns low confidence, conflicting claims, or lacks at least two reputable reference points.",
      "Re-generate up to 2 times; if still dubious, discard."
    ],
    "disallowed_question_flags": [
      "Ambiguous or multi-correct",
      "Time-sensitive without date scope",
      "Regional spelling traps only (unless explicitly about orthography)",
      "Trick wording that changes truth conditions"
    ]
  },
  "topic_catalogue": [
    "The Roman Empire",
    "Laws of Physics",
    "Marine Biology",
    "Famous Inventions",
    "World Capitals",
    "Classic Literature",
    "The Cold War",
    "Human Anatomy",
    "Art Movements",
    "History of Cinema",
    "Geology",
    "Ancient Mythology",
    "Astronomy",
    "Computer Science Basics",
    "British History",
    "Environmental Science",
    "Mathematics",
    "Irish History",
    "Culinary Science",
    "Modern Architecture",
    "Renaissance Art",
    "Microeconomics",
    "Virology (general)",
    "1990s Pop Music"
  ],
  "gemini_prompts": {
    "generation_prompt": "You are generating multiple-choice quiz items to be delivered as two-option questions. Produce JSON only. Each item MUST have: subject, difficulty_tier in {pub, enthusiast, specialist}, question (≤160 chars, ≤28 words, single fact), correct_answer, distractors {easy, medium, hard}. The distractors must be false. The hard distractor must be close to the truth but still wrong. Keep answers ≤80 chars. Avoid trivial, over-used questions (e.g., capitals of famous countries). No ambiguous items. Use British English. DO NOT reuse or paraphrase any examples previously shown to you in this conversation. Ensure variety across subjects and enforce max 2 questions per subject per game.",
    "verification_prompt": "Verify the following quiz items for factual accuracy. For each item, check that the question statement is unambiguously true/false evaluable, the correct_answer is certainly correct, and each distractor is certainly incorrect. Flag any ambiguity, time-sensitivity without scope, or common counterexamples. Provide a verdict {pass|fail} and a brief justification citing at least two reputable references by name (e.g., Britannica, NASA, Oxford Reference). If fail, explain why and mark the item for discard."
  },
  "question_blueprints": [
    {
      "subject": "World Capitals",
      "do_not_ask": [
        "France → Paris",
        "Japan → Tokyo",
        "USA → Washington, D.C."
      ],
      "ask_instead": [
        "Historically moved capitals",
        "Capitals with identical city+country names",
        "Administrative vs constitutional capitals"
      ]
    },
    {
      "subject": "Laws of Physics",
      "pub": "Name/fate of a law in everyday phenomena.",
      "enthusiast": "Quantitative relationships without heavy algebra.",
      "specialist": "Boundary cases, historical formulation nuances, lesser-known constraints."
    }
  ],
  "post_generation_checks": {
    "length_check": "Drop questions >160 chars or >28 words.",
    "subject_cap_check": "At most 2 items per subject in final set.",
    "variety_check": "Ensure ≥6 distinct subjects per game.",
    "distractor_quality_check": "Easy/medium/hard plausibility gradient present.",
    "banlist_check": "Reject trivial/predictable templates.",
    "duplication_check": "No reuse/paraphrase of embedded examples."
  },
  "examples": [
    {
      "subject": "The Roman Empire",
      "difficulty_tier": "pub",
      "question": "Which emperor completed the Colosseum’s inauguration games?",
      "correct_answer": "Titus",
      "distractors": {
        "easy": "Julius Caesar",
        "medium": "Hadrian",
        "hard": "Vespasian"
      },
      "notes": "Hard is close: Vespasian began it; Titus inaugurated it."
    },
    {
      "subject": "Laws of Physics",
      "difficulty_tier": "pub",
      "question": "Which law explains why a rocket accelerates when expelling gas?",
      "correct_answer": "Newton’s third law",
      "distractors": {
        "easy": "Ohm’s law",
        "medium": "Bernoulli’s principle",
        "hard": "Conservation of charge"
      }
    },
    {
      "subject": "Marine Biology",
      "difficulty_tier": "enthusiast",
      "question": "Which structure do bony fish use to control buoyancy?",
      "correct_answer": "Swim bladder",
      "distractors": {
        "easy": "Gallbladder",
        "medium": "Lateral line",
        "hard": "Operculum"
      }
    },
    {
      "subject": "Famous Inventions",
      "difficulty_tier": "pub",
      "question": "The first practical telephone patent was granted to whom in 1876?",
      "correct_answer": "Alexander Graham Bell",
      "distractors": {
        "easy": "Thomas Edison",
        "medium": "Guglielmo Marconi",
        "hard": "Elisha Gray"
      }
    },
    {
      "subject": "World Capitals",
      "difficulty_tier": "enthusiast",
      "question": "Which country’s official capital is Sucre, not La Paz?",
      "correct_answer": "Bolivia",
      "distractors": {
        "easy": "Peru",
        "medium": "Ecuador",
        "hard": "Paraguay"
      }
    },
    {
      "subject": "Classic Literature",
      "difficulty_tier": "specialist",
      "question": "Which Austen novel first appeared anonymously as “By a Lady” in 1811?",
      "correct_answer": "Sense and Sensibility",
      "distractors": {
        "easy": "Emma",
        "medium": "Northanger Abbey",
        "hard": "Mansfield Park"
      }
    },
    {
      "subject": "The Cold War",
      "difficulty_tier": "enthusiast",
      "question": "In which year did the Berlin Wall fall?",
      "correct_answer": "1989",
      "distractors": {
        "easy": "1979",
        "medium": "1991",
        "hard": "1990"
      }
    },
    {
      "subject": "Human Anatomy",
      "difficulty_tier": "pub",
      "question": "What is the largest internal organ by mass in the human body?",
      "correct_answer": "Liver",
      "distractors": {
        "easy": "Brain",
        "medium": "Lung",
        "hard": "Spleen"
      }
    },
    {
      "subject": "Art Movements",
      "difficulty_tier": "specialist",
      "question": "Which manifesto is chiefly associated with Marinetti?",
      "correct_answer": "Futurist Manifesto",
      "distractors": {
        "easy": "Surrealist Manifesto",
        "medium": "Vorticist Manifesto",
        "hard": "Futurist Reconstruction of the Universe"
      }
    },
    {
      "subject": "History of Cinema",
      "difficulty_tier": "enthusiast",
      "question": "Which film pioneered ‘match on action’ in early editing studies?",
      "correct_answer": "The Great Train Robbery (1903)",
      "distractors": {
        "easy": "Metropolis (1927)",
        "medium": "The Birth of a Nation (1915)",
        "hard": "A Trip to the Moon (1902)"
      }
    },
    {
      "subject": "Geology",
      "difficulty_tier": "pub",
      "question": "Basalt is primarily which type of rock?",
      "correct_answer": "Igneous",
      "distractors": {
        "easy": "Sedimentary",
        "medium": "Metamorphic",
        "hard": "Evaporite"
      }
    },
    {
      "subject": "Ancient Mythology",
      "difficulty_tier": "enthusiast",
      "question": "In Greek myth, who slew the Minotaur?",
      "correct_answer": "Theseus",
      "distractors": {
        "easy": "Perseus",
        "medium": "Heracles",
        "hard": "Bellerophon"
      }
    },
    {
      "subject": "Astronomy",
      "difficulty_tier": "specialist",
      "question": "Which spectral class are the hottest main-sequence stars?",
      "correct_answer": "O-type",
      "distractors": {
        "easy": "K-type",
        "medium": "A-type",
        "hard": "B-type"
      }
    },
    {
      "subject": "Computer Science Basics",
      "difficulty_tier": "pub",
      "question": "What does CPU stand for?",
      "correct_answer": "Central Processing Unit",
      "distractors": {
        "easy": "Central Program Utility",
        "medium": "Core Processing Utility",
        "hard": "Central Processor Unit"
      }
    },
    {
      "subject": "British History",
      "difficulty_tier": "enthusiast",
      "question": "Which monarch’s reign is associated with the ‘Glorious Revolution’ of 1688?",
      "correct_answer": "James II (deposed)",
      "distractors": {
        "easy": "Charles II",
        "medium": "William IV",
        "hard": "George II"
      }
    },
    {
      "subject": "Environmental Science",
      "difficulty_tier": "pub",
      "question": "Which gas is the main driver of anthropogenic climate change?",
      "correct_answer": "Carbon dioxide",
      "distractors": {
        "easy": "Oxygen",
        "medium": "Nitrogen",
        "hard": "Argon"
      }
    },
    {
      "subject": "Mathematics",
      "difficulty_tier": "specialist",
      "question": "Which conjecture, proved by Wiles, concerns solutions to x^n + y^n = z^n for n>2?",
      "correct_answer": "Fermat’s Last Theorem",
      "distractors": {
        "easy": "Goldbach’s Conjecture",
        "medium": "Riemann Hypothesis",
        "hard": "abc Conjecture"
      }
    },
    {
      "subject": "Irish History",
      "difficulty_tier": "enthusiast",
      "question": "In which year was the Easter Rising?",
      "correct_answer": "1916",
      "distractors": {
        "easy": "1921",
        "medium": "1905",
        "hard": "1919"
      }
    },
    {
      "subject": "Culinary Science",
      "difficulty_tier": "pub",
      "question": "What process gives bread its rise?",
      "correct_answer": "Yeast fermentation producing CO₂",
      "distractors": {
        "easy": "Protein denaturation alone",
        "medium": "Starch retrogradation",
        "hard": "Maillard reaction gas release"
      }
    },
    {
      "subject": "Modern Architecture",
      "difficulty_tier": "specialist",
      "question": "Which architect is linked with ‘Less is more’ in Modernism?",
      "correct_answer": "Ludwig Mies van der Rohe",
      "distractors": {
        "easy": "Frank Lloyd Wright",
        "medium": "Le Corbusier",
        "hard": "Walter Gropius"
      }
    },
    {
      "subject": "Renaissance Art",
      "difficulty_tier": "enthusiast",
      "question": "Which painter created ‘The Birth of Venus’?",
      "correct_answer": "Sandro Botticelli",
      "distractors": {
        "easy": "Leonardo da Vinci",
        "medium": "Raphael",
        "hard": "Titian"
      }
    },
    {
      "subject": "Microeconomics",
      "difficulty_tier": "pub",
      "question": "What term describes additional satisfaction from one more unit consumed?",
      "correct_answer": "Marginal utility",
      "distractors": {
        "easy": "Total utility",
        "medium": "Opportunity cost",
        "hard": "Consumer surplus"
      }
    },
    {
      "subject": "Virology (general)",
      "difficulty_tier": "specialist",
      "question": "Which viral genome type describes influenza A?",
      "correct_answer": "Negative-sense single-stranded RNA",
      "distractors": {
        "easy": "Double-stranded DNA",
        "medium": "Positive-sense ssRNA",
        "hard": "Double-stranded RNA"
      }
    },
    {
      "subject": "1990s Pop Music",
      "difficulty_tier": "enthusiast",
      "question": "Which group released the 1996 single ‘Wannabe’?",
      "correct_answer": "Spice Girls",
      "distractors": {
        "easy": "Destiny’s Child",
        "medium": "All Saints",
        "hard": "B*Witched"
      }
    }
  ],
  "pseudocode_pipeline": {
    "generate": "items = Gemini(generation_prompt, {subject_mix, desired_count})",
    "verify": "review = Gemini(verification_prompt, items)",
    "filter": "approved = items where review.verdict == ‘pass’",
    "enforce_subject_caps": "approved = cap_per_subject(approved, 2)",
    "assemble_game_set": "ensure variety & round progression; trim to requested size"
  },
  "api_contract": {
    "item_schema": {
      "subject": "string (must be in topic_catalogue or a whitelisted extension)",
      "difficulty_tier": "pub|enthusiast|specialist",
      "question": "string (≤160 chars, ≤28 words)",
      "correct_answer": "string (≤80 chars)",
      "distractors": {
        "easy": "string (≤80 chars, clearly false)",
        "medium": "string (≤80 chars, plausible but false)",
        "hard": "string (≤80 chars, near-miss but false)"
      }
    }
  },
  "runtime_enforcement": {
    "two_choice_delivery": "At serve-time, select exactly one distractor matching the round difficulty.",
    "shuffling": "Randomise the order of the two options.",
    "logging": "Record subject, difficulty, length, and verification hash for audits.",
    "fallbacks": {
      "on_verification_failure": "Discard item; request regeneration.",
      "on_length_violation": "Auto-trim not allowed; must regenerate."
    }
  }
};
