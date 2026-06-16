# Project: Polla Lottery Tracking Application

Create a complete frontend + Supabase web application called **Polla**, designed to manage and display recurring lottery pool contests.

The application must be production-ready, mobile-first, scalable, and deployable entirely using free-tier services.

---

# Overview

The game works as follows:

* Any number of players can participate.
* Each player selects exactly **10 numbers** between **00 and 99**.
* Repeated numbers are allowed.
* A game usually starts on Monday and ends on Friday, although dates may vary because of holidays or scheduling changes.
* Every day, the lottery publishes **20 drawn numbers**.
* When a drawn number matches one of a player's selected numbers, exactly **one occurrence** of that number is marked as matched.
* If a player selected the same number multiple times, that number must be drawn multiple times across the game to fully match all occurrences.
* A player wins when all 10 selected numbers have been matched.
* Multiple winners are allowed.
* If there are no winners, the unawarded prize pool rolls over into the next game.

---

# Core Business Rules

## Number Matching Rules

Example:

Player numbers:

* 07
* 07
* 15

If the draw contains:

* 07

Only one instance of 07 is matched.

If another 07 is drawn later, the second instance becomes matched.

Cross-player rule:

* If the draw contains **41**, every player who has an unmatched **41** slot gets exactly one **41** crossed out on that draw occurrence.
* If five players each have one **41**, one draw of **41** crosses out **41** for all five players independently.
* If one player has **41** twice, a single draw of **41** only crosses out one of their two slots; a second draw occurrence of **41** is required to cross out the second slot.
* If **41** appears twice in the same daily draw (two of the 20 numbers), a player with two **41** slots can cross out both in that same sorteo.

Matching must persist permanently once recorded.

---

# Administration

There will be a single administrator account.

Only the administrator can:

* Create games
* Open or close games
* Register players
* Create player entries
* Enter selected numbers
* Configure entry fee
* Configure prize percentage
* Enter daily lottery results
* Edit or invalidate incorrect draws

Public users cannot modify data.

---

# Public View

Everyone should be able to view:

* Current game standings
* Players participating in the current game
* Selected numbers
* Matched numbers
* Remaining unmatched numbers
* Ranking of players closest to winning
* Current accumulated prize pool
* Historical games
* Previous winners
* Historical statistics

Public users must have read-only access.

---

# Game Lifecycle

A game must support the following states:

* Draft
* Active
* Closed
* Archived

Rules:

* Only one game can be active at a time.
* Lottery draws can only be entered for active games.
* Closed games become immutable except for administrator correction workflows.
* Archived games are historical records.

---

# Weekly Game Management

Each game must store:

* Game ID
* Name or label
* Start date
* End date
* Entry fee
* Prize percentage
* Total collected amount
* Rolled-over amount
* Calculated prize pool
* Final awarded amount
* Status
* Created timestamp
* Closed timestamp

---

# Player Management

Store:

* Player name
* Optional nickname
* Created timestamp

Players exist independently from games and may participate in multiple games over time.

---

# Player Entries

A player entry represents a player's participation in a specific game.

Each entry must store:

* Player reference
* Game reference
* Exactly 10 selected numbers
* Matched count
* Remaining count
* Completion percentage
* Winner status
* Winning timestamp

Validation rules:

* Exactly 10 numbers are required.
* Numbers must be between 00 and 99.
* Duplicate numbers are allowed.

---

# Daily Lottery Draws

Each draw must store:

* Game reference
* Draw date
* Exactly 20 drawn numbers
* Created timestamp
* Entered by administrator

Validation rules:

* Exactly 20 numbers are required.
* Numbers must be between 00 and 99.
* Duplicate drawn numbers are allowed only if the real lottery permits them.

---

# Automatic Match Processing

Whenever a lottery draw is entered, the system must automatically:

* Compare drawn numbers against player entries
* Persist matches in the database
* Update matched counts
* Update completion percentages
* Recalculate rankings
* Detect winners
* Record winning timestamps

Matches must never be recalculated from scratch during normal reads.

All matches must be persisted for historical accuracy and auditing.

---

# Ranking System

Display a live leaderboard sorted by:

1. Highest matched count
2. Lowest remaining count
3. Earliest winning timestamp
4. Player name alphabetically

Display:

* Rank
* Player name
* Matched count
* Remaining count
* Completion percentage
* Winner badge/status

---

# Winners and Prize Distribution

When one or more players reach 10/10 matched numbers:

* Mark entries as winners
* Record winning timestamps
* Freeze the game results
* Calculate prize distribution

Prize distribution rules:

* Winners share the final prize pool equally
* Prize values must be rounded consistently
* Remaining cents from rounding must follow a deterministic rule

If no players win:

* The unawarded prize pool rolls over into the next game

---

# Dashboard

Create an administrator dashboard showing:

## Summary Cards

* Current game
* Total active players
* Current prize pool
* Winners count
* Total collected amount

## Charts

* Daily match progression
* Player progress distribution
* Participation trends
* Historical prize growth

## Leaderboard

* Live ranking table

---

# Historical Archive

Provide a historical archive containing:

* Past games
* Winners
* Prize amounts
* Participation counts
* Historical rankings
* Draw history
* Statistics

Support pagination and filtering.

---

# Statistics

Generate statistics such as:

* Total games played
* Total prizes awarded
* Most successful players
* Highest prize pool
* Average winners per game
* Most commonly selected numbers
* Average completion rate

---

# Technical Requirements

## Frontend

Use:

* React
* TypeScript
* Tailwind CSS

Preferred additions:

* Vite
* React Router
* TanStack Query
* Zustand
* React Hook Form
* Zod

---

# UI Libraries

Use [shadcn/ui](https://ui.shadcn.com/) components (installed via CLI into `src/components/ui/`). Theme: light/dark/system via `next-themes` with zinc/neutral CSS variables.

---

# UI / UX Requirements

Requirements:

* Mobile-first design
* Responsive layouts
* Light/dark/system theme (default: system)
* Accessible UI
* Elegant modern dashboard styling
* Smooth animations
* Loading skeletons
* Empty states
* Error states
* Optimized table rendering
* Excellent usability on desktop and mobile

---

# Database

Use Supabase PostgreSQL.

Requirements:

* Proper relational schema
* Foreign keys
* Composite indexes
* Constraints
* Transactions
* Row-level security policies
* Soft deletion support where appropriate

---

# Authentication

Authentication is required only for administrator access.

Requirements:

* Single administrator account
* Secure session handling
* Protected admin routes
* Public read-only access without authentication

---

# Suggested Database Tables

Create relational tables such as:

* users
* players
* games
* player_entries
* entry_numbers
* lottery_draws
* draw_numbers
* matches
* winners
* prize_rollovers
* audit_logs

---

# Database Constraints

Important constraints:

* Only one active game at a time
* Exactly 10 entry numbers per player entry
* Exactly 20 draw numbers per draw
* Number values restricted to 00–99
* Prevent duplicate match records
* Prevent duplicate winner records

Add indexes for:

* Game lookups
* Rankings
* Match queries
* Historical filtering

---

# Audit Logging

Implement a complete audit logging system.

Record:

* Administrator
* Action type
* Entity type
* Entity ID
* Previous value
* New value
* Timestamp

Examples:

* Player created
* Entry updated
* Numbers edited
* Draw entered
* Game closed
* Prize configuration changed

Audit logs must be immutable.

---

# Performance Requirements

Requirements:

* Optimized database queries
* Pagination for historical data
* Avoid unnecessary frontend re-renders
* Efficient leaderboard updates
* Lighthouse score above 90
* Fast mobile performance
* Lazy loading where appropriate

---

# Hosting

Deploy using free-tier services:

* GitHub Pages or Vercel for frontend hosting
* Supabase for backend and database

Provide complete deployment instructions.

---

# Architecture Requirements

## Data Integrity

Use transactional database operations for:

* Entering lottery draws
* Match generation
* Winner calculation
* Prize distribution

This prevents partial updates and inconsistent state.

---

## Match Persistence

Do not recalculate matches dynamically during reads.

Persist all matches in the database when draws are entered.

Benefits:

* Better performance
* Historical accuracy
* Easier auditing
* Simpler reporting
* Deterministic rankings

---

# Security Requirements

* Use Supabase Row Level Security
* Restrict write access to administrator only
* Validate all inputs on both frontend and backend
* Never trust client-side validation alone
* Protect admin routes
* Sanitize all user-provided values

---

# Code Quality Requirements

The codebase must be:

* Production-ready
* Scalable
* Maintainable
* Fully typed
* Well documented
* Modular
* Easy for another developer to understand
* Based on SOLID principles
* Based on clean code practices
* Avoid overengineering

Comments should only exist where they provide meaningful value.

---

# Deliverables

Provide:

1. Complete project structure
2. Database schema
3. SQL migrations
4. API architecture
5. Component architecture
6. Authentication setup
7. Deployment instructions
8. Environment variable configuration
9. Full implementation code
10. README documentation

---

# Recommended Stack

Use:

* React
* TypeScript
* Vite
* Tailwind CSS
* Supabase
* PostgreSQL
* Zod
* TanStack Query
* Recharts

---

# Final Objective

Build a production-ready lottery management platform that is:

* Fast
* Secure
* Scalable
* Mobile-first
* Easy to maintain
* Easy for future developers to understand
* Visually polished
* Fully deployable using free-tier services
