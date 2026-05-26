1. Problem-finding foundation

Before AI, students usually learned “solve this given problem.”
Now they must learn how to find the problem.

They need:

Observe real friction in daily life, lab, class, factory, or department.
Separate symptom from root problem.
Ask: who has the problem?
Ask: how often does it happen?
Ask: what happens if nobody fixes it?
Identify manual workflow steps.
Identify repeated tasks.
Identify data that already exists.
Identify missing data.
Identify who enters data.
Identify who uses data.
Identify approval steps.
Identify bottlenecks.
Identify physical constraints.
Identify safety constraints.
Identify cost constraints.
Identify time constraints.
Identify “nice to have” versus “must have.”
Identify what can be automated.
Identify what should not be automated.
Write the problem in one paragraph.
Explain why the problem matters.
Explain what success looks like.
Explain what failure looks like.
Compare current workflow versus improved workflow.

This is the foundation of “taste.” Without this, students will only ask AI to build toy apps.

2. Tool awareness foundation

Students need to know what tools exist and what each tool is good for.

Not deep mastery first. Just tool literacy.

They should know:

Browser-based AI chat.
Coding agents.
Local code editor.
GitHub.
Cloud deployment tools.
Database tools.
Spreadsheet tools.
Diagram tools.
API testing tools.
Serial monitor tools.
PLC programming software.
Arduino IDE / PlatformIO.
Python notebooks.
Dashboard tools.
OCR tools.
RAG / document search tools.
Google Forms / Sheets / Apps Script.
LINE bot / messaging API concept.
Google Drive / Classroom / Calendar API concept.
Database admin GUI.
Docker.
Cloud Run / simple hosting.
MQTT broker.
Modbus tools.
Network scanner.
Log viewer.
Terminal / command prompt.
Remote desktop.
Version control UI.
Issue tracker / task board.

But more important: they need to know what they do not have.

Example:

“I want automatic lab grading.”
Do we have student login?
Do we have assignment data?
Do we have file upload?
Do we have rubric?
Do we have hardware result data?
Do we have permission to use it?

This is a huge AI-era skill.

3. System vocabulary foundation

Students need words to describe systems.

Without vocabulary, they cannot direct AI well.

They need to understand:

User
Admin
Client
Server
Database
Frontend
Backend
API
Request
Response
Authentication
Authorization
Session
Token
Role
Permission
File upload
Storage
Queue
Job
Worker
Log
Error
Exception
Timeout
Retry
Cache
Sync
Backup
Deployment
Environment variable
Secret
Webhook
Polling
Real-time update
Local app
Cloud app
Edge device
Embedded controller
Sensor
Actuator
PLC
HMI
Dashboard
Gateway
Protocol
Data model
Schema
State
Workflow

A student does not need to code all of these from scratch, but they need to know what they mean.

4. Diagram foundation

This is very important. AI reads structured diagrams better than vague explanation.

Students should learn at least these formats:

1. Flowchart

For process logic.

Example:

Use for:

Lab process
Approval process
Error handling
Student workflow
Factory workflow
2. Sequence diagram

For “who talks to who.”

Use for:

API calls
AI agent workflow
Hardware-to-cloud communication
LINE bot interaction
3. C4 model

For system architecture.

They should know:

Context diagram — what system exists and who uses it.
Container diagram — web app, database, API, worker, device.
Component diagram — internal modules.
Code diagram — optional, usually not needed early.

For AI-era programming, C4 Context + Container is more useful than code for beginners.

4. State machine diagram

Very important for embedded/mechatronics.

Example:

Use for:

Robot behavior
PLC machine logic
Safety states
UI states
Assignment workflow
5. Data relationship diagram

Students need to understand data structure.

Example:

Use for:

Student system
Equipment borrowing system
Booking system
Lab tracking system
6. Block diagram

For physical systems.

Example:

Use for:

Mechatronics systems
IoT systems
PLC systems
Embedded control
5. Specification foundation

This may become more important than coding.

Students need to write clear specs for AI.

They should learn to write:

Problem statement
User story
Input/output description
Workflow description
Data fields
Rules
Constraints
Error cases
Success criteria
Acceptance test
Non-goals
Version history
Known limitations
Future improvement list
Example data

A good AI-era assignment should require something like this:

Build a lab submission tracker.

Users:
- Student
- Instructor

Student can:
- View lab steps
- Submit evidence for each step
- See feedback

Instructor can:
- Review submissions
- Approve or reject each step
- Export progress

Non-goals:
- No payment system
- No chat system
- No anti-cheat system

Success:
- A student can complete 3 lab steps.
- Instructor can see progress.
- System does not lose submitted files.

This is now a core programming skill.

6. Data foundation

Students must understand data, even if AI writes the database code.

They need:

What is data?
What is a record?
What is a table?
What is a field?
What is an ID?
What is a primary key?
What is a foreign key?
One-to-one relationship.
One-to-many relationship.
Many-to-many relationship.
Required field.
Optional field.
Data type.
Text versus number.
Date/time.
Boolean.
File path.
URL.
JSON.
CSV.
Spreadsheet structure.
Normalization basic idea.
Duplicate data problem.
Missing data problem.
Wrong format problem.
Data validation.
Data import.
Data export.
Backup.
Restore.
Audit log.
Who created this data?
Who changed this data?
When was it changed?
Can this data be deleted?
Should this data be archived?
Privacy.
Permission.
Data ownership.
Data lifecycle.

For first-year students, this may matter more than syntax.

7. Basic coding literacy

Even if they “never write code,” they need enough code literacy to judge AI output.

They should understand:

Variable
Function
Input
Output
Condition
Loop
List/array
Dictionary/object
String
Number
Boolean
Null / None
Error
Exception
File
Path
Import/library
Module
API call
Return value
Parameter
Scope
Type
Event handler
Callback
Asynchronous task
Promise / await concept
State
Configuration
Dependency

Not for leetcode.
Not for syntax exams.
But so they can understand what AI built.

8. Debugging foundation

This is still essential, but debugging changes.

Students need to debug system behavior, not just code.

They need to know:

Read error message.
Read stack trace.
Identify where error happened.
Reproduce the bug.
Describe expected behavior.
Describe actual behavior.
Change one thing at a time.
Check input data.
Check output data.
Check logs.
Check network request.
Check database record.
Check file path.
Check permission.
Check environment variable.
Check device connection.
Check sensor reading.
Check power supply.
Check wiring.
Check protocol setting.
Check baud rate.
Check IP address.
Check port.
Check version mismatch.
Check filename case.
Check time zone.
Check date format.
Check hidden assumption.
Create minimal test case.
Ask AI to explain the bug.
Ask AI for multiple possible causes.
Verify AI’s answer manually.
Keep a bug log.
Write what fixed it.

This is where students learn reality.

9. Testing foundation

Testing is not optional. It is the main way to control AI-generated systems.

Students need:

Manual test.
Automated test.
Unit test concept.
Integration test concept.
End-to-end test concept.
Hardware test.
Sensor calibration test.
Failure test.
Edge case test.
User acceptance test.
Regression test.
Test data.
Expected result.
Actual result.
Pass/fail criteria.
Screenshot evidence.
Test log.
Checklist.
Test before deployment.
Test after deployment.
Test with bad input.
Test with missing input.
Test with duplicate input.
Test with slow internet.
Test with device disconnected.
Test with wrong file format.
Test with multiple users.
Test with permission denied.
Test after AI modifies code.
Test before trusting AI.

For mechatronics, add:

Test emergency stop.
Test sensor failure.
Test actuator stuck.
Test wrong direction.
Test power loss.
Test noise.
Test communication loss.
Test manual override.
Test safe startup.
Test safe shutdown.

This should be graded heavily.

10. AI-operation foundation

Students need to learn how to work with AI as a tool/agent.

They need:

Prompt clearly.
Give context.
Give constraints.
Give examples.
Ask for plan first.
Ask for assumptions.
Ask for risks.
Ask for test cases.
Ask AI to criticize its own answer.
Ask AI to compare options.
Ask AI to generate diagrams.
Ask AI to generate data schema.
Ask AI to generate test checklist.
Ask AI to explain errors.
Ask AI to propose fixes.
Ask AI to avoid unnecessary features.
Ask AI to follow existing architecture.
Ask AI not to refactor unrelated parts.
Ask AI to produce patch notes.
Ask AI to produce documentation.
Ask AI to produce user manual.
Ask AI to produce troubleshooting guide.
Ask AI to generate sample data.
Ask AI to create acceptance criteria.
Ask AI to identify missing information.
Ask AI to say what it cannot know.
Verify AI output.
Detect hallucination.
Detect overbuilding.
Detect fake confidence.
Detect when AI repeats declined ideas.
Detect when AI breaks existing behavior.
Detect when AI makes hidden assumptions.
Keep conversation context organized.
Use AI memory carefully.
Use AI-generated code only after testing.
Use AI-generated architecture only after review.
Use AI-generated explanation only after checking reality.

This is “agent direction.”

11. Workflow foundation

Students need repeatable development workflow.

Not just “ask AI to build app.”

A good basic workflow:

Observe problem.
Write problem statement.
Identify users.
Draw current workflow.
Draw improved workflow.
List data needed.
List tools available.
List constraints.
Define minimum useful system.
Ask AI for architecture.
Review architecture.
Cut unnecessary features.
Ask AI to build prototype.
Run prototype.
Test main path.
Test failure path.
Record what failed.
Ask AI to fix only that issue.
Retest.
Demo to another person.
Collect feedback.
Decide: improve, stop, or rebuild.
Write short documentation.
Write limitations.
Write next version plan.

This is the real programming cycle now.

12. Scope-control foundation

This is one of the hardest skills.

Students need to learn:

Minimum viable product.
Prototype.
Production system.
Feature creep.
Non-goals.
Deferred features.
“Do not build this yet.”
“Use existing tool instead.”
“Manual is fine for now.”
“Spreadsheet is enough.”
“Cloud is not needed.”
“Database is not needed.”
“AI is not needed.”
“Real-time is not needed.”
“Mobile app is not needed.”
“Login is not needed yet.”
“Admin panel is not needed yet.”
“Automation is dangerous here.”
“This is a policy problem, not software.”
“This is a hardware problem, not software.”
“This is a training problem, not software.”

This is very hard for first-year students, so it must be taught explicitly.

13. System composition foundation

This is where real software lives.

Students need to understand how pieces connect:

Web app talks to backend.
Backend talks to database.
Backend talks to AI API.
Backend talks to file storage.
Backend talks to external API.
Device talks to gateway.
Gateway talks to cloud.
PLC talks to HMI.
PLC talks to sensor/actuator.
Dashboard reads database.
LINE bot sends command.
Local machine executes command.
Cloud stores result.
User sees result.

They should be able to draw:

Student → Web App → API → Database
                         ↓
                       AI Grader

For mechatronics:

Sensor → Microcontroller → Gateway → Cloud API → Dashboard
          ↓
        Actuator

This is much more important than writing a sorting algorithm.

14. Cloud and deployment foundation

Even beginner students need basic deployment literacy.

They should know:

Local machine.
Server.
Cloud.
Hosting.
Domain.
HTTPS.
Port.
Environment variable.
Secret.
Database connection string.
Deployment.
Build.
Runtime.
Log.
Restart.
Crash.
Cold start.
Scaling.
Cost.
Backup.
Region.
Storage.
Upload limit.
User account.
Permission.
API key.
Rate limit.
Monitoring.
Rollback.
Version.

They do not need to become cloud engineers, but they need to understand why “it works on my computer” is not enough.

15. Security and safety foundation

AI makes it easier to build insecure systems. Students need basics.

They need:

Password safety.
Do not hard-code secrets.
API key safety.
User permission.
Admin permission.
Role-based access.
Private data.
Student data protection.
File upload risk.
Input validation.
SQL injection concept.
Prompt injection concept.
Malicious file concept.
Public versus private link.
Backup safety.
Logging sensitive data risk.
Physical safety.
Electrical safety.
Machine safety.
Emergency stop.
Manual override.
Fail-safe design.
Human approval.
Audit trail.
Do not automate dangerous actions blindly.

For mechatronics, safety must be part of every project.

16. Physical computing foundation

For mechatronics students, this is their advantage over pure CS students.

They need:

Voltage.
Current.
Power.
Ground.
Digital input.
Digital output.
Analog input.
PWM.
Relay.
Motor driver.
Sensor noise.
Calibration.
Debouncing.
Pull-up/pull-down.
Signal level.
Serial communication.
I2C.
SPI.
UART.
CAN basic concept.
Modbus basic concept.
PLC input/output.
HMI.
Actuator delay.
Mechanical tolerance.
Sensor placement.
Wiring fault.
Power supply problem.
Grounding problem.
Environmental noise.
Safety interlock.
Emergency stop.
Manual mode.
Auto mode.
Maintenance mode.

AI is weaker here because real physical systems are messy.

17. Industrial communication foundation

This is a major mechatronics moat.

Students should know:

Serial communication.
TCP/IP basics.
IP address.
Port.
Client/server.
MQTT.
Modbus RTU.
Modbus TCP.
OPC UA concept.
PLC register.
Coil.
Holding register.
Read/write command.
Polling.
Update rate.
Timeout.
Retry.
Gateway.
Edge device.
Data logger.
SCADA concept.
HMI concept.
Dashboard concept.
Cloud bridge.
Local network.
Firewall.
Network failure.
Offline mode.
Sync after reconnect.
Timestamping machine data.

This is where “programming” becomes real engineering.

18. UI/UX foundation

Students need enough design sense to judge whether a system is usable.

They need:

Who is the user?
What does the user need first?
What should be visible?
What should be hidden?
What is the main action?
What is secondary?
What is dangerous?
What needs confirmation?
What needs status display?
What needs error message?
What needs history?
What needs search?
What needs filter?
What needs export?
What needs mobile view?
What needs dashboard view?
What needs admin view?
Empty state.
Loading state.
Error state.
Success state.
Warning state.
Accessibility.
Color meaning.
Icon meaning.
Form design.
Table design.
Step-by-step wizard.
Notification.
Avoid clutter.

This connects strongly to your apps: booking, lab tracking, student planner, building management.

19. Documentation foundation

If students use AI, documentation becomes the control layer.

They need to write:

README.
System overview.
User manual.
Admin manual.
Installation guide.
Deployment guide.
Troubleshooting guide.
API documentation.
Data dictionary.
Architecture diagram.
Workflow diagram.
Test plan.
Known issues.
Changelog.
Decision record.
Prompt log.
AI mistake log.
Version notes.
Future work.
Non-goals.

This is how they maintain coherence.

20. Version and change management foundation

Students need to understand that systems evolve.

They need:

Version number.
Change log.
Backup before change.
Git commit concept.
Branch concept.
Rollback.
Compare versions.
Release note.
Breaking change.
Migration.
Test after change.
Record why change was made.
Do not change many things at once.
Keep old working version.
Tag stable version.
Track bugs.
Track feature requests.
Track declined features.
Track technical debt.
Track AI-generated changes.

This is especially important when students rely on agents.

21. Evaluation foundation

Students need to know how to judge whether a system is good.

Not by “it looks cool.”

They should evaluate:

Does it solve the original problem?
Does it work end-to-end?
Is it easier than the old way?
Does another user understand it?
Does it fail safely?
Does it handle bad input?
Does it preserve data?
Does it show useful errors?
Is it maintainable?
Is it too complex?
Is it too expensive?
Is it secure enough?
Is it documented?
Is it testable?
Is it useful after the demo?
What did AI get wrong?
What did the student cut?
What changed after feedback?
What would be dangerous to automate?
What is the next smallest improvement?

This should replace many old programming rubrics.

22. Communication foundation

Students need to explain systems to humans and AI.

They need:

Explain problem simply.
Explain system architecture.
Explain workflow.
Explain data.
Explain constraints.
Explain test result.
Explain failure.
Explain tradeoff.
Explain why they cut something.
Explain what AI did.
Explain what they verified.
Explain what remains uncertain.
Explain to technical person.
Explain to non-technical user.
Explain to manager/instructor.
Explain to teammate.
Explain to AI agent.
Ask clear question.
Give clear bug report.
Give clear change request.

This is now part of engineering.

23. Ethics and responsibility foundation

AI-era students must understand responsibility.

They need:

AI output can be wrong.
Human is responsible.
Do not fake results.
Do not submit untested AI output.
Do not hide AI use.
Respect data privacy.
Respect copyright.
Respect user consent.
Avoid biased automation.
Avoid unsafe automation.
Avoid surveillance without reason.
Avoid collecting unnecessary data.
Avoid overclaiming system ability.
Label limitations.
Keep human approval for high-risk actions.
Know when not to use AI.
Know when not to automate.
Know when to ask expert.
Know safety standard exists.
Know engineering failure can harm people.

For mechatronics, this is not abstract. A wrong output can move a motor.

24. Domain foundation

Programming alone is not enough. Students need domain knowledge.

For mechatronics:

Mechanics.
Electronics.
Control systems.
Sensors.
Actuators.
PLC.
Robotics.
CAD/CAM concept.
Manufacturing process.
Industrial automation.
Maintenance.
Quality control.
Safety.
Energy use.
Production line.
Human-machine interface.
Machine cycle.
Downtime.
Calibration.
Failure mode.

This is what lets them identify real problems. Without domain experience, they can only build generic apps.

25. The real foundation stack

If I compress everything, the AI-era programming foundation is this:

1. See real problems
2. Describe workflows
3. Understand data
4. Understand systems
5. Use diagrams
6. Use tools
7. Direct AI clearly
8. Test reality
9. Debug behavior
10. Control scope
11. Document decisions
12. Maintain over time

That is the new foundation.

Coding is still inside it, but no longer the center.

Suggested progression for students
Year 1: Digital literacy + problem/workflow thinking

Focus:

Problem observation
Flowcharts
Basic data
Simple AI prompting
Spreadsheets
Simple web tools
Basic programming concepts
Basic physical input/output

Assignment type:

Observe one real problem in your life. Draw the current workflow. Use AI to create a simple tool or mockup. Test it with one friend.

Year 2: System composition

Focus:

Database
API
Web app
Git
Testing
Mermaid diagrams
Basic cloud
Arduino/PLC integration

Assignment type:

Build a small system that records data from a physical or manual process and shows it in a dashboard.

Year 3: Real mechatronics integration

Focus:

PLC / Modbus / MQTT
Sensor calibration
Safety states
Data logging
Cloud/local architecture
C4 diagrams
User testing

Assignment type:

Build a lab/factory mini-system with device, gateway, database, dashboard, and test plan.

Year 4: Agent-directed engineering project

Focus:

AI agents
RAG
system documentation
deployment
real user feedback
maintenance
scope control

Assignment type:

Use AI agents to build and deploy a real system for a real user. Grade based on usefulness, testing, documentation, and iteration.

The most important insight

First-year students cannot do what you do because your workflow depends on hidden foundations:

experience → problem taste → system vocabulary → tool knowledge → architecture thinking → testing instinct → scope control

So the curriculum should not start with:

“Use AI to build an app.”

It should start with:

“Observe a real process. Describe it clearly. Draw it. Identify data. Identify failure. Then use AI to build the smallest useful improvement.”

That is the bridge from beginner to your current workflow.