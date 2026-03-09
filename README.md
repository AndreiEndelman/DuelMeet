# DuelMeet

DuelMeet is a location-aware meetup platform for trading card game (TCG) players.
It helps players find, host, and join in-person games nearby, eliminating the uncertainty of going to a local game store without knowing if anyone is available to play.

Think Meetup or Eventbrite for card game players, combined with a social layer that includes friends, messaging, group chats, and player reputation.

Players can discover games happening nearby, apply to join them, chat with participants, and build a network of friends within their local TCG community.

## The Problem

Many trading card game players experience this situation:

You go to a local game store hoping to play

You don't know if anyone else will be there

You may not know the community yet

Finding players for specific formats (Commander, Modern, etc.) is difficult

DuelMeet solves this by allowing players to coordinate games before they arrive.

Players can:

See games happening nearby

Host games at stores or public locations

Join games in advance

Chat with players before the meetup

Build a trusted network of local players

Features
Game Discovery & Hosting

Browse upcoming games filtered by TCG type, location, and radius

Host games with:

title

date & time

location

max players

notes

Apply to join games

Hosts can accept or deny applicants

Invite specific friends directly to games

Each game includes a lobby chat

Happening Now indicator for games active within 3 hours of start time

Automatic cleanup of expired games via a background server job

Social System

Send, accept, decline, or cancel friend requests

Add friends via unique player tag (e.g. #AB12CD3F)

View mutual friends

Unfriend at any time

Messaging

Direct messages between friends

Group chats (standalone or linked to a game)

Real-time message updates via polling

Unread message indicators

Delete conversations

Leave group chats

User Profiles

Each player has a customizable profile including:

Avatar

Bio and quote

Location

Favorite games

Reputation rating (0–5 stars from players after games)

Stats:

games hosted

games joined

friend count

Mutual friends displayed when viewing other profiles

Profiles are accessible throughout the app via interactive profile cards.

Authentication & Security

Username / email / password registration

Email verification required before login

JWT-based authentication (7-day tokens)

Password reset via email link

Verification and reset tokens expire after 24 hours

Account Deletion

Deleting an account performs a full cascade cleanup, removing:

Hosted games

Lobby messages

Reviews

Direct messages

Group chats

Group messages

Friend requests

This ensures no orphaned data remains in the database.

Tech Stack
Layer	Technology
Frontend	Angular 20
Mobile UI	Ionic 8
Native Support	Capacitor 8
Backend	Node.js + Express 5
Database	MongoDB (Mongoose 9)
Authentication	JWT + bcrypt
Validation	express-validator
Email	Nodemailer + Resend
Location	Google Places API
Mobile Builds	Capacitor (iOS / Android)
Architecture

DuelMeet uses a client–server architecture.

Frontend:

Angular + Ionic mobile-first UI

PWA deployment

Capacitor-ready for native builds

Backend:

Node.js REST API with Express

MongoDB database

JWT authentication

Background jobs for game expiration cleanup

Communication occurs through authenticated REST endpoints.

Geolocation

Game discovery uses MongoDB geospatial queries.

The backend stores game coordinates using a 2dsphere index, enabling queries such as:

find games within a configurable radius

sort results by proximity

This allows players to easily discover games happening near them.

Messaging System

Chats use real-time polling rather than websockets.

The frontend:

polls every 4 seconds using RxJS

only fetches messages newer than the last known timestamp

updates conversations without refreshing the page

This approach keeps implementation simple while maintaining near-real-time communication.

Unique Player Tag System

Each user receives an immutable unique tag during registration.

Example:

#AB12CD3F

Properties:

generated randomly on account creation

cannot be modified

used for friend lookup

prevents username scraping or spam

Deployment
Backend

Hosted on Railway

Node.js server

Environment variables managed via Railway dashboard

Automatic restart and deployment

Frontend

Built as a Progressive Web App (PWA) using Ionic.

Production build:

ionic build --prod

Output is generated in the www/ directory and can be deployed to:

Railway

Netlify

Vercel

any static hosting service

Mobile

The app is Capacitor-ready for native builds:

iOS

Android

External Services
Service	Purpose
Google Places API	Location autocomplete
Resend	Transactional email
Nodemailer	Email delivery
MongoDB Atlas	Cloud database
Key Technical Challenges

DuelMeet presented several non-trivial engineering problems that were solved:

Location-aware game discovery

MongoDB 2dsphere geospatial indexes and $near queries

Fast searches within a configurable radius

Active game window and auto-cleanup

"Happening Now" badge for 3 hours post-start

Background job deletes expired games after 24 hours

Immutable unique player tags

8-character hex tag per user

Used exclusively for friend lookup

Prevents spam or abuse

Cascade account deletion

10-step cleanup across multiple collections

Ensures no orphaned data (games, chats, friend requests) remain

Real-time messaging without websockets

RxJS polling every 4 seconds

Only fetches new messages since last timestamp

Email-gated features and verification

Hosting games, messaging, and other actions blocked until email is verified

Middleware enforces verification across the platform

Why I Built This

As a Magic: The Gathering player, I often ran into the same problem:

Going to a local game store without knowing if anyone would be there to play.

DuelMeet was built to make it easier for players to coordinate games ahead of time, meet new people, and build local TCG communities.

Screenshots
