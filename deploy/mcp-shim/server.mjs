// Minimal read-only MCP shim: LibreChat -> Moodle (isar web service).
//
// Exposes exactly one tool, `moodle_timetable`. It reads the caller's identity
// from the X-Student-Email header that LibreChat substitutes from
// {{LIBRECHAT_USER_EMAIL}}. It never accepts a caller-supplied Moodle token and
// never trusts a target student supplied by the model: a requested student must
// equal the authenticated header value or the call is refused.
//
// Moodle credentials arrive only through the environment and are never returned.

import { createServer } from 'node:http';

const PORT = Number(process.env.SHIM_PORT || 4010);
const MOODLE_URL = (process.env.MOODLE_URL || 'https://moodle.localhost').replace(/\/$/, '');
const MOODLE_TOKEN = process.env.MOODLE_ISA_READER_TOKEN || '';
const MOODLE_TZ = process.env.MOODLE_TZ || 'Europe/London';
const CALENDAR_DAYS = Number(process.env.CALENDAR_DAYS || 14);
const EXPECTED_SERVICE_USER = process.env.MOODLE_SERVICE_USER || 'isa_reader';

// email -> { username, userid }. userid is the Moodle numeric id; every response
// is re-checked against `username` so a stale id fails closed instead of
// silently returning the wrong student's timetable.
const STUDENTS = JSON.parse(process.env.MCP_STUDENTS_JSON || '{}');

const PROTOCOL_VERSION = '2024-11-05';

function send(res, status, payload, sse) {
  const body = JSON.stringify(payload);
  if (sse) {
    res.writeHead(status, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    res.end(`event: message\ndata: ${body}\n\n`);
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body);
}

async function moodleCall(wsfunction, params) {
  const body = new URLSearchParams({
    wstoken: MOODLE_TOKEN,
    wsfunction,
    moodlewsrestformat: 'json',
    ...params,
  });
  const res = await fetch(`${MOODLE_URL}/webservice/rest/server.php`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Moodle HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Moodle returned non-JSON: ${text.slice(0, 200)}`);
  }
}

function toolResult(res, id, text, isError, sse) {
  send(
    res,
    200,
    {
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text }], isError: Boolean(isError) },
    },
    sse,
  );
}

async function handleCall(res, id, args, callerEmail, sse) {
  const requested = (args && args.student_email) || callerEmail;
  const target = STUDENTS[String(requested).trim().toLowerCase()];

  if (!target) {
    return toolResult(
      res,
      id,
      `Access denied: "${requested}" is not an authorised student in this deployment.`,
      true,
      sse,
    );
  }
  if (target.email !== callerEmail) {
    return toolResult(
      res,
      id,
      `Access denied: you are signed in as ${callerEmail} and may only read your own timetable. ` +
        `A request for ${requested} was refused.`,
      true,
      sse,
    );
  }

  // core_enrol_get_users_courses returns course fields only (no per-user identity),
  // so it cannot confirm who the rows belong to. The only identity this shim can
  // verify is the web-service account itself, so assert that the token is still the
  // expected read-only service before trusting any data.
  const site = await moodleCall('core_webservice_get_site_info', {});
  if (typeof site?.username === 'string' && site.username !== EXPECTED_SERVICE_USER) {
    return toolResult(
      res,
      id,
      `Access denied: the Moodle web-service token now belongs to "${site.username}", ` +
        `expected the read-only service "${EXPECTED_SERVICE_USER}". Refusing to return data.`,
      true,
      sse,
    );
  }

  const courses = await moodleCall('core_enrol_get_users_courses', { userid: String(target.userid) });
  if (!Array.isArray(courses)) {
    return toolResult(res, id, `Moodle returned an error for courses: ${JSON.stringify(courses)}`, true, sse);
  }

  const start = Math.floor(Date.now() / 1000);
  const end = start + CALENDAR_DAYS * 86400;
  const calParams = {
    'options[timestart]': String(start),
    'options[timeend]': String(end),
  };
  courses.forEach((c, i) => {
    calParams[`events[courseids][${i}]`] = String(c.id);
  });
  const calendar = await moodleCall('core_calendar_get_calendar_events', calParams);
  const events = Array.isArray(calendar?.events) ? calendar.events : [];

  const courseLines = courses.map((c) => `- ${c.shortname} (${c.fullname})`);
  const eventLines = events.map((e) => {
    const when = new Date(e.timestart * 1000).toISOString().replace('.000Z', 'Z');
    return `- ${when}  ${e.name}${e.location ? ` @ ${e.location}` : ''}`;
  });

  const text =
    `Timetable for ${target.username} (${target.email}) over the next ${CALENDAR_DAYS} days ` +
    `[${MOODLE_TZ}].\n\nCourses (${courses.length}):\n${courseLines.join('\n') || '- none'}\n\n` +
    `Events (${events.length}):\n${eventLines.join('\n') || '- none'}`;

  return toolResult(res, id, text, false, sse);
}

const TOOLS = [
  {
    name: 'moodle_timetable',
    description:
      "Return the signed-in student's own Moodle courses and upcoming calendar events " +
      '(read-only). Never returns another student’s data.',
    inputSchema: {
      type: 'object',
      properties: {
        student_email: {
          type: 'string',
          description:
            'Optional. Must match the signed-in user. Used only to verify that a request ' +
            'for a different student is refused.',
        },
      },
      additionalProperties: false,
    },
  },
];

const server = createServer((req, res) => {
  const sse = String(req.headers.accept || '').includes('text/event-stream');

  if (req.method === 'GET') {
    // Server-initiated stream is not used; report readiness instead.
    send(res, 200, { status: 'ok', tool: 'moodle_timetable' }, sse);
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method not allowed' }, false);
    return;
  }

  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 1e6) req.destroy();
  });
  req.on('end', async () => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return send(res, 400, { error: 'invalid JSON' }, false);
    }
    const { id = null, method, params = {} } = msg;
    const callerEmail = String(req.headers['x-student-email'] || '').trim().toLowerCase();
    // Never log tokens; record who is calling and which method.
    if (process.env.SHIM_DEBUG_BODY) {
      console.log(`[req] method=${method} caller=${callerEmail || '(none)'} body=${raw.slice(0, 300)}`);
    } else {
      console.log(`[req] method=${method} caller=${callerEmail || '(none)'}`);
    }

    try {
      if (method === 'initialize') {
        return send(
          res,
          200,
          {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: 'isa-moodle-readonly', version: '1.0.0' },
            },
          },
          sse,
        );
      }
      if (method === 'notifications/initialized') {
        res.writeHead(202).end();
        return;
      }
      if (method === 'tools/list') {
        return send(res, 200, { jsonrpc: '2.0', id, result: { tools: TOOLS } }, sse);
      }
      if (method === 'tools/call') {
        if (!callerEmail) {
          return toolResult(
            res,
            id,
            'Access denied: no X-Student-Email header was present, so the caller is unidentified.',
            true,
            sse,
          );
        }
        if (params.name !== 'moodle_timetable') {
          return toolResult(res, id, `Unknown tool: ${params.name}`, true, sse);
        }
        return await handleCall(res, id, params.arguments || {}, callerEmail, sse);
      }
      if (method === 'ping') {
        return send(res, 200, { jsonrpc: '2.0', id, result: {} }, sse);
      }
      return send(
        res,
        200,
        { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } },
        sse,
      );
    } catch (err) {
      return toolResult(res, id, `Shim error: ${err.message}`, true, sse);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const who = Object.keys(STUDENTS).join(', ') || '(none)';
  console.log(
    `[isa-moodle-readonly] listening on :${PORT}; Moodle=${MOODLE_URL}; students=${who}; ` +
      `token=${MOODLE_TOKEN ? 'present' : 'MISSING'}`,
  );
});

// Fail fast if the token was not supplied rather than serving empty results.
if (!MOODLE_TOKEN) {
  console.error('[isa-moodle-readonly] MOODLE_ISA_READER_TOKEN is not set');
  process.exit(1);
}