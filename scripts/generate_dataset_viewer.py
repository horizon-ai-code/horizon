import json
import os
import html

# Paths
DATASET_PATH = "/home/pugario/Projects/horizon/backend/benchmark/data/dataset_final.json"
OUTPUT_HTML_PATH = "/home/pugario/Projects/horizon/docs/dataset_viewer.html"

def generate_viewer():
    # Load dataset
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset not found at {DATASET_PATH}")
        return
        
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Loaded {len(data)} entries.")
    
    # Calculate stats for the dashboard
    total_tasks = len(data)
    
    difficulty_counts = {"Easy": 0, "Medium": 0, "Hard": 0}
    intent_counts = {}
    
    for entry in data:
        diff = entry.get("difficulty", "Medium")
        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1
        
        intent = entry.get("intent", "UNKNOWN")
        intent_counts[intent] = intent_counts.get(intent, 0) + 1
        
    # Use all entries in the dataset
    selected_entries = sorted(data, key=lambda x: x.get("idx", 0))
    print(f"Selected all {len(selected_entries)} entries for the viewer.")
    
    # Prepare JSON data to embed in HTML
    embedded_data = []
    for entry in selected_entries:
        embedded_data.append({
            "idx": entry.get("idx"),
            "num": entry.get("num"),
            "difficulty": entry.get("difficulty"),
            "intent": entry.get("intent"),
            "instruction": entry.get("instruction"),
            "source_code": entry.get("source_code"),
            "public_tests_input": entry.get("public_tests_input", "").strip(),
            "public_tests_output": entry.get("public_tests_output", "").strip(),
            "private_test_count": len(entry.get("private_tests_input", []))
        })
        
    embedded_data_json = json.dumps(embedded_data)
    
    # HTML Content
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Horizon AI Refactoring Dataset Explorer</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <!-- PrismJS for syntax highlighting -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
    
    <style>
        :root {{
            --bg-dark: #0b0f19;
            --bg-card: #151d30;
            --bg-card-hover: #1e2942;
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --primary: #6366f1;
            --primary-glow: rgba(99, 102, 241, 0.15);
            --accent-teal: #14b8a6;
            --accent-orange: #f97316;
            
            --easy: #10b981;
            --medium: #f59e0b;
            --hard: #ef4444;
            
            --border: rgba(255, 255, 255, 0.08);
            --border-highlight: rgba(99, 102, 241, 0.3);
        }}
        
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        
        body {{
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-dark);
            color: var(--text-main);
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }}
        
        /* Header */
        header {{
            background: linear-gradient(90deg, #111827 0%, #1f2937 100%);
            border-bottom: 1px solid var(--border);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }}
        
        .header-title h1 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #a78bfa 0%, #6366f1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        
        .header-title p {{
            font-size: 0.8rem;
            color: var(--text-muted);
            margin-top: 0.1rem;
        }}
        
        .header-stats {{
            display: flex;
            gap: 1.5rem;
        }}
        
        .stat-badge {{
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--border);
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.85rem;
        }}
        
        .stat-badge span.num {{
            font-weight: 700;
            color: var(--primary);
        }}
        
        /* App Layout */
        .app-container {{
            display: flex;
            flex: 1;
            overflow: hidden;
        }}
        
        /* Sidebar: Filters & Dashboard */
        .sidebar {{
            width: 320px;
            background-color: rgba(17, 24, 39, 0.7);
            border-right: 1px solid var(--border);
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            overflow-y: auto;
            flex-shrink: 0;
        }}
        
        .section-title {{
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            margin-bottom: 0.75rem;
            font-weight: 600;
        }}
        
        .search-box {{
            position: relative;
        }}
        
        .search-box input {{
            width: 100%;
            background-color: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 0.6rem 1rem;
            color: var(--text-main);
            font-size: 0.85rem;
            outline: none;
            transition: all 0.2s;
        }}
        
        .search-box input:focus {{
            border-color: var(--primary);
            background-color: rgba(255, 255, 255, 0.08);
            box-shadow: 0 0 0 3px var(--primary-glow);
        }}
        
        /* Filters */
        .filter-group {{
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }}
        
        .filter-btn {{
            background: none;
            border: 1px solid transparent;
            padding: 0.5rem 0.8rem;
            border-radius: 6px;
            color: var(--text-muted);
            text-align: left;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .filter-btn:hover {{
            background-color: rgba(255, 255, 255, 0.03);
            color: var(--text-main);
        }}
        
        .filter-btn.active {{
            background-color: var(--primary-glow);
            border-color: var(--border-highlight);
            color: var(--text-main);
            font-weight: 500;
        }}
        
        .filter-btn .count {{
            background-color: rgba(255, 255, 255, 0.08);
            padding: 0.1rem 0.4rem;
            border-radius: 4px;
            font-size: 0.75rem;
            color: var(--text-muted);
        }}
        
        .filter-btn.active .count {{
            background-color: var(--primary);
            color: white;
        }}
        
        /* Task List (Middle Pane) */
        .task-list {{
            width: 380px;
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            background-color: rgba(17, 24, 39, 0.4);
            flex-shrink: 0;
            overflow: hidden;
        }}
        
        .list-header {{
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: rgba(17, 24, 39, 0.2);
        }}
        
        .list-header h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.1rem;
            font-weight: 600;
        }}
        
        .list-header .count-label {{
            font-size: 0.8rem;
            color: var(--text-muted);
        }}
        
        .task-cards {{
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }}
        
        .task-card {{
            background-color: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1rem;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }}
        
        .task-card:hover {{
            background-color: var(--bg-card-hover);
            border-color: rgba(255, 255, 255, 0.15);
            transform: translateY(-1px);
        }}
        
        .task-card.active {{
            background-color: var(--bg-card-hover);
            border-color: var(--primary);
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.15);
        }}
        
        .card-meta {{
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .card-id {{
            font-family: 'Fira Code', monospace;
            font-size: 0.8rem;
            color: var(--text-muted);
            font-weight: 500;
        }}
        
        .badge {{
            font-size: 0.7rem;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        
        .badge.easy {{ background-color: rgba(16, 185, 129, 0.15); color: var(--easy); border: 1px solid rgba(16, 185, 129, 0.3); }}
        .badge.medium {{ background-color: rgba(245, 158, 11, 0.15); color: var(--medium); border: 1px solid rgba(245, 158, 11, 0.3); }}
        .badge.hard {{ background-color: rgba(239, 68, 68, 0.15); color: var(--hard); border: 1px solid rgba(239, 68, 68, 0.3); }}
        
        .card-intent {{
            font-family: 'Outfit', sans-serif;
            font-size: 0.85rem;
            font-weight: 600;
            color: #e5e7eb;
        }}
        
        .card-instruction {{
            font-size: 0.8rem;
            color: var(--text-muted);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            line-height: 1.4;
        }}
        
        /* Task Detail (Right Pane) */
        .task-detail {{
            flex: 1;
            overflow-y: auto;
            background-color: #0d121f;
            display: flex;
            flex-direction: column;
        }}
        
        .detail-placeholder {{
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: var(--text-muted);
            gap: 1rem;
        }}
        
        .detail-placeholder h3 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.25rem;
            color: #d1d5db;
        }}
        
        .detail-placeholder p {{
            font-size: 0.9rem;
        }}
        
        .detail-content {{
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }}
        
        .detail-header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1.5rem;
        }}
        
        .detail-title-block h2 {{
            font-family: 'Outfit', sans-serif;
            font-size: 1.6rem;
            font-weight: 700;
            color: white;
            margin-bottom: 0.5rem;
        }}
        
        .detail-title-block .subtitle {{
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 0.85rem;
            color: var(--text-muted);
        }}
        
        .detail-title-block .subtitle span.dot {{
            width: 4px;
            height: 4px;
            background-color: var(--text-muted);
            border-radius: 50%;
        }}
        
        .instruction-box {{
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(20, 184, 166, 0.05) 100%);
            border: 1px solid var(--border-highlight);
            border-radius: 8px;
            padding: 1.2rem;
        }}
        
        .instruction-box h4 {{
            font-family: 'Outfit', sans-serif;
            font-size: 0.9rem;
            font-weight: 600;
            color: #c084fc;
            margin-bottom: 0.4rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        
        .instruction-box p {{
            font-size: 0.95rem;
            line-height: 1.5;
            color: #e5e7eb;
        }}
        
        /* Code Block container */
        .code-container {{
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }}
        
        .code-header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #1e293b;
            border: 1px solid var(--border);
            border-bottom: none;
            padding: 0.5rem 1rem;
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            font-size: 0.8rem;
            color: var(--text-muted);
        }}
        
        pre[class*="language-"] {{
            margin: 0;
            border-top-left-radius: 0;
            border-top-right-radius: 0;
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
            font-size: 0.85rem;
            max-height: 400px;
            overflow-y: auto;
        }}
        
        /* Test cases section */
        .tests-section {{
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }}
        
        .test-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }}
        
        .test-card-box {{
            background-color: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1rem;
        }}
        
        .test-card-box.private-box {{
            grid-column: span 2;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        .test-label-title {{
            font-size: 0.8rem;
            color: var(--text-muted);
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }}
        
        .test-val {{
            font-family: 'Fira Code', monospace;
            font-size: 0.85rem;
            color: #14b8a6;
            background-color: rgba(20, 184, 166, 0.05);
            padding: 0.5rem;
            border-radius: 4px;
            border: 1px solid rgba(20, 184, 166, 0.1);
            white-space: pre-wrap;
        }}
        
        .private-count {{
            font-size: 1.1rem;
            font-weight: 700;
            color: var(--primary);
        }}
        
    </style>
</head>
<body>

    <!-- Header -->
    <header>
        <div class="header-title">
            <h1>Horizon AI Refactoring Dataset</h1>
            <p>Empirical Evaluation Benchmark — 12 Refactoring Intents</p>
        </div>
        <div class="header-stats">
            <div class="stat-badge">
                Total Benchmark Cases: <span class="num">{total_tasks}</span>
            </div>
            <div class="stat-badge">
                Easy: <span class="num" style="color:var(--easy)">{difficulty_counts["Easy"]}</span>
            </div>
            <div class="stat-badge">
                Medium: <span class="num" style="color:var(--medium)">{difficulty_counts["Medium"]}</span>
            </div>
            <div class="stat-badge">
                Hard: <span class="num" style="color:var(--hard)">{difficulty_counts["Hard"]}</span>
            </div>
        </div>
    </header>

    <div class="app-container">
        <!-- Sidebar Filters -->
        <div class="sidebar">
            <div>
                <div class="section-title">Search</div>
                <div class="search-box">
                    <input type="text" id="search-input" placeholder="Search instructions or code..." oninput="filterTasks()">
                </div>
            </div>
            
            <div>
                <div class="section-title">Difficulty Filter</div>
                <div class="filter-group">
                    <button class="filter-btn active" id="diff-all" onclick="setDiffFilter('all')">
                        All Difficulties <span class="count">{total_tasks}</span>
                    </button>
                    <button class="filter-btn" id="diff-Easy" onclick="setDiffFilter('Easy')">
                        Easy <span class="count">{difficulty_counts["Easy"]}</span>
                    </button>
                    <button class="filter-btn" id="diff-Medium" onclick="setDiffFilter('Medium')">
                        Medium <span class="count">{difficulty_counts["Medium"]}</span>
                    </button>
                    <button class="filter-btn" id="diff-Hard" onclick="setDiffFilter('Hard')">
                        Hard <span class="count">{difficulty_counts["Hard"]}</span>
                    </button>
                </div>
            </div>
            
            <div>
                <div class="section-title">Refactoring Intent</div>
                <div class="filter-group" id="intent-filters">
                    <button class="filter-btn active" id="intent-all" onclick="setIntentFilter('all')">
                        All Intents <span class="count">{total_tasks}</span>
                    </button>
                    <!-- Will be populated by JS -->
                </div>
            </div>
        </div>

        <!-- Task List Pane -->
        <div class="task-list">
            <div class="list-header">
                <h2>Benchmark Cases</h2>
                <div class="count-label" id="list-count-label">Showing all</div>
            </div>
            <div class="task-cards" id="task-cards-container">
                <!-- Will be populated by JS -->
            </div>
        </div>

        <!-- Task Detail Pane -->
        <div class="task-detail" id="task-detail-pane">
            <div class="detail-placeholder" id="detail-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="9" y1="9" x2="15" y2="9"></line>
                    <line x1="9" y1="13" x2="15" y2="13"></line>
                    <line x1="9" y1="17" x2="13" y2="17"></line>
                </svg>
                <h3>No Case Selected</h3>
                <p>Select a benchmark case from the list to view its details.</p>
            </div>
            <div class="detail-content" id="detail-content" style="display: none;">
                <div class="detail-header">
                    <div class="detail-title-block">
                        <h2 id="detail-title">Task #1</h2>
                        <div class="subtitle">
                            <span class="badge" id="detail-difficulty-badge">Medium</span>
                            <span class="dot"></span>
                            <span id="detail-intent-label">EXTRACT_METHOD</span>
                        </div>
                    </div>
                </div>

                <div class="instruction-box">
                    <h4>Refactoring Request (Prompt)</h4>
                    <p id="detail-instruction">Decompose the compound condition in the method.</p>
                </div>

                <div class="code-container">
                    <div class="code-header">
                        <span>Original Java Code (Input to LLM Pipeline)</span>
                        <span>Java</span>
                    </div>
                    <pre class="language-java"><code class="language-java" id="detail-code">public class Solution {{ }}</code></pre>
                </div>

                <div class="tests-section">
                    <div class="section-title">Verification (Behavioral Equivalence Tests)</div>
                    <div class="test-grid">
                        <div class="test-card-box">
                            <div class="test-label-title">Public Test Input</div>
                            <div class="test-val" id="detail-test-input">input</div>
                        </div>
                        <div class="test-card-box">
                            <div class="test-label-title">Expected Output</div>
                            <div class="test-val" id="detail-test-output">output</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Data & Interactive Logic -->
    <script>
        // Raw dataset embedded
        const rawDataset = {embedded_data_json};
        
        // Stats computed in JS
        const intentCounts = {{}};
        rawDataset.forEach(d => {{
            intentCounts[d.intent] = (intentCounts[d.intent] || 0) + 1;
        }});
        
        // Active filters state
        let currentDiffFilter = 'all';
        let currentIntentFilter = 'all';
        let currentSearchQuery = '';
        let selectedIndex = null;

        // Initialize Intent Filters UI
        const intentFiltersContainer = document.getElementById('intent-filters');
        Object.entries(intentCounts).forEach(([intent, count]) => {{
            const btn = document.createElement('button');
            btn.className = 'filter-btn';
            btn.id = `intent-${{intent}}`;
            btn.onclick = () => setIntentFilter(intent);
            btn.innerHTML = `${{intent.replace(/_/g, ' ')}} <span class="count">${{count}}</span>`;
            intentFiltersContainer.appendChild(btn);
        }});

        // Set difficulty filter
        function setDiffFilter(diff) {{
            document.querySelectorAll('[id^="diff-"]').forEach(el => el.classList.remove('active'));
            document.getElementById(`diff-${{diff}}`).classList.add('active');
            currentDiffFilter = diff;
            filterTasks();
        }}

        // Set intent filter
        function setIntentFilter(intent) {{
            document.querySelectorAll('[id^="intent-"]').forEach(el => el.classList.remove('active'));
            document.getElementById(`intent-${{intent}}`).classList.add('active');
            currentIntentFilter = intent;
            filterTasks();
        }}

        // Filter tasks and render
        function filterTasks() {{
            currentSearchQuery = document.getElementById('search-input').value.toLowerCase();
            
            const filtered = rawDataset.filter(item => {{
                const matchesDiff = currentDiffFilter === 'all' || item.difficulty === currentDiffFilter;
                const matchesIntent = currentIntentFilter === 'all' || item.intent === currentIntentFilter;
                const matchesSearch = item.instruction.toLowerCase().includes(currentSearchQuery) || 
                                      item.source_code.toLowerCase().includes(currentSearchQuery) ||
                                      String(item.num).includes(currentSearchQuery);
                return matchesDiff && matchesIntent && matchesSearch;
            }});

            // Update list header count
            document.getElementById('list-count-label').innerText = `Showing ${{filtered.length}} of ${{rawDataset.length}}`;

            // Render cards
            const cardsContainer = document.getElementById('task-cards-container');
            cardsContainer.innerHTML = '';
            
            if (filtered.length === 0) {{
                cardsContainer.innerHTML = '<div style="color:var(--text-muted); text-align:center; margin-top:2rem; font-size:0.9rem;">No tasks match filters</div>';
                return;
            }}

            filtered.forEach((item, idx) => {{
                const card = document.createElement('div');
                card.className = `task-card ${{selectedIndex === item.num ? 'active' : ''}}`;
                card.onclick = () => selectTask(item.num);
                
                card.innerHTML = `
                    <div class="card-meta">
                        <span class="card-id">Case #${{item.num}}</span>
                        <span class="badge ${{item.difficulty.toLowerCase()}}">${{item.difficulty}}</span>
                    </div>
                    <div class="card-intent">${{item.intent.replace(/_/g, ' ')}}</div>
                    <div class="card-instruction">${{escapeHTML(item.instruction)}}</div>
                `;
                cardsContainer.appendChild(card);
            }});
        }}

        // Helper to escape HTML characters
        function escapeHTML(str) {{
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }}

        // Select task
        function selectTask(num) {{
            selectedIndex = num;
            
            // Highlight active card
            document.querySelectorAll('.task-card').forEach(el => el.classList.remove('active'));
            filterTasks(); // Re-render to keep active state highlighted

            const item = rawDataset.find(d => d.num === num);
            if (!item) return;

            // Show detail panel, hide placeholder
            document.getElementById('detail-placeholder').style.display = 'none';
            document.getElementById('detail-content').style.display = 'flex';

            // Populate text
            document.getElementById('detail-title').innerText = `Benchmark Case #${{item.num}}`;
            document.getElementById('detail-intent-label').innerText = item.intent.replace(/_/g, ' ');
            document.getElementById('detail-instruction').innerText = item.instruction;
            
            const diffBadge = document.getElementById('detail-difficulty-badge');
            diffBadge.className = `badge ${{item.difficulty.toLowerCase()}}`;
            diffBadge.innerText = item.difficulty;

            // Format code
            const codeEl = document.getElementById('detail-code');
            codeEl.textContent = item.source_code;
            Prism.highlightElement(codeEl);

            // Inputs/Outputs
            document.getElementById('detail-test-input').innerText = item.public_tests_input || 'N/A';
            document.getElementById('detail-test-output').innerText = item.public_tests_output || 'N/A';

            // Scroll detail pane to top
            document.getElementById('task-detail-pane').scrollTop = 0;
        }}

        // Initialize list
        filterTasks();
    </script>
</body>
</html>
"""
    
    with open(OUTPUT_HTML_PATH, "w", encoding="utf-8") as out:
        out.write(html_content)
        
    print(f"Generated visual dataset explorer at {OUTPUT_HTML_PATH}")

if __name__ == "__main__":
    generate_viewer()
