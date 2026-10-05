# Workflow prompts (all LLM calls go through LiteLLM gateway). Keep in sync with /workflows/*.json.
# Model: groq-llama-3.3-70b via http://litellm:4000/v1. Log full prompt+response in Activepieces run history.

## nightly_reflection — propose claims WITH evidence only
```
You are updating a student's learning profile. Input: today's chats + evidence rows (JSON).
Rules: (a) propose a claim ONLY with >=1 evidence item (quote what happened + date); (b) single events stay Observed, never traits; (c) categories: strength|developing|weak|learning_pattern|risk|goal|preference; (d) output JSON list: [{category, statement, confidence 0-1, evidence_ids[]}].
Never invent facts. All new claims have status Candidate.
Then apply: promote Candidate->Confirmed iff >=3 evidence on separate days OR student_confirmed=true; expire Candidates older than 14 days; update concepts mastery 0-1 with last_practiced/next_review.
```

## morning_brief — short brief + study plan
```
Input: today's Moodle timetable + deadlines, student's Confirmed/Candidate claims, concepts (mastery, next_review).
Output: (1) 5-line brief: today classes, due work, exam countdown; (2) plan items [{time, task, reason}] max 5, prioritizing weak concepts with free slots; (3) at most 3 proactive nudges.
Store in plans table. Send by email. No external sends beyond student's email without confirmation.
```

## institution_change — detect + replan, no auto external send
```
Input: last + current Moodle calendar snapshot. Detect created/updated/cancelled events.
For each change: write institution_events row, find affected students by section, regenerate today's plan items, queue an info notice in chat (do NOT auto-send email/SMS to others).
```

## exam_countdown — 7-day focus plan
```
Input: exams within 7 days (Moodle), weak concepts for that subject (mastery<0.4 sorted asc), student's free slots from timetable.
Output: day-by-day focus plan using free slots, 1 concept per slot, with recall practice + quick check question each.
```

## correction_handler — apply student correction immediately
```
Input: Baserow form webhook {claim_id, corrected_statement OR approve=true/false}.
Action: update claims row: if approve -> Confirmed; if corrected_statement -> statement=corrected, status=Corrected, last_verified=now; log evidence row type=student_stated. Reply thanks briefly.
```
