# Walrus Memory Community Agent

A community management agent that uses Walrus Memory to remember members across sessions — their role, skills, interests, contributions, and open tasks — instead of treating every conversation as new.

## Problem it solves

Community bots today forget members the moment a chat ends. People have to re-explain their role and context every single time, and mods lose track of who's working on what. This agent writes structured memory blobs to Walrus whenever a member shares durable info (a role change, a new project, a completed contribution), and reads that memory back on future interactions so conversations feel continuous.

## How it uses Walrus Memory

Each meaningful update is written as a timestamped JSON blob to Walrus Mainnet. On every new message, the agent retrieves the user's existing blobs by user_id and uses them as context before replying, without ever exposing one user's wallet, tasks, or contributions to another user.
