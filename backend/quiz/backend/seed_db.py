"""
Run ONCE to seed MongoDB with subject/topic data.
After seeding, delete or archive this file.

Usage: python seed_db.py
"""

import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
db = client["learnify"]
col = db["subjects"]

col.drop()  # clean slate on re-seed

col.insert_many([
    {
        "name": "Analysis of Algorithms",
        "nature": "technical",
        "topics": {
            "Week 1: Introduction": [
                "Briefing on CLO's",
                "Role of algorithms in computing",
                "Analysis on nature of input and size of input",
                "Empirical vs Analytical Analysis",
                "PseudoCode"
            ],
            "Week 2: Sorting Algorithm analysis": [
                "Insertion Sort",
                "Loop Invariant & Correctness",
                "Bubble Sort"
            ],
            "Week 3: Asymptotic notations - Part 1": [
                "Big-O: Upper Bound",
                "Big \u03a9: Lower Bound"
            ],
            "Week 4: Asymptotic notations - Part 2": [
                "Big \u0398: Upper and Lower Bound",
                "little-o",
                "little-\u03c9"
            ],
            "Week 5: Recursion and recurrence relations": [
                "Recursion fundamentals",
                "Recurrence relations"
            ],
            "Week 6: Algorithm Design Techniques": [
                "Brute Force Approach"
            ],
            "Week 7: Divide-and-conquer approach": [
                "Divide-and-conquer paradigm",
                "Divide-and-conquer strategy"
            ],
            "Week 8: Advanced Sorting": [
                "Merge Sort",
                "Quick Sort"
            ],
            "Week 9: Greedy approach": [
                "Greedy method",
                "Greedy strategy"
            ],
            "Week 10: Dynamic programming": [
                "Elements of Dynamic Programming",
                "Dynamic Programming techniques"
            ],
            "Week 11: Search trees": [
                "Binary Search Trees",
                "Tree operations"
            ],
            "Week 12: Heaps and Hashing": [
                "Heaps",
                "Hashing"
            ],
            "Week 13: Graph algorithms": [
                "Graph algorithms fundamentals",
                "Shortest paths",
                "Sparse graphs"
            ],
            "Week 14: String matching": [
                "String matching algorithms"
            ],
            "Week 15: Complexity classes": [
                "Introduction to complexity classes"
            ]
        }
    },
    {
        "name": "Theory of Automata",
        "nature": "technical",
        "topics": {
            "Week 1: Introduction to Formal Languages": [
                "Introduction to Formal and informal Languages",
                "Language in Abstract",
                "Alphabet sets and strings",
                "Examples of Sets, Strings and Languages",
                "Finite and Infinite Languages"
            ],
            "Week 2: Structural Representation": [
                "Automata and Complexity",
                "Kleen Closure and Positive Closure",
                "Recursive Definitions",
                "Unification"
            ],
            "Week 3: Finite State Automata": [
                "Deterministic Finite State Automata (DFA)",
                "The Language of a DFA",
                "Non Deterministic Finite State Automata (NFA)",
                "The extended Transition Function",
                "The Language of NFA"
            ],
            "Week 4: DFA Design and Equivalence": [
                "Designing DFAs",
                "Equivalence of NFA and DFA",
                "Epsilon NFA",
                "Equivalence of DFAs",
                "Epsilon Closure"
            ],
            "Week 5: Regular Expressions": [
                "Regular Grammars",
                "Building Regular Expressions for regular languages",
                "Operators and Precedence of Regular Expression",
                "Finite Automata and Regular Expressions"
            ],
            "Week 6: Regular Language Algorithms": [
                "Converting Regular Expression to Automata",
                "Algorithms for Regular Languages"
            ],
            "Week 7: Non-regular Languages & Finite Automata with Output": [
                "Pigeon hole principle for non-regular languages",
                "Closure properties of regular languages",
                "Finite Automata with output (Moore and Mealy Machines)"
            ],
            "Week 8: Mid Term": [
                "Mid Term Exam"
            ],
            "Week 9: Decidability": [
                "Deciding whether language is regular or non-regular",
                "Decidable Languages",
                "Proof that every context free Languages are decidable"
            ],
            "Week 10: Push Down Automata (PDA)": [
                "Introduction of Push down Automata",
                "Defining PDA",
                "Language accepted by PDA",
                "Deterministic PDAs"
            ],
            "Week 11: PDA and Context Free Languages": [
                "Regular Languages and Deterministic PDA",
                "DPDA and Context Free Languages",
                "Non-Deterministic PDA"
            ],
            "Week 12: Context Free Grammars & Derivations": [
                "Parse Trees construction",
                "Yield of Parse Trees",
                "Left Most & Right most Derivation",
                "Ambiguity"
            ],
            "Week 13: CFG and PDA Equivalence": [
                "Removing ambiguity from grammar",
                "Building a PDA for CFG",
                "Building CFG for PDA"
            ],
            "Week 14: Normal Forms": [
                "Simplification of Grammar",
                "Chomsky Normal Form (CNF)",
                "Greinbach Normal Form (GNF)",
                "Applications of Normal Forms"
            ],
            "Week 15: Pumping Lemma & Turing Machines": [
                "Pumping Lemma for Regular Languages",
                "Language of a Turing Machine",
                "Post machine (INSERT/DELETE subprograms)"
            ],
            "Week 16: Advanced Turing Machines": [
                "Transition diagram for Turing machine",
                "Universal Turing Machine",
                "Defining Computers by TMs"
            ]
        }
    },
    {
        "name": "Programming for Artificial Intelligence",
        "nature": "technical",
        "topics": {
            "Week 1: Python Basics": [
                "Variables, expressions, and statements",
                "Values, types, and keywords",
                "Operators and operands",
                "Asking the user for input",
                "Mnemonic variable names"
            ],
            "Week 2: Conditional Execution": [
                "Boolean expressions",
                "Logical operators",
                "Chained and Nested conditionals",
                "Try and except error handling"
            ],
            "Week 3: Functions": [
                "Built-in vs Math functions",
                "Random numbers",
                "Parameters and arguments",
                "Fruitful and void functions"
            ],
            "Week 4: Iteration": [
                "While statement and Infinite loops",
                "Continue and Break",
                "Definite loops using 'for'",
                "Loop patterns (Counting/Summing)"
            ],
            "Week 5: Strings and Pandas Introduction": [
                "String slices and immutability",
                "Introduction to Pandas Data Structures",
                "Series and DataFrame",
                "Index Objects"
            ],
            "Week 6: Data Manipulation with Pandas": [
                "Reindexing and Dropping entries",
                "Indexing, selection, and filtering",
                "Descriptive Statistics",
                "Handling Missing Data"
            ],
            "Week 7: Feature Engineering": [
                "Feature selection",
                "Feature extraction",
                "Implementation using international data sets"
            ],
            "Week 8: Dimensionality Reduction": [
                "PCA implementation in Python",
                "LDA implementation in Python",
                "Arithmetic and data alignment"
            ],
            "Week 9: Data Wrangling": [
                "Merging and Combining Data Sets",
                "Concatenating Along an Axis",
                "Reshaping and Pivoting",
                "Hierarchical Indexing"
            ],
            "Week 10: Data Transformation": [
                "Removing Duplicates",
                "Discretization and Binning",
                "Detecting and Filtering Outliers",
                "Indicator/Dummy Variables"
            ],
            "Week 11: Plotting and Visualization": [
                "Matplotlib API Primer",
                "Line, Bar, and Histogram Plots",
                "Scatter Plots",
                "Performance measures in classification"
            ],
            "Week 12: Computer Vision Tools": [
                "Introduction to Roboflow",
                "Labelling multiple images",
                "Apply YOLOv8 model"
            ],
            "Week 13: Group Operations & Cross-Validation": [
                "Split-apply-combine techniques",
                "Filling Missing Values with Group-specific Values",
                "Cross-validation variations and implementation"
            ],
            "Week 14: Time Series & Neural Networks": [
                "Time Series Basics and Plotting",
                "LSTM implementation using TensorFlow",
                "Convolutional Neural Network concepts"
            ],
            "Week 15: Deep Learning Optimization": [
                "Activation functions",
                "Optimization algorithms (Grid and Randomized search)",
                "CNN case study practice"
            ],
            "Week 16: Project Demonstration": [
                "Final Presentations",
                "Project Demos"
            ]
        }
    },
    {
        "name": "Parallel and Distributed Computing",
        "nature": "technical",
        "topics": {
            "Week 1: Foundations of Parallel Computing": [
                "Serial vs Parallel Computing",
                "Moore's Law",
                "Flynn's Taxonomy (SISD, SIMD, MISD, MIMD)",
                "Exploring Java using NetBeans"
            ],
            "Week 2: Parallel Platforms and Architecture": [
                "Parallelism types (Bit-level, Instruction, Task)",
                "Ideal Parallel Computer (PRAM models)",
                "Multithreading in Java"
            ],
            "Week 3: Interconnection Networks": [
                "Static vs Dynamic Topologies",
                "Network metrics (Diameter, Bisection Bandwidth)",
                "Synchronization of Threads"
            ],
            "Week 4: Communication Costs & Routing": [
                "Startup, Hop, and Word transfer time",
                "Store-and-Forward vs Cut Through Routing",
                "Message Passing Paradigm (MPI Demo)"
            ],
            "Week 5: Parallel Algorithm Design": [
                "Decomposition, Tasks, and Dependency Graphs",
                "Recursive and Data Decomposition",
                "Owner-computes Rule"
            ],
            "Week 6: Task Characteristics": [
                "Static vs Dynamic Task Generation",
                "Uniform vs Non-Uniform Tasks",
                "Search Algorithms (DFS, Best-First)"
            ],
            "Week 7: Load Balancing & Mapping": [
                "Static vs Dynamic Mapping",
                "OpenMP Programming Model",
                "Concurrent Tasks in OpenMP"
            ],
            "Week 8: Parallel Models & Synchronization": [
                "Data-Parallel, Task Graph, and Master-Slave Models",
                "OpenMP Library Functions",
                "Environment Variables"
            ],
            "Week 9: Parallel Graph Algorithms": [
                "Minimum Spanning Trees (Prims Parallel Formulation)",
                "Single Source Shortest Paths (Dijkstra's Parallel Formulation)"
            ],
            "Week 10: Advanced Graph Algorithms": [
                "All Pairs Shortest Path",
                "Floyd's Algorithm Parallel Formulation"
            ],
            "Week 11: Distributed Computing Basics": [
                "History and Architecture of Distributed Applications",
                "Strengths and Weaknesses"
            ],
            "Week 12: Distributed Paradigms": [
                "Client-Server Paradigm",
                "Distributed Object Model",
                "Mobile Agent and Groupware Paradigms"
            ],
            "Week 13: Middleware and Protocols": [
                "CORBA Object Interface",
                "Java IDL Package",
                "Connection-Oriented vs Connectionless Servers"
            ],
            "Week 14: Distributed Objects & RPC": [
                "Message Passing vs Distributed Objects",
                "Remote Procedure Calls (RPC)",
                "Java RMI (Remote Method Invocation)"
            ],
            "Week 15: Internet Applications": [
                "HTML, XML, HTTP",
                "Common Gateway Interface (CGI)",
                "Web Sessions and Cookies"
            ],
            "Week 16: Project Finals": [
                "Final Project Presentations",
                "Demonstrations"
            ]
        }
    },
    {
        "name": "Technical and Business Writing",
        "nature": "theoretical",
        "topics": {
            "Week 1: Task-Oriented Organization": [
                "Overview of technical writing",
                "User control of information",
                "Semantic page orientation"
            ],
            "Week 2: Professional Correspondence": [
                "The Seven Cs of Communication",
                "Memos and Emails",
                "Minutes of Meetings and Progress Reports"
            ],
            "Week 3: Audience Analysis": [
                "Types of audiences",
                "Anticipating transfer of learning",
                "Writing for specific user needs"
            ],
            "Week 4: Design and Visuals": [
                "Layout and Flowcharts",
                "Organizational Charts",
                "Team brainstorming techniques"
            ],
            "Week 5: Manuals Overview": [
                "Types of manuals",
                "Online vs Print manual considerations"
            ],
            "Week 6: Manual Construction": [
                "Planning the manual outline",
                "Ensuring irretrievability",
                "Editing and Revising"
            ],
            "Week 7: Usability": [
                "Usability vs User experience goals",
                "Heuristic evaluation",
                "Preparing an information plan"
            ],
            "Week 8: Graphics in Technical Documents": [
                "Why use graphics",
                "Captions and Callouts",
                "Writing standards for online documents"
            ],
            "Week 9: Usability Testing": [
                "Field testing vs User-driven design",
                "Setting performance objectives",
                "User models and applicability"
            ],
            "Week 10: Cognitive and Physical Models": [
                "GOMS (Goals, Objectives, Selections, Methods)",
                "KLM (Keystroke Level Model)",
                "Paper Prototype Evaluations"
            ],
            "Week 11: Editing and Fine Tuning": [
                "Types of editing",
                "Editing for cross-cultural readers",
                "Editing for translation"
            ],
            "Week 12: Business Reports": [
                "Informal vs Formal reports",
                "Addressing business problems through writing"
            ],
            "Week 13: Reporting and Presentations": [
                "Short vs Long Reports",
                "Guidelines for progress reporting",
                "Making successful presentations"
            ],
            "Week 14: Report Formatting": [
                "Preliminary pages and Main sections",
                "Page layout using grids",
                "Integrating text and graphic devices"
            ],
            "Week 15: Design Principles": [
                "Consistency, Emphasis, and Balance",
                "Typography and Contrast",
                "Indexing strategies"
            ],
            "Week 16: Final Presentations": [
                "Student presentations",
                "Final course wrap-up"
            ]
        }
    },
    {
        "name": "Introduction to Marketing",
        "nature": "theoretical",
        "topics": {
            "Week 1: Marketing in a changing World": [
                "Creating Customer Value and Satisfaction",
                "What is Marketing, Marketing Management",
                "Customer Needs, Wants, and Demands",
                "Market Offerings\u2014Products, Services, and Experiences",
                "Marketing Management Philosophies",
                "Customer Value and Satisfaction"
            ],
            "Week 2: Customer-Driven Marketing Strategy": [
                "Designing a Customer-Driven Marketing Strategy",
                "Marketing Management Orientations",
                "Preparing an Integrated Marketing Plan and Program",
                "Building Customer Relationships",
                "Marketing Challenges in the New Connected Millennium",
                "Capturing Value from Customers",
                "The Changing Marketing Landscape"
            ],
            "Week 3: Company and Marketing Strategy": [
                "Partnering to Build Customer Relationships",
                "Company-Wide Strategic Planning",
                "Setting Company Objectives and Goals",
                "Designing the Business Portfolio",
                "Marketing Strategy and the Marketing Mix"
            ],
            "Week 4: Marketing Analysis and Planning": [
                "Marketing Analysis",
                "Marketing Planning",
                "Marketing Implementation",
                "Marketing Department Organization",
                "Marketing Control"
            ],
            "Week 5: Analyzing the Marketing Environment": [
                "The Microenvironment",
                "The Macro environment",
                "The Demographic, Economic, Natural Environment"
            ],
            "Week 6: Consumer Behavior": [
                "Responding to the Marketing Environment",
                "Consumer Markets and Consumer Buyer Behavior",
                "Model of Consumer Behavior",
                "Characteristics Affecting Consumer Behavior"
            ],
            "Week 7: Buyer Decision Process": [
                "Types of Buying Decision Behavior",
                "The Buyer Decision Process"
            ],
            "Week 8: Market Segmentation and Targeting": [
                "Customer-Driven Marketing Strategy",
                "Creating Value for Target Customers",
                "Market Segmentation",
                "Requirements for Effective Segmentation",
                "Market Targeting",
                "Differentiation and Positioning"
            ],
            "Week 9: Product & Services Strategy": [
                "What is Product",
                "Product Classifications",
                "Individual Product Decisions",
                "Product line decisions",
                "Product mix decisions"
            ],
            "Week 10: Marketing strategies for Service Firms": [
                "Marketing strategies for Service Firms",
                "Branding Strategy: Building Strong Brands",
                "Brand Equity"
            ],
            "Week 11: New-Product Development": [
                "New-Product Development",
                "Product Life Cycle strategies",
                "Managing New-Product Development",
                "Customer-Centered New-Product Development"
            ],
            "Week 12: Product Life Cycle and Pricing": [
                "Product life cycle strategies",
                "Marketing Strategies at every product life cycle stage",
                "New-Product Pricing Strategies",
                "Market-Skimming Pricing",
                "Market-Penetration Pricing",
                "Product Mix Pricing Strategies",
                "Price Adjustment Strategies"
            ],
            "Week 13: Marketing Channels and Promotion": [
                "Marketing Channels",
                "Number of channel level",
                "Conventional and vertical marketing channel",
                "Definition of wholesaler and retailer",
                "Promotion",
                "IMC, promotion mix, Advertising"
            ],
            "Week 14: Sales and E-business": [
                "Sales promotion, personal selling",
                "Public relations, Publicity",
                "Introduction to e-business",
                "Different trends"
            ],
            "Week 15: E-business and Digital Marketing": [
                "Rules of doing e-business",
                "E-business application in the market",
                "Digital Marketing",
                "Using analytics to interpret and optimize results to maximize performance"
            ]
        }
    }
])

print(f"Seeded {col.count_documents({})} subjects.")
client.close()