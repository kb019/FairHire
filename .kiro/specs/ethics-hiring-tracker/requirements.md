# Requirements Document

## Introduction

The Ethics Hiring Tracker is a web application that promotes fairness and reduces unconscious bias in the hiring process. It serves two primary audiences: HR professionals who create job postings and review applicants, and job applicants who submit resumes.

The system operates in three distinct phases:

1. **HR Job Posting Ethics Check** — As an HR user types a job posting, the system analyzes the text in real time and flags biased or exclusionary language inline, allowing HR to fix issues before publishing.
2. **Blind Resume Submission** — When an applicant uploads a resume, the system silently and automatically redacts all identity and bias signals (name, photo, age, gender, nationality, etc.) without showing the applicant what was removed. The applicant receives no feedback about redaction.
3. **Anonymous Candidate Review** — HR sees only anonymous candidates identified by a generated ID (e.g., "Candidate #1042"). Only merit-based content (skills, experience, education, qualifications) is visible. When HR decides to advance a candidate, they request contact info, which reveals only the candidate's email and phone number — all other identity information remains permanently hidden.

The goal is to create a structurally fair hiring pipeline where bias is removed at the source rather than managed after the fact.

## Glossary

- **Analyzer**: The AI-powered service that processes text and identifies ethical issues in job postings, and performs identity redaction on resumes.
- **Anonymous_ID**: A system-generated identifier assigned to each Applicant's submission (e.g., "Candidate #1042") that replaces the Applicant's real name throughout the HR review workflow.
- **Applicant**: A job seeker who submits a resume through the platform.
- **Bias_Indicator**: A word, phrase, or pattern in text that may introduce unfair advantage or disadvantage based on protected characteristics (e.g., age, gender, race, nationality, religion).
- **Compliance_Score**: A numerical score (0–100) representing the ethical compliance level of a Job_Posting.
- **Dashboard**: The user interface that displays analysis results, scores, and candidate lists to HR_Users.
- **Ethics_Report**: A structured document summarizing all identified ethical issues in a Job_Posting, their severity, and suggested corrections.
- **HR_User**: A human resources professional who creates job postings and reviews applicants on the platform.
- **Issue**: A specific ethical concern identified by the Analyzer in a Job_Posting, classified by type and severity.
- **Job_Posting**: A structured description of an open role created by an HR_User, including title, responsibilities, requirements, and compensation.
- **Redacted_Resume**: A version of a submitted Resume from which all identity and bias signals have been automatically removed by the Redactor.
- **Redactor**: The component responsible for identifying and removing identity signals from a submitted Resume to produce a Redacted_Resume.
- **Resume**: A document submitted by an Applicant describing their work history, skills, education, and qualifications.
- **Severity**: A classification of an Issue as one of: `critical`, `warning`, or `suggestion`.
- **System**: The Ethics Hiring Tracker application as a whole.

---

## Requirements

### Requirement 1: HR User Authentication and Account Management

**User Story:** As an HR professional, I want to create and manage my account, so that I can securely access the platform and manage my organization's job postings.

#### Acceptance Criteria

1. THE System SHALL allow HR_Users to register with a valid email address and password.
2. WHEN an HR_User submits registration credentials, THE System SHALL validate the email format and enforce a minimum password length of 8 characters containing at least one uppercase letter, one lowercase letter, and one number.
3. WHEN an HR_User provides valid credentials at login, THE System SHALL authenticate the HR_User and issue a session token valid for 8 hours.
4. IF an HR_User provides invalid credentials at login, THEN THE System SHALL return an error message without revealing which field is incorrect.
5. WHEN an HR_User's session token expires, THE System SHALL redirect the HR_User to the login page.

---

### Requirement 2: Applicant Authentication and Account Management

**User Story:** As a job applicant, I want to create and manage my account, so that I can securely submit resumes to job postings.

#### Acceptance Criteria

1. THE System SHALL allow Applicants to register with a valid email address and password.
2. WHEN an Applicant submits registration credentials, THE System SHALL validate the email format and enforce a minimum password length of 8 characters containing at least one uppercase letter, one lowercase letter, and one number.
3. WHEN an Applicant provides valid credentials at login, THE System SHALL authenticate the Applicant and issue a session token valid for 8 hours.
4. IF an Applicant provides invalid credentials at login, THEN THE System SHALL return an error message without revealing which field is incorrect.
5. WHEN an Applicant's session token expires, THE System SHALL redirect the Applicant to the login page.

---

### Requirement 3: Job Posting Creation and Management

**User Story:** As an HR professional, I want to create and manage job postings, so that I can attract candidates while maintaining ethical standards.

#### Acceptance Criteria

1. THE System SHALL provide HR_Users with a form to create a Job_Posting containing: job title, department, location, employment type, responsibilities, required qualifications, preferred qualifications, and compensation range.
2. WHEN an HR_User submits a Job_Posting, THE System SHALL store the Job_Posting and associate it with the HR_User's account.
3. THE System SHALL allow HR_Users to edit, archive, or delete any Job_Posting they own.
4. WHEN an HR_User edits a Job_Posting, THE System SHALL re-analyze the updated content and refresh the Ethics_Report.
5. THE System SHALL display a list of all Job_Postings owned by the HR_User, showing title, creation date, and current Compliance_Score.

---

### Requirement 4: Real-Time Job Posting Ethics Analysis

**User Story:** As an HR professional, I want my job posting analyzed for biased language as I type, so that I can correct problems before publishing and attract a diverse candidate pool.

#### Acceptance Criteria

1. WHILE an HR_User is editing a Job_Posting in the text editor, THE Analyzer SHALL re-analyze the content and update Issue highlights within 2 seconds of the HR_User pausing input for 1 second.
2. THE Analyzer SHALL detect Bias_Indicators in job postings including but not limited to: gendered language (e.g., "rockstar", "ninja", "manpower"), age-related language (e.g., "recent graduate", "digital native"), and culturally exclusive phrases.
3. THE Analyzer SHALL detect unrealistic or exclusionary requirements, including requirements for years of experience that exceed the age of the technology referenced.
4. THE Analyzer SHALL detect missing inclusive language elements, such as the absence of an equal opportunity employer (EEO) statement.
5. THE Analyzer SHALL classify each identified Issue with a Severity of `critical`, `warning`, or `suggestion`.
6. THE Analyzer SHALL assign a Compliance_Score to each Job_Posting based on the number and Severity of Issues found, where zero Issues yields a score of 100.
7. THE Dashboard SHALL highlight Issue locations inline within the Job_Posting text using color-coded markers corresponding to Severity.
8. THE Dashboard SHALL update the Compliance_Score in real time as Issues are resolved or introduced during editing.
9. IF the real-time analysis service is unavailable, THEN THE System SHALL display a notification to the HR_User and fall back to analysis on explicit submission.

---

### Requirement 5: Resume Submission

**User Story:** As a job applicant, I want to upload my resume to apply for a job, so that I can be considered for the role based on my qualifications.

#### Acceptance Criteria

1. THE System SHALL allow Applicants to upload a Resume in PDF or DOCX format.
2. WHEN an Applicant uploads a Resume file, THE System SHALL parse the file and extract its text content within 10 seconds.
3. IF an Applicant uploads a file that is not in PDF or DOCX format, THEN THE System SHALL reject the file and display an error message specifying the accepted formats.
4. IF an Applicant uploads a file exceeding 5 MB in size, THEN THE System SHALL reject the file and display an error message specifying the size limit.
5. WHEN a Resume is successfully submitted, THE System SHALL display a confirmation message to the Applicant indicating the resume was received.
6. THE System SHALL NOT display to the Applicant any information about what content was redacted or modified from their Resume.

---

### Requirement 6: Resume Parsing

**User Story:** As a system operator, I want submitted resumes parsed into structured data, so that the Redactor can reliably identify and remove identity signals.

#### Acceptance Criteria

1. WHEN a Resume is submitted, THE Analyzer SHALL parse the Resume text into structured sections: contact information, summary, work experience, education, skills, and certifications.
2. IF a Resume section cannot be identified, THEN THE Analyzer SHALL flag the section as undetected and continue parsing the remaining content.
3. THE Resume_Printer SHALL format parsed Resume data back into a structured text representation.
4. FOR ALL valid parsed Resume objects, parsing then printing then parsing SHALL produce an equivalent structured Resume object (round-trip property).

---

### Requirement 7: Automatic Identity Redaction

**User Story:** As a system operator, I want all identity and bias signals automatically removed from submitted resumes before HR sees them, so that hiring decisions are based solely on merit.

#### Acceptance Criteria

1. WHEN a Resume is submitted, THE Redactor SHALL automatically process the Resume and produce a Redacted_Resume without any action required from the Applicant.
2. THE Redactor SHALL remove or replace the following fields from every Resume: full name, photograph, age, date of birth, gender indicators, marital status, nationality, religion, and home address.
3. WHEN THE Redactor removes a Applicant's full name, THE System SHALL replace it with the Applicant's Anonymous_ID (e.g., "Candidate #1042") in the Redacted_Resume.
4. THE Redactor SHALL preserve the following fields in the Redacted_Resume: skills, work experience (excluding employer addresses), education (excluding graduation year where it implies age), certifications, and professional qualifications.
5. THE Redactor SHALL complete processing and produce a Redacted_Resume within 15 seconds of Resume submission.
6. THE System SHALL assign each Applicant a unique Anonymous_ID upon account creation and use that same Anonymous_ID consistently across all Job_Posting applications.
7. THE System SHALL NOT expose the mapping between an Anonymous_ID and an Applicant's real identity to any HR_User unless the HR_User has explicitly requested contact information for that Applicant.

---

### Requirement 8: Anonymous Candidate Review

**User Story:** As an HR professional, I want to review applicants without seeing their identity, so that I can shortlist candidates based purely on their qualifications.

#### Acceptance Criteria

1. THE Dashboard SHALL display a list of applicants for each Job_Posting using only the Applicant's Anonymous_ID (e.g., "Candidate #1042") — no real name, photo, or other identity information SHALL be shown.
2. THE Dashboard SHALL display the following merit-based content for each applicant: skills, work experience, education, certifications, and professional qualifications as extracted from the Redacted_Resume.
3. THE System SHALL NOT display any identity signals — including name, age, gender, nationality, religion, marital status, or home address — to the HR_User during the candidate review workflow.
4. THE System SHALL allow HR_Users to sort and filter the candidate list by skills, years of experience, and education level.
5. THE System SHALL allow HR_Users to mark a candidate as "shortlisted" or "rejected" using only the Anonymous_ID as the identifier.

---

### Requirement 9: Contact Information Request

**User Story:** As an HR professional, I want to request contact details for a shortlisted candidate, so that I can move them forward in the hiring process without prematurely revealing their identity.

#### Acceptance Criteria

1. THE System SHALL provide HR_Users with a "Request Contact Info" action for each candidate in the applicant list.
2. WHEN an HR_User triggers "Request Contact Info" for a candidate, THE System SHALL reveal only the Applicant's email address and phone number to that HR_User.
3. THE System SHALL NOT reveal the Applicant's real name, photo, age, gender, nationality, religion, marital status, or home address when contact information is requested.
4. WHEN contact information is revealed to an HR_User, THE System SHALL log the disclosure event including the HR_User's ID, the Applicant's Anonymous_ID, the Job_Posting ID, and the timestamp.
5. THE System SHALL display the revealed contact information alongside the Applicant's Anonymous_ID so the HR_User can associate the contact details with the correct candidate.
6. WHEN an Applicant's contact information has been revealed to an HR_User, THE Dashboard SHALL indicate this status on the candidate's entry in the applicant list.

---

### Requirement 10: Compliance Score and Job Posting Reporting

**User Story:** As an HR professional, I want a clear compliance score and detailed report for each job posting, so that I can understand its ethical standing and track improvements over time.

#### Acceptance Criteria

1. THE System SHALL calculate the Compliance_Score using the formula: `100 - (critical_count × 15) - (warning_count × 5) - (suggestion_count × 1)`, with a minimum score of 0.
2. THE Dashboard SHALL display the Compliance_Score prominently as a numerical value and a color-coded indicator: green (80–100), yellow (50–79), red (0–49).
3. THE System SHALL generate a downloadable Ethics_Report in PDF format for any analyzed Job_Posting.
4. THE System SHALL maintain a history of Compliance_Scores for each Job_Posting, allowing HR_Users to view score changes over time.
5. WHEN a Job_Posting achieves a Compliance_Score of 80 or above, THE System SHALL display a compliance badge on the Job_Posting.

---

### Requirement 11: Issue Explanation and Educational Content

**User Story:** As an HR professional, I want to understand why something is flagged as an ethical issue, so that I can learn and make informed corrections.

#### Acceptance Criteria

1. WHEN an HR_User selects an Issue in the Ethics_Report, THE System SHALL display a detailed explanation of why the Issue was flagged, referencing relevant fairness principles or legal context (e.g., EEOC guidelines).
2. THE System SHALL provide at least one concrete suggested correction for each Issue.
3. THE System SHALL provide a link to an educational resource for each Issue type, explaining the broader context of the bias or fairness concern.
4. THE System SHALL allow HR_Users to mark an Issue as "acknowledged but intentional" with a required written justification, which removes the Issue from the Compliance_Score calculation.

---

### Requirement 12: HR Analytics Dashboard

**User Story:** As an HR professional, I want an analytics overview of all my job postings' ethical compliance, so that I can identify systemic issues across my organization's hiring practices.

#### Acceptance Criteria

1. THE Dashboard SHALL display aggregate statistics for all Job_Postings owned by the HR_User, including: average Compliance_Score, total Issues by Severity, and most frequently occurring Issue types.
2. THE Dashboard SHALL display a trend chart showing average Compliance_Score over time across all Job_Postings.
3. THE System SHALL rank Issue types by frequency across all Job_Postings and display the top 5 most common Issue types to the HR_User.
4. WHEN an HR_User has no Job_Postings, THE Dashboard SHALL display an empty state with guidance on creating the first Job_Posting.

---

### Requirement 13: Data Privacy and Security

**User Story:** As a user of the platform, I want my data handled securely and privately, so that sensitive personal and organizational information is protected.

#### Acceptance Criteria

1. THE System SHALL encrypt all Resume, Redacted_Resume, and Job_Posting content at rest using AES-256 encryption.
2. THE System SHALL transmit all data between the client and server over HTTPS using TLS 1.2 or higher.
3. THE System SHALL ensure that an HR_User cannot access Job_Postings or Ethics_Reports belonging to another HR_User.
4. THE System SHALL ensure that an Applicant cannot access Resumes belonging to another Applicant.
5. THE System SHALL store the mapping between an Applicant's Anonymous_ID and their real identity in a separate, access-controlled data store that is not accessible through the standard HR review workflow.
6. WHEN an Applicant requests account deletion, THE System SHALL permanently delete all associated Resumes, Redacted_Resumes, contact information, and personal data within 30 days.
7. WHEN an HR_User requests account deletion, THE System SHALL permanently delete all associated Job_Postings, Ethics_Reports, and personal data within 30 days.
