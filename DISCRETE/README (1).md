# Dijkstra's Algorithm — Interactive Shortest Path Visualizer

## Objective
Implement Dijkstra's shortest-path algorithm, run it on several example graphs, plot the graphs, and save the program output (Group Activity).

## Features
- Animated 3D landing page (Three.js) and custom glowing cursor (desktop only)
- Editable weighted graph: add/delete nodes and edges, drag nodes, change weights, random graph, 3 examples
- Real Dijkstra (min-heap) animated step by step: PLAY, PAUSE, STEP, RESET, speed slider, live explanation
- Results panel, execution log, live statistics, friendly error handling (negative/invalid weights, duplicate edges, no path, empty graph...)
- PRINT RESULT, DOWNLOAD RESULT (.txt), DOWNLOAD GRAPH (.png), COPY OUTPUT

## Technologies Used
HTML5, CSS3, vanilla JavaScript, SVG, Three.js (CDN, used only for the hero background).

## How Dijkstra's Algorithm Works
1. Set distance[source] = 0 and all other distances to infinity.
2. Pick the unvisited node with the smallest tentative distance and mark it visited.
3. For each neighbor, if distance[u] + weight < distance[neighbor], update the distance and predecessor.
4. Repeat until the destination is visited or no reachable nodes remain.
5. Follow predecessors back from the destination to get the path.
It requires non-negative edge weights.

## How to Run
Open `index.html` in a browser. No install or server needed. An internet connection is needed only for the Three.js hero background (the visualizer works without it).

## How to Use the Visualizer
Pick a tool (MOVE, ADD NODE, ADD EDGE, DELETE). In MOVE mode drag nodes, click a node to set the source, Shift-click for the destination (or use the dropdowns), click an edge to set its weight to the Weight box value. Press RUN DIJKSTRA, or use STEP.

## Example Outputs
(Undirected graphs; results computed by the program.)
- Example 1 (A→E): distance 10, path A → C → B → D → E
- Example 2 (A→G): distance 22, path A → D → F → G
- Example 3 (A→J): distance 14, path A → C → D → E → H → J

## Complexity
Time O(V²) with an array, O((V + E) log V) with a min-heap (used here). Space O(V + E).

## Assignment Requirements Fulfilled
1. Dijkstra code: `dijkstra()` in `script.js`.
2. Multiple examples: three built-in graphs plus random and custom graphs.
3. Print/plot: graph drawn in SVG; PRINT RESULT and PNG download.
4. Save output: EXECUTION OUTPUT log, DOWNLOAD RESULT, COPY OUTPUT.
5. Submit code and output: submit these files plus the saved output.
