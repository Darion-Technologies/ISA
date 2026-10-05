# STEP 4 — Moodle least privilege evidence
Generated 2026-10-05T20:39:29Z. All Moodle calls over https://moodle.localhost with --cacert (no --insecure). Token value never stored in evidence.

## Remaining tokens (both old overprivileged tokens revoked)
token 3 | user=isa_reader | service=isar

## isa_reader roles (student only -> no enrol/manual:enrol capability)
isa_reader -> roles: student

## ISA Reader service scope (4 read functions)
isar | ISA Reader (read-only) | enabled=1 | files=0/0 | functions: core_webservice_get_site_info, core_calendar_get_calendar_events, core_enrol_get_users_courses, mod_assign_get_assignments

## Mobile service scope for contrast
moodle_mobile_app | Moodle mobile web service | enabled=1 | files=1/1 | functions: core_badges_get_badge, core_badges_get_user_badges, core_badges_get_user_badg

## Write / out-of-scope attempts (all must be refused)
wsfunction=core_user_create_users -> {"exception":"webservice_access_exception","errorcode":"accessexception","message":"Access control exception"}
wsfunction=core_course_create_courses -> {"exception":"webservice_access_exception","errorcode":"accessexception","message":"Access control exception"}
wsfunction=core_course_get_courses -> {"exception":"webservice_access_exception","errorcode":"accessexception","message":"Access control exception"}

## student1 enrolled courses (readable by isa_reader)
['CHEM106', 'ENG105', 'EG104', 'CS103', 'PHY102', 'MATH101']

## Next 7 days calendar: 15 events (matches DB count of 15 for the same window; response is {"events":[...],"warnings":[...]})
