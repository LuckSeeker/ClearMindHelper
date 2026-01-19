-- migration: add_unrealistic_volume_warning_event_type
-- purpose: add 'unrealistic_volume_warning' to enum_event_type for event logging
-- date: 2026-01-18

alter type enum_event_type add value if not exists 'unrealistic_volume_warning';
