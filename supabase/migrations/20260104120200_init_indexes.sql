-- migration: init_indexes
-- purpose: create indexes for query optimization based on access patterns
-- tables affected: userprofiles, parties, drinks, baccalculations, userthresholds, alerts, events
-- notes: composite indexes ordered by selectivity and query patterns

-- userprofiles indexes
-- simple index on user_id (already unique, this reinforces fast lookups)
create index idx_userprofiles_user_id on userprofiles(user_id);

-- parties indexes
-- composite index for fetching active party for user (most common query)
-- pattern: select * from parties where user_id = ? and status = 'ongoing' order by started_at desc
create index idx_parties_user_status_started on parties(user_id, status, started_at desc);

-- composite index for user's party history
-- pattern: select * from parties where user_id = ? order by started_at desc
create index idx_parties_user_started on parties(user_id, started_at desc);

-- drinks indexes
-- composite index for fetching drinks in party, sorted by consumption time
-- pattern: select * from drinks where party_id = ? order by consumed_at asc
create index idx_drinks_party_consumed on drinks(party_id, consumed_at asc);

-- composite index for fetching last drink in party (for editing - us-006)
-- pattern: select * from drinks where party_id = ? order by order_sequence desc limit 1
create index idx_drinks_party_sequence on drinks(party_id, order_sequence desc);

-- baccalculations indexes
-- composite index for fetching recent bac calculations for party
-- pattern: select * from baccalculations where party_id = ? order by created_at desc
create index idx_baccalculations_party_created on baccalculations(party_id, created_at desc);

-- simple index for looking up bac calculation by drink
-- pattern: select * from baccalculations where drink_id = ?
create index idx_baccalculations_drink on baccalculations(drink_id);

-- userthresholds indexes
-- composite index for fetching current threshold for user
-- pattern: select * from userthresholds where user_id = ? and is_current = true
create index idx_userthresholds_user_current on userthresholds(user_id, is_current);

-- simple index for threshold change history (us-014 analytics)
-- pattern: select * from userthresholds where trigger_party_id = ?
create index idx_userthresholds_trigger_party on userthresholds(trigger_party_id);

-- alerts indexes
-- composite index for polling active alerts (5-minute repeat logic - us-011)
-- pattern: select * from alerts where party_id = ? and is_active = true and last_alert_sent_at < ?
create index idx_alerts_party_active_sent on alerts(party_id, is_active, last_alert_sent_at);

-- events indexes
-- composite index for user event analytics
-- pattern: select * from events where user_id = ? and event_type = ? order by created_at desc
create index idx_events_user_type_created on events(user_id, event_type, created_at desc);

-- composite index for party event log
-- pattern: select * from events where party_id = ? order by created_at desc
create index idx_events_party_created on events(party_id, created_at desc);
