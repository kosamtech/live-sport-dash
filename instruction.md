Act as a senior software architect. Generate required tables schema in `src/db/schema.ts` using Drizzle ORM and PostgreSQL for a real time sports application.

- create a match_status enum with values scheduled, live and finished
- Create a matches table with the fields is, sport, homeTeam, awayTeam, startTime, status, homeScore with default 0, awayScore with default 0 and createdAt with default now
- Create a commentary table with the fields id, matchId referencing the matches table, minute, sequence, period, eventType, actor, team, message, metadata(jsonb), tags and createdAt with default now
- Ensure you use camelCase for the variable names and the default snake_case naming convention for the table and column names