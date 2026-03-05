# **App Name**: FamilyTree

## Core Features:

- User Authentication & Dashboard: Secure login and registration, and a dashboard to manage personal family tree projects (create, open, delete trees).
- Interactive Tree Canvas: A dynamic canvas for visually arranging, panning, and zooming through family members and their connections using React Flow.
- Person Profile Management: Create new people and edit their comprehensive profiles (names, dates, photos, descriptions, social links) via a side panel.
- Relationship Editor: Establish and type various relationships (e.g., parent, spouse, adoptive parent) between individuals using an intuitive modal interface.
- Persistent Canvas Layout: Automatically save and restore the custom spatial arrangement and positions of individuals on the interactive canvas.
- Duplicate Person Guard: A warning tool to alert users about potential duplicate entries when creating new people based on similar existing details.
- AI Description Assistant: A generative AI tool within the person profile editor to suggest or enrich biographical descriptions based on available profile data.

## Style Guidelines:

- Color scheme: Light. This choice aligns with the structured, clean aesthetic desired for genealogical records and interactive diagrams, promoting clarity and focus. The palette aims for a sophisticated blend of depth and approachability.
- Primary color: Muted Indigo (#4C3399). This deep, slightly purple-tinged blue signifies stability, trust, and a sense of legacy, providing a refined accent against lighter backgrounds. HSL(250, 50%, 40%).
- Background color: Very light Grey-Blue (#ECEEF3). This highly desaturated color ensures a clean, unobtrusive canvas, allowing the family tree data and UI elements to stand out without visual clutter. HSL(250, 15%, 95%).
- Accent color: Vibrant Azure (#2A7EE3). This brighter, clearer blue provides an energetic contrast to the primary indigo, ideal for interactive elements like buttons, links, and highlights, drawing user attention to key actions. HSL(220, 70%, 55%).
- Body and headline font: 'Inter' (sans-serif). Chosen for its modern, objective aesthetic and high legibility, it supports a wide range of content from detailed profile information to concise tree labels effectively.
- Use a consistent set of clean, minimalist line icons for actions (e.g., 'add person', 'edit relationship') and simple, clear symbols for displaying person details (gender, status), ensuring visual coherence and quick comprehension within the interactive canvas.
- Desktop-first, adaptive layout with a strong focus on the infinite interactive canvas as the primary workspace. A responsive side-panel provides detailed context editing, while a clean dashboard manages overall tree projects.
- Subtle and fluid animations for node movements, panel transitions, and user feedback (e.g., when saving data or receiving warnings), enhancing interactivity and perceived performance without creating distractions.