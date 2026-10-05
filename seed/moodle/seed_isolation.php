<?php
/**
 * Seeds Moodle so that data-level isolation between student1 and student2 can be
 * demonstrated, not merely asserted:
 *
 *   1. student2 is unenrolled from 2 of the 6 courses, so the two students have
 *      visibly different course lists (4 vs 6).
 *   2. student2 gets one private, user-level calendar event whose name and
 *      description contain the marker SECRET_STUDENT2_DO_NOT_LEAK. That marker
 *      must never appear in anything student1 can read.
 *
 * Run inside the Moodle container:
 *   docker compose cp seed/moodle/seed_isolation.php moodle:/tmp/seed_isolation.php
 *   docker compose exec -T moodle php /tmp/seed_isolation.php
 *
 * Idempotent: re-running does not duplicate anything.
 * This is demo/verification seed data, not application code, and it is not
 * reachable by the agent or by the MCP shim.
 */

define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/lib/enrollib.php');
require_once($CFG->dirroot . '/calendar/lib.php');

global $DB;

const ISOLATION_MARKER = 'SECRET_STUDENT2_DO_NOT_LEAK';

$u2 = $DB->get_record('user', ['username' => 'student2', 'deleted' => 0], '*', MUST_EXIST);

// 1. Differentiated enrolments: drop student2 from CS103 (4) and ENG105 (6).
$drop = [4 => 'CS103', 6 => 'ENG105'];
foreach ($drop as $cid => $short) {
    $already = false;
    foreach (enrol_get_instances($cid, true) as $inst) {
        if ($inst->enrol !== 'manual') {
            continue;
        }
        $linked = $DB->record_exists('user_enrolments', ['enrolid' => $inst->id, 'userid' => $u2->id]);
        if ($linked) {
            enrol_get_plugin('manual')->unenrol_user($inst, $u2->id);
            echo "unenrolled student2 from $short (course $cid)\n";
        } else {
            $already = true;
        }
    }
    if ($already) {
        echo "student2 already absent from $short\n";
    }
}

// 2. Private user-level event owned by student2.
$name = 'PRIVATE: student2 personal appointment';
if ($DB->record_exists('event', ['modulename' => 'user', 'eventtype' => 'user', 'name' => $name])) {
    echo "private event already present\n";
} else {
    $e = new stdClass();
    $e->name = $name;
    $e->description = ISOLATION_MARKER . ' - this must never appear in student1 output.';
    $e->courseid = 0;
    $e->groupid = 0;
    $e->repeatid = 0;
    $e->modulename = 'user';
    $e->moduleusername = $u2->username;
    $e->userid = $u2->id;          // calendar_event::calculate_context() needs this.
    $e->eventtype = 'user';
    $e->timestart = time() + (2 * 86400);
    $e->timeduration = 3600;
    $e->visible = 1;
    $e->timemodified = time();
    $e->format = FORMAT_HTML;
    $e->priority = null;
    $e->privacy = null;

    $ev = calendar_event::create($e, false);
    echo 'created private event id=' . $ev->id . ' start=' . gmdate('c', $ev->timestart) . "\n";
}

echo "done\n";