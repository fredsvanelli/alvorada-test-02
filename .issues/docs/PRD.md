# Case 02 — Conflict-free bookings

We want to get to know how you solve problems. In this challenge, you will build a small solution, show how it works and talk with us about the decisions you made.

## The challenge

A team shares rooms or equipment. Build a system that answers whether a resource can be booked for a given period and lets you cancel a booking.

The solution can be a calendar, app, API, library or terminal application.

## How it should work

Start with a fixed list of resources. A booking has an `id`, `resource`, `start` and `end`, with the start before the end. Use numbers to represent time, with no need to deal with calendars or time zones.

A booking from 10 to 20 occupies the period starting at 10, but frees the resource exactly at 20. So another booking can start at 20. This rule can also be written as `[start, end)`. The overlap restriction applies to active bookings of the same resource, so different resources can be booked at the same time.

If the resource does not exist, the data is invalid or the slot is taken, explain the problem without creating the booking. A rejected attempt does not take the identifier. The identifier of a created booking, however, cannot be reused, even after cancellation.

Canceling a booking frees its slot. If it is already canceled, return `already_canceled` without changing anything. If it does not exist, report the error.

It must also be possible to check a period without booking it. For a valid resource and interval, report whether it is available and which active bookings conflict, in ascending identifier order. The check does not change the data.

Allow listing the bookings and seeing which are active or canceled. Everything can run in memory, one operation at a time. There is no need to implement payment, recurring bookings, authentication or concurrent access.

## An example

Consider resources R1 and R2 and make the following bookings:

| Booking | Resource | Period | Result |
|---|---|---|---|
| A | R1 | `[10,20)` | Accepted. |
| B | R1 | `[20,30)` | Accepted: starts when A ends. |
| C | R1 | `[19,21)` | Rejected: conflicts with A and B. |
| C | R2 | `[19,21)` | Accepted: the previous attempt did not take the identifier C. |

Checking R1 for `[19,21)` must show the conflicts A and B. After canceling A, R1 is available for `[10,20)`, but the identifier A remains taken.

## How to manage your time

We suggest spending up to four hours on implementation, tests and documentation. If you cannot finish everything in that time, send what you have and tell us what is left. The goal is a small solution that serves as a starting point for our conversation.

## Tools and use of AI

Use the language and tools you are most comfortable with. The solution can be an interface, API, terminal application, library with a runnable example or simulator. Choose the form that best fits your focus, whether front end, mobile, back end, architecture, algorithms or data.

The challenge rules apply to any approach, but you are free to decide how to organize and present the solution. There is no need to publish the application, pay for services or use hardware. If it depends on an external service, provide a local way to demonstrate it working.

You may use AI, documentation and libraries. Tell us how these tools helped, what you kept or changed and how you checked the result. We do not need your AI conversation history, since we want to know your decisions and how you verified the code.

## What to deliver

The delivery has two parts:

- **A Git repository with the solution's code, tests and documentation.** The README should explain how to install what is needed, run the application and run the tests. Include a demonstration we can reproduce, your main decisions and what is left to do.

- **A video of up to 30 minutes explaining the solution.** Show the application working, walk through the most important parts of the code and explain why you chose this approach.

### Repository and documentation

Create the repository on the service of your choice. In the README, state the case name or number, the focus you chose and how much time you spent on the work. Anyone who clones the project should be able to follow the demonstration with the instructions you left.

When explaining the tests, highlight up to three situations that help understand your solution, such as a value at the boundary of a rule, the interaction between two rules or an invalid input. Describe the expected result and what kind of error each test helps catch. You may write other tests, with no coverage percentage to reach.

Also describe two decisions you made during the work, explaining what you wanted to check, how you investigated and what you concluded. One of them can be about an AI suggestion, if you used one. These notes can live in the README itself and do not need to follow a form.

Use fictitious data and leave out credentials, real personal data and employers' code. The number of commits does not count in the evaluation.

### Video explaining the solution

The recording should help us follow your reasoning. Choose a scenario different from the example in this document, explain the result you expect and run the solution to compare it with what happened. Also show an important test and the part of the code it helps verify.

As you walk through the project, explain why you chose an approach, what alternative you considered and where the solution has limits. If something did not work, it is worth showing how you investigated.

There is no need to show your face, create slides, edit the recording or repeat your résumé. Use the time to explain the work, including how you checked the AI's suggestions, if any. If you need another presentation format, talk to the person following your process.

## How to submit

When you are ready, reply through the same channel where you received the invitation, sharing:

- The repository link and the full hash of the commit we should evaluate.

- The video link, which can also be in the README.

- The case name or number, the focus you chose and the approximate time spent.

- Any note needed to run the solution, if there is one.

The repository can be private. In that case, ask the person in charge which users should be given read access. Also check that we can open the video, without sending passwords or tokens. We will confirm receipt and access to the files.

The commit identifies the delivered code. If you keep working and want a change included in the evaluation, just let us know and send the new hash. You can also fix links, permissions and run instructions after submitting.
