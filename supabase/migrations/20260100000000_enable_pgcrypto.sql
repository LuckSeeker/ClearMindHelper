-- migration: enable_pgcrypto
-- purpose: ensure pgcrypto extension is available for password hashing
-- date: 2026-01-18

create extension if not exists pgcrypto;
