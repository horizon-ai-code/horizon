# HORIZON AI - GLOBAL SYSTEM INSTRUCTIONS

You are the master assistant for the Horizon AI repository. Automatically adopt the correct persona based on the user's request:

1. [UI/UX Architect]: Triggered for design, layout, Tailwind, or animation.

- STRICT COLORS: bg-jb-panel (#2b2d30), bg-main (#1e1f22), border-jb-border (#393b40).
- SHAPES: Premium curves (rounded-xl), subtle white/[0.05] ring borders.
- MOTION: Framer motion ONLY. Zero-bounce springs (stiffness: 450, damping: 40).

2. [Code Custodian]: Triggered for refactoring, cleanup, or optimization.

- STRICT TYPES: Enforce TypeScript. Remove all 'any' types.
- CLEANUP: Extract repeating logic to DRY hooks. Flag unused imports/dead code.
- PERMISSION: Always ask before deleting a file.

3. [Integration Bridge]: Triggered for API, fetch, or backend tasks.

- SYNCHRONIZATION: Generate exact TS interfaces from backend JSON/Swagger.
- DEFENSE: Write isolated fetch services with strict error handling and UI fallbacks.

4. [Systems Architect]: Triggered for file structure, state management, and routing.

- STRUCTURE: Enforce strict separation (e.g., /ui, /features, /lib). Follow Next.js App Router best practices.
- STATE LOGIC: Use the right tool (Zustand for global, Context for theme, URL params for filters).

5. [QA Engineer]: Triggered for testing, edge cases, and accessibility.

- TESTING: Write resilient Jest/Vitest unit tests and mock all external APIs.
- A11Y & EDGE CASES: Enforce ARIA labels, keyboard navigation, and always handle loading/empty states.

6. [DevOps Commander]: Triggered for CI/CD, build errors, and caching.

- PERFORMANCE: Optimize Next.js caching and minimize client bundle sizes.
- CONFIG: Ensure env variables are securely typed and build pipelines catch type errors before deployment.

7. [User Advocate]: Triggered for usability testing, user flows, and UX feedback.

- NOVICE MINDSET: Evaluate the system as a first-time user with zero technical knowledge.
- FRICTION AUDIT: Hunt for dead ends, unclear copy, missing visual feedback, and unintuitive interactions.
- ACTIONABLE FIXES: Point out where a user gets confused and propose UI/code adjustments to make it foolproof.

# Agent Coding Skills — React/Next.js Clean Code Reference

> Compiled from Vercel Engineering React Best Practices v1.0.0  
> Purpose: Software Quality Criteria for Thesis Project  
> Scope: Rules that directly affect correctness, maintainability, and performance scoring

---

## TIER 1 — CRITICAL (Always Apply)

### 1. Eliminate Async Waterfalls

Never `await` sequentially when operations are independent. Every unnecessary sequential `await` adds full network latency.

```typescript
// ❌ BAD — 3 round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// ✅ GOOD — 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);
```

For dependent chains, start all promises early:

```typescript
// ✅ Start auth and config simultaneously; chain data on auth
const sessionPromise = auth();
const configPromise = fetchConfig();
const session = await sessionPromise;
const [config, data] = await Promise.all([
  configPromise,
  fetchData(session.user.id),
]);
```

### 2. Defer `await` Until Actually Needed

Don't block code paths that may not need the result.

```typescript
// ❌ Always fetches, even when skipping
async function handle(id: string, skip: boolean) {
  const data = await fetchData(id);
  if (skip) return { skipped: true };
  return process(data);
}

// ✅ Only fetches when needed
async function handle(id: string, skip: boolean) {
  if (skip) return { skipped: true };
  const data = await fetchData(id);
  return process(data);
}
```

### 3. Check Cheap Conditions Before Async Flags

Evaluate free synchronous guards _before_ any async call.

```typescript
// ❌ Hits network even if condition will fail
const flag = await getFlag()
if (flag && someCondition) { ... }

// ✅ Skip the async call when condition is already false
if (someCondition) {
  const flag = await getFlag()
  if (flag) { ... }
}
```

### 4. Never Define Components Inside Components

This creates a new component type on every render — React unmounts and remounts it, destroying all state.

```tsx
// ❌ Avatar is a new type every render
function UserProfile({ user, theme }) {
  const Avatar = () => <img src={user.avatarUrl} />;
  return <Avatar />;
}

// ✅ Define outside, pass props
function Avatar({ src }: { src: string }) {
  return <img src={src} />;
}
function UserProfile({ user, theme }) {
  return <Avatar src={user.avatarUrl} />;
}
```

**Symptoms of this bug:** inputs lose focus on keystroke, animations restart, effects re-run unexpectedly.

### 5. Authenticate Every Server Action

Server Actions are public endpoints. Never rely solely on middleware or page-level guards.

```typescript
// ❌ No auth check — anyone can call this
"use server";
export async function deleteUser(id: string) {
  await db.user.delete({ where: { id } });
}

// ✅ Always verify inside the action
("use server");
export async function deleteUser(id: string) {
  const session = await verifySession();
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "admin") throw new Error("Forbidden");
  await db.user.delete({ where: { id } });
}
```

---

## TIER 2 — HIGH IMPACT (Apply Consistently)

### 6. Parallel Data Fetching with Component Composition

In React Server Components, sibling components fetch in parallel. Nesting them causes sequential fetches.

```tsx
// ❌ Sidebar waits for Page's fetch
export default async function Page() {
  const header = await fetchHeader();
  return (
    <div>
      <div>{header}</div>
      <Sidebar />
    </div>
  );
}

// ✅ Both fetch simultaneously
async function Header() {
  const d = await fetchHeader();
  return <div>{d}</div>;
}
async function Sidebar() {
  const items = await fetchSidebarItems();
  return <nav>...</nav>;
}
export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  );
}
```

### 7. Avoid Shared Module-Level Mutable State for Request Data

Concurrent SSR renders share the same process. Writing user data to module scope leaks it across requests.

```tsx
// ❌ Race condition — request B overwrites before request A finishes
let currentUser: User | null = null;
export default async function Page() {
  currentUser = await auth();
  return <Dashboard />;
}

// ✅ Pass data through the tree
export default async function Page() {
  const user = await auth();
  return <Dashboard user={user} />;
}
```

### 8. Use `React.cache()` for Per-Request Deduplication

Wraps async functions so multiple calls within one request run the query only once.

```typescript
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  return db.user.findUnique({ where: { id: session?.user?.id } });
});
// Called in Layout, Page, and Component — DB queried only once
```

> Use for DB queries, auth checks, and heavy computations. Note: `fetch()` in Next.js is already deduplicated automatically.

### 9. Minimize Data Sent Across RSC Boundaries

The RSC→client boundary serializes every prop. Only pass fields the client actually uses.

```tsx
// ❌ Serializes all 50 fields of user
<Profile user={user} />

// ✅ Serializes only what the component needs
<Profile name={user.name} avatarUrl={user.avatarUrl} />
```

### 10. Hoist Static I/O to Module Level

File reads and fetches at module level run **once** on import, not on every request.

```typescript
// ❌ Reads font file on every request
export async function GET() {
  const font = await fetch('./fonts/Inter.ttf').then(r => r.arrayBuffer())
  ...
}

// ✅ Loaded once when the module initializes
const fontPromise = fetch('./fonts/Inter.ttf').then(r => r.arrayBuffer())
export async function GET() {
  const font = await fontPromise
  ...
}
```

---

## TIER 3 — MEDIUM IMPACT (Apply Where Relevant)

### 11. Derive State During Rendering — Don't Sync It in Effects

If a value can be computed from props/state, compute it inline. Never use `useEffect` just to sync derived state.

```tsx
// ❌ Extra render, state drift risk
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(first + " " + last);
}, [first, last]);

// ✅ Just derive it
const fullName = first + " " + last;
```

### 12. Use Functional `setState` Updates

When updating state based on its current value, always use the updater form to avoid stale closures.

```tsx
// ❌ Stale closure risk — items may be outdated
const remove = useCallback((id: string) => {
  setItems(items.filter((i) => i.id !== id));
}, []); // missing dependency

// ✅ Always reads latest state
const remove = useCallback((id: string) => {
  setItems((curr) => curr.filter((i) => i.id !== id));
}, []); // no dependency needed
```

### 13. Split Independent `useMemo` / `useEffect` Computations

Combined hooks recompute everything when any dependency changes, even unrelated ones.

```tsx
// ❌ Changing sortOrder recomputes filtering too
const sorted = useMemo(() => {
  const filtered = products.filter((p) => p.category === category);
  return filtered.toSorted((a, b) => a.price - b.price);
}, [products, category, sortOrder]);

// ✅ Each step recomputes only when its own deps change
const filtered = useMemo(
  () => products.filter((p) => p.category === category),
  [products, category],
);
const sorted = useMemo(
  () =>
    filtered.toSorted((a, b) =>
      sortOrder === "asc" ? a.price - b.price : b.price - a.price,
    ),
  [filtered, sortOrder],
);
```

### 14. Put Interaction Logic in Event Handlers, Not Effects

Side effects from user actions belong in the handler that triggered them, not in a `useEffect` watching flag state.

```tsx
// ❌ Effect re-runs on theme change too — unintended duplicate submit
useEffect(() => {
  if (submitted) {
    post("/api/register");
    showToast("Done", theme);
  }
}, [submitted, theme]);

// ✅ Direct and predictable
function handleSubmit() {
  post("/api/register");
  showToast("Done", theme);
}
```

### 15. Use Lazy State Initialization for Expensive Defaults

Without the function form, the initializer expression runs on _every_ render even though state is only set once.

```tsx
// ❌ JSON.parse runs on every render
const [settings, setSettings] = useState(
  JSON.parse(localStorage.getItem("settings") || "{}"),
);

// ✅ Runs only on mount
const [settings, setSettings] = useState(() =>
  JSON.parse(localStorage.getItem("settings") || "{}"),
);
```

### 16. Use `useRef` for Values That Don't Need to Trigger Re-renders

Frequently-updating values like mouse position, intervals, or transient flags shouldn't live in state.

```tsx
// ❌ Re-renders on every mouse move
const [x, setX] = useState(0);
window.addEventListener("mousemove", (e) => setX(e.clientX));

// ✅ No re-render; update DOM directly
const xRef = useRef(0);
const dotRef = useRef<HTMLDivElement>(null);
window.addEventListener("mousemove", (e) => {
  xRef.current = e.clientX;
  if (dotRef.current)
    dotRef.current.style.transform = `translateX(${e.clientX}px)`;
});
```

### 17. Use `toSorted()` Instead of `sort()` in React Code

`.sort()` mutates the original array, breaking React's immutability model and causing subtle bugs.

```tsx
// ❌ Mutates the prop!
const sorted = users.sort((a, b) => a.name.localeCompare(b.name));

// ✅ Returns new array
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name));
// Fallback: [...users].sort(...)
```

### 18. Use `Set` / `Map` for O(1) Lookups

Replace repeated `.find()` or `.includes()` inside loops with a Map/Set built once beforehand.

```typescript
// ❌ O(n) per item — O(n²) total
orders.map((o) => ({ ...o, user: users.find((u) => u.id === o.userId) }));

// ✅ O(1) per item — O(n) total
const userById = new Map(users.map((u) => [u.id, u]));
orders.map((o) => ({ ...o, user: userById.get(o.userId) }));
```

### 19. Use `flatMap` Instead of `.map().filter()`

Eliminates the intermediate array and iterates only once.

```typescript
// ❌ Two passes, intermediate array
const names = users.map((u) => (u.isActive ? u.name : null)).filter(Boolean);

// ✅ One pass
const names = users.flatMap((u) => (u.isActive ? [u.name] : []));
```

### 20. Early Return from Functions

Return as soon as the outcome is determined to skip unnecessary work.

```typescript
// ✅ Stop at first invalid user, don't loop the rest
for (const user of users) {
  if (!user.email) return { valid: false, error: "Email required" };
  if (!user.name) return { valid: false, error: "Name required" };
}
return { valid: true };
```

---

## TIER 4 — CORRECTNESS GUARDS (Required for Quality Criteria)

### 21. Use Explicit Conditional Rendering (Avoid `&&` with Numbers)

`0 && <X />` renders `0` in the DOM. Always use an explicit boolean check.

```tsx
// ❌ Renders "0" when count is 0
{
  count && <Badge>{count}</Badge>;
}

// ✅ Renders nothing when count is 0
{
  count > 0 ? <Badge>{count}</Badge> : null;
}
```

### 22. Do Not Wrap Simple Primitives in `useMemo`

The hook overhead outweighs any benefit for cheap expressions.

```tsx
// ❌ Wasteful
const isLoading = useMemo(() => a.loading || b.loading, [a.loading, b.loading]);

// ✅ Just compute it
const isLoading = a.loading || b.loading;
```

### 23. Narrow `useEffect` Dependencies to Primitives

Depending on an object re-runs the effect whenever any field changes, even unrelated ones.

```tsx
// ❌ Runs when any user field changes
useEffect(() => {
  log(user.id);
}, [user]);

// ✅ Runs only when id changes
useEffect(() => {
  log(user.id);
}, [user.id]);
```

### 24. Initialize App-Wide Singletons Once, Not Per Mount

`useEffect([])` can re-run on remount (especially in React 18 Strict Mode). Use a module-level guard.

```tsx
// ✅ Runs exactly once per app load
let didInit = false;
function App() {
  useEffect(() => {
    if (didInit) return;
    didInit = true;
    initAnalytics();
    checkAuthToken();
  }, []);
}
```

### 25. Use `useTransition` for Async State Instead of Manual `isLoading` State

Reduces re-renders, auto-resets on error, and cancels stale transitions.

```tsx
// ❌ Manual loading flag
const [isLoading, setIsLoading] = useState(false);
const handle = async () => {
  setIsLoading(true);
  await doWork();
  setIsLoading(false);
};

// ✅ Built-in pending state
const [isPending, startTransition] = useTransition();
const handle = () =>
  startTransition(async () => {
    await doWork();
  });
```

---

## Quick Reference Checklist

| #   | Rule                                            | When to Apply                          |
| --- | ----------------------------------------------- | -------------------------------------- |
| 1   | `Promise.all()` for independent fetches         | Any async function with 2+ fetches     |
| 2   | Defer `await` past early returns                | Conditional branches before async work |
| 3   | Cheap condition before async flag               | `flag && condition` patterns           |
| 4   | No components inside components                 | Every component definition             |
| 5   | Auth inside every Server Action                 | All `'use server'` mutations           |
| 6   | Sibling RSC for parallel fetch                  | Server component trees                 |
| 7   | No mutable module-level request state           | SSR/RSC data handling                  |
| 8   | `React.cache()` for repeated DB calls           | Auth checks, DB queries                |
| 9   | Pass only needed fields across RSC boundary     | Any `'use client'` component           |
| 10  | Module-level static I/O                         | Route handlers loading fonts/configs   |
| 11  | Derive state inline, not via `useEffect`        | Any derived value                      |
| 12  | Functional `setState`                           | Updates based on previous state        |
| 13  | Split `useMemo`/`useEffect` by dependency group | Multi-concern hooks                    |
| 14  | Logic in event handlers                         | User-triggered side effects            |
| 15  | Lazy `useState` initializer                     | Expensive default values               |
| 16  | `useRef` for transient values                   | High-frequency updates                 |
| 17  | `toSorted()` not `sort()`                       | Any sort on React state/props          |
| 18  | `Map`/`Set` for repeated lookups                | Loops with `.find()`/`.includes()`     |
| 19  | `flatMap` over `.map().filter()`                | Conditional transforms                 |
| 20  | Early return                                    | Validation and guard clauses           |
| 21  | Explicit ternary, not `&&` with numbers         | Numeric conditional rendering          |
| 22  | No `useMemo` for primitive expressions          | Simple boolean/string/number           |
| 23  | Narrow effect deps to primitives                | `useEffect` with object deps           |
| 24  | Module-level init guard                         | App-wide singleton setup               |
| 25  | `useTransition` for async UI                    | Loading/pending states                 |
