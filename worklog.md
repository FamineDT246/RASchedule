---
Task ID: reapply-1-to-6
Agent: main
Task: Reapply features 1-6 that were lost in the revert to commit e8be860, without breaking the desktop (no session.ts/crypto, no useSyncExternalStore). Also fix admin mobile tabs being jumbled.

Work Log:
- Read current state of InstructorView, page.tsx, CalendarView, DroppableEventCard, scheduler-types, schedule API
- Confirmed email verification (#1) was already in place on backend (claim route) and frontend (ClaimInviteForm 2-step flow)
- Updated scheduler-types.ts eventOnDate() to only exclude Draft (was excluding both Draft and Archived) — Archived events now show on calendar
- Updated /api/schedule route to return Archived events (removed AND status != 'Archived' filter)
- Updated CalendarView.tsx: removed !readOnly check on onClick (chips now clickable in instructor view too); added dimming for Archived events
- Updated DroppableEventCard.tsx: introduced isReadOnly = isPast || isCancelled || isArchived; dim Archived events at 60% opacity; disabled drop for Archived
- Rewrote InstructorView main return JSX: replaced icon toggle (carousel/list/calendar) with proper 3-tab nav (My Assignments | Opt In | Calendar) with icons + count badges + 44px touch targets
- Added Esc key handler to InstructorView (closes event drawer)
- Replaced old Carousel component with CarouselGroup component (5 items per group, each group is a horizontal scroll row) — actually USED in the Opt In tab
- Removed unused imports (useRef, useCallback, ChevronLeft, ChevronRight, LayoutGrid, List, Trash2)
- Added Esc key handler to page.tsx (closes event drawer -> change password modal -> tap selection, in priority order)
- Fixed admin mobile tabs jumbled: added shrink-0 to TabButton, increased min-h from 40px to 44px (WCAG), added WebkitOverflowScrolling: touch + scrollbarWidth: none, bumped text size on mobile
- Fixed pre-existing CSS bug in globals.css: double-escaped backslashes (\\\\[9px\\\\] should be \\[9px\\]) was causing CSS parse error and 500 on / route
- Verified dev server returns 200, production build clean, no runtime errors
- Verified no useSyncExternalStore or session.ts/crypto was reintroduced

Stage Summary:
- Features 1-6 all reapplied without breaking the desktop
- Admin mobile tabs no longer jumbled (shrink-0 prevents compression)
- CarouselGroup is genuinely used in the Opt In tab (not dead code)
- Build: PASS, Lint: 1 pre-existing warning (setMounted in useEffect — deliberate, replaces crashing useSyncExternalStore)
- Dev server: HTTP 200, no console errors
- Commit: 51517c7
