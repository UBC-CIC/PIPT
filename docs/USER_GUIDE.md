# GenRx User Guide

> **Type:** User Guide
> **Last updated:** 2026-06-09

## Table of Contents

- [Getting Started](#getting-started)
- [Student Workflow](#student-workflow)
- [Instructor Workflow](#instructor-workflow)
- [Admin Workflow](#admin-workflow)
- [FAQ](#faq)

## Getting Started

### Creating Your Account

1. Navigate to the GenRx sign-up page provided by your institution.
2. Enter your email address and create a password that meets the security requirements.
3. Verify your email address by clicking the confirmation link sent to your inbox.
4. Log in with your credentials to access the platform.

### Logging In

1. Open the GenRx application URL in your browser.
2. Enter your registered email and password.
3. Click **Sign In** to access your role-specific dashboard.

### Understanding Your Role

GenRx supports three user roles, each with different capabilities:

| Role | Description |
|------|-------------|
| **Student** | Join simulation groups, interact with virtual patients (text and voice), submit conclusions, view debriefs and chat history |
| **Instructor** | Create and manage simulation groups, configure patients, include/exclude bank items, and review student work and analytics |
| **Admin** | Everything instructors can do, plus: manage organizations, enroll/remove instructors, create/edit/delete bank items at the organization level, manage prompts, and view student issues and feedback |

Your role determines which dashboard you see after logging in. If you have questions about your assigned role, contact your institution's administrator.

---

## Student Workflow

Students practice clinical assessment skills by interacting with AI-powered patient personas in a safe, simulated environment.

### Joining a Simulation Group

Use the access code provided by your instructor (shared in class or via your institution’s Learning Management System) to join a group from the **Student Dashboard** by clicking **Join Group**, entering the code, and confirming. Once completed, the simulation group will appear on your dashboard with its available patient personas.

<img width="954" height="408" alt="image" src="media/student-dashboard.png" />

### Viewing Available Patients

Select a simulation group from your dashboard to view its available patient personas, then browse the list where each patient card displays the patient’s name, age, and gender to help you identify the scenario.

<img width="954" height="408" alt="image" src="media/student-view-patients.png" />

### Starting a Chat Session

Click on a patient persona to open the patient dashboard, then select **Start New Interaction** to begin a new conversation where you can enter your clinical questions and assessments in the message field. This enables simulated pharmacist–patient interactions, allowing you to practice clinical questioning and apply clinical reasoning, with the AI patient responding based on its configured case materials and persona.

> **Tip:** For best results, ask only one clinical question per message. This allows the system to accurately match your questions against the evaluation criteria.

<img width="954" height="408" alt="image" src="media/student-chat-text-mode.png" />

### Using Learning Media
Students can engage with embedded media (e.g., H5P) within virtual patient scenarios to support the development of physical assessment and clinical skills.

<img width="954" height="408" alt="image" src="media/student-chat-phys-assessment-tab-open.png" />

> **Note:** All patient information displayed in the simulation (including Personal Health Numbers, names, addresses, and other identifying details) is entirely fictional and generated solely for educational purposes. No real patient data is used at any point in the platform.

### Using Voice Chat

If voice is enabled for the patient, a **Voice** option appears in the chat interface. Users can click the voice button to start a voice session, where they can speak naturally with the AI patient and receive responses through synthesized speech. Users can also switch between text and voice at any point within the same session.

<img width="954" height="408" alt="image" src="media/student-chat-voice-mode.png" />

### Concluding an Interaction

After gathering all necessary information, click **Conclude Interaction**. Enter the drug therapy problems you identified during the interaction, your recommendations, and rationale in the provided form, then submit to complete the session. A debrief will be generated to evaluate your interaction.

<img width="954" height="408" alt="image" src="media/student-conclude-interactions.png" />

### Viewing Your Debrief

The debrief includes an AI-generated summary and evaluation of the user’s clinical interview, including identifying gaps in clinical reasoning, highlighting missed opportunities, and evaluating student submissions. A notice is included indicating that this content is AI-generated and should be used as guidance alongside your own clinical judgment, with any questions directed to your instructor.
  
<img width="954" height="408" alt="image" src="media/student-chat-view-debrief.png" />

### Reviewing Chat History

From your dashboard, you can access past sessions, browse by simulation group and patient, and select any session to review the full interaction transcript and debrief.

<img width="954" height="408" alt="image" src="media/student-view-chat-history.png" />

---

## Instructor Workflow

As an instructor, you design clinical simulation scenarios, manage student enrollment, and review performance analytics.

### Creating a Simulation Group

1. From your **Instructor Dashboard**, click **Create New Group**.
2. Provide a name and description for the group.
3. Toggle the active status of the group to make it available.

<img width="954" height="408" alt="image" src="media/instructor-create-new-group.png" />

As an instructor, you can either create a new group or be manually assigned to an existing group by an admin. The dashboard should look like this:

<img width="954" height="408" alt="image" src="media/instructor-sim-group-view.png" />

### Managing a Simulation Group

Instructors can open an existing simulation group from their dashboard to view cohort-level insights including analytics, patient and student information, as well as the ability to include/exclude bank items (Key Questions, DTPs, and Recommendations) at the simulation group level (global) or per-patient.

<img width="954" height="408" alt="image" src="media/instructor-analytics.png" />


### Managing Patient Personas

1. Within a simulation group, navigate to the Manage Patients tab in the sidebar. Instructors will be able to view and edit the patients configured in the current simulation group, as well as add new patients.

<img width="954" height="408" alt="image" src="media/instructor-manage-patients.png" />

2. To create a new patient: click on **Create new Patient** to create a new persona.

#### Patient Information

Fill in the basic demographics for the scenario including the patient's name, age, and gender. These details are displayed to students on the patient card and help set the context for the clinical encounter.

<img width="954" height="408" alt="image" src="media/instructor-create-patient-info.png" />

#### Voice Preview

Configure the voice settings for the patient persona. Select a voice profile and preview how the patient will sound during voice-enabled interactions. This allows instructors to choose a voice that matches the patient's demographics and personality.

<img width="954" height="408" alt="image" src="media/instructor-create-patient-voice-preview.png" />

#### Text and Voice Prompts

Define the patient prompt that controls the AI patient's behavior during conversations. This includes instructions about the patient's personality and how they should respond to student questions. For voice-enabled patients, a separate voice prompt can be configured to tailor responses for spoken interactions.

<img width="954" height="408" alt="image" src="media/instructor-create-patient-prompts.png" />

#### LLM Upload and Patient Information Upload

Upload case materials (PDF documents such as lab results, medical history, or clinical notes) that the AI uses as context during conversations. Additionally, upload any supplementary patient information files that help define the scenario. These documents are processed and made available to the AI to ensure clinically accurate responses.

<img width="954" height="408" alt="image" src="media/instructor-create-new-patient-save.png" />

#### Saving the Patient

Once all patient details, prompts, and materials are configured, click **Save** to create the patient persona. The patient will then appear in the simulation group's patient list and be available to enrolled students.

### Editing an Existing Patient

To edit an existing patient, click the **Edit** button on the patient you want to modify. This opens the same patient creation form, pre-populated with the patient's existing information. You can update any field (demographics, voice settings, prompts, or uploaded materials) and save your changes.

In addition to the standard patient information fields, this form also allows instructors to inline-edit patient-specific bank items including key questions, DTPs, and recommendations, as well as physical assessment materials for that patient.

### Managing Bank Items

Bank items are the clinical content used to evaluate student interactions. There are three types:

- **Key Questions:** questions students should ask during the patient interaction, used for semantic matching to detect when a topic is addressed
- **Drug Therapy Problems (DTPs):** clinical issues students should identify during the interaction
- **Recommendations:** suggested actions or treatment plans students should propose to the patient

Within a simulation group, navigate to the respective tabs on the sidebar where you can manage all three types: Question Bank, DTP Bank, Recommendations Bank. Each type follows the same workflow:

1. **Switch between Global and Per-Patient tabs:** Global items apply across all patients in the group, while per-patient items are scoped to a specific persona.
2. **Include or exclude items:** Toggle items on or off to control which ones are active for evaluation.
3. **Expand items:** Click to expand any bank item to view its full content before deciding whether to include it.

#### Key Questions

The global tab shows all key questions available across the simulation group:

<img width="954" height="408" alt="image" src="media/instructor-sim-group-question-bank.png" />

Switch to the patient-specific tab to manage key questions scoped to an individual patient:

<img width="954" height="408" alt="image" src="media/instructor-question-bank-patient-specific.png" />

#### Drug Therapy Problems

The DTP bank displays available drug therapy problems. Expand any item to review its full content before including or excluding it:

<img width="954" height="408" alt="image" src="media/instructor-dtp-bank-accordion.png" />

Each DTP item contains the following fields:

- **Title:** A short label for quick reference when browsing the bank. Not used in evaluation.
- **Expected DTP Text:** The core content of the drug therapy problem. This is the text that the system semantically matches against what the student identifies during the interaction. If a student's response is close enough in meaning to this field, the DTP is considered addressed.
- **Clinical Intent:** Explains why this DTP is clinically relevant and what it tests. Provides context on what competency the student should demonstrate by identifying this problem.
- **Evaluation Criteria:** Additional context provided to the LLM to guide how it assesses whether the student adequately identified or addressed the DTP during the interaction.

#### Recommendations

The recommendation bank works the same way: expand items to see full details and toggle inclusion as needed.

<img width="954" height="408" alt="image" src="media/instructor-rec-bank-accordion.png" />

Each recommendation item contains the following fields:

- **Title:** A short label for quick reference when browsing the bank. Not used in evaluation.
- **Expected Recommendation Text:** The core content of the recommendation. This is the text that the system semantically matches against what the student proposes during the interaction. If a student's recommendation is close enough in meaning to this field, it is considered addressed.
- **Evaluation Criteria:** Additional context provided to the LLM to guide how it assesses whether the student's recommendation was appropriate and sufficiently detailed.
- **Rationale:** The gold-standard clinical reasoning that instructors or admins set to define the expected thought process behind the recommendation. For matched recommendations, the LLM uses this rationale to determine whether the student receives full credit or partial credit based on how closely their reasoning aligns with the intended clinical logic.

### Managing Enrollments and Reviewing Student Work

Share the access code with your students so they can join the simulation group. Within the group, navigate to **Manage Students** to view a list of all enrolled students along with their email addresses.

<img width="954" height="408" alt="image" src="media/instructor-manage-students.png" />

From here, instructors can select any individual student to view student-specific analytics including the number of cases completed and the percentage of interactions where a debrief was reached, as well as a list of all their interactions.

<img width="954" height="408" alt="image" src="media/instructor-manage-students-particular.png" />

Select a particular interaction to review the full chat transcript between the student and the AI patient:

<img width="954" height="408" alt="image" src="media/instructor-manage-students-chat-history.png" />

Instructors can also review student submissions and debriefs, and export chat transcripts and notes for record-keeping or further review:

<img width="954" height="408" alt="image" src="media/instructor-manage-students-submissions.png" />

### Reviewing Analytics

From your simulation group page, access the **Analytics** section to view cohort-level engagement metrics including student completion rates and overall interaction trends.

<img width="954" height="408" alt="image" src="media/instructor-analytics.png" />

Beyond the group overview, instructors can view more granular per-patient analytics including the number of students who successfully asked each key question, and stated each required DTP and Recommendation giving insight into which clinical topics students are addressing or missing:

<img width="954" height="408" alt="image" src="media/instructor-patient-specific-analytics.png" />
<img width="954" height="408" alt="image" src="media/instructor-patient-specific-analytics-2.png" />


The message distribution chart shows the breakdown of student messages versus AI messages across interactions, helping instructors gauge how actively students are engaging:

<img width="954" height="408" alt="image" src="media/instructor-analytics-msg-dist.png" />

Student progress status provides a snapshot of where students are in their workflow: how many have not started, how many are in progress, and how many have reached a debrief. Instructors can also hover over any bar in the chart to see the names of the students in that category.

<img width="954" height="408" alt="image" src="media/instructor-analytics-student-progress-status.png" />

---

## Admin Workflow

As an admin, you have all the same capabilities as an instructor: creating and managing simulation groups, configuring patients, and reviewing student work. In addition, admins can manage instructors (enroll them and assign them to simulation groups) and create, edit, and delete bank items (key questions, DTPs, recommendations) at the organization level, making them available for inclusion/exclusion across all simulation groups.

### Managing Organizations

From the **Admin Home Page**, admins can view all organizations they have access to.

<img width="954" height="408" alt="image" src="media/admin-view-all-organisations.png" />

To create a new organization, click **Create New Organization** and fill in the name, description, AI persona title, user title, and system prompt.

<img width="954" height="408" alt="image" src="media/admin-create-new-org.png" />

Once inside an organization, admins can view all simulation groups within that organization. The **Manage Banks** button at the top right provides access to create, edit, and delete bank items (key questions, DTPs, recommendations) at the organization level. These are then available for inclusion/exclusion across all simulation groups in that organization.

<img width="954" height="408" alt="image" src="media/admin-pharmacy-org.png" />

### Managing Bank Items (Organization Level)

Admins can manage bank items across all simulation groups within an organization. Navigate to **Manage Banks** from the organization page to access the question bank, DTP bank, and recommendations bank tabs.

<img width="954" height="408" alt="image" src="media/admin-manage-banks.png" />

From here, admins can create, edit, and delete items in each bank. All bank items are defined at the organization level, which means they're available for reuse across all simulation groups without needing to be re-created for every group.

There are two scopes for applying bank items within a simulation group:
- **Global:** applies to all patients in that sim group
- **Patient-specific:** applies only to a particular patient

This scoping happens from within a simulation group's sidebar tabs (Question Bank, DTP Bank, Recommendations Bank), where instructors or admins toggle which items to include or exclude at either the global level (across all patients in that simulation group) or the per-patient level.

**Question Bank:**

<img width="954" height="408" alt="image" src="media/admin-manage-banks-qb-global.png" />

**DTP Bank:**

<img width="954" height="408" alt="image" src="media/admin-manage-banks-dtp-global.png" />

**Recommendations Bank:**

<img width="954" height="408" alt="image" src="media/admin-manage-banks-recs-global.png" />

### Viewing Simulation Groups

Admins can navigate into any simulation group within an organization. The view is similar to the instructor experience, with additional admin-only options in the sidebar: managing instructors, viewing issues and feedback, and managing prompts.

<img width="954" height="408" alt="image" src="media/admin-sim-group-page.png" />

### Assigning Instructors

Within a simulation group, admins can add or remove instructors via the **Manage Instructors** tab in the sidebar. Only users with verified accounts can be elevated to an instructor role. Once added, their name and email will appear in the Manage Instructors tab, along with an option to unenroll them.

<img width="954" height="408" alt="image" src="media/admin-add-instructor.png" />

### Issues and Feedback

The **Issues & Feedback** section in the sidebar collects two types of student input:

- **Issue Reports:** Students can flag problems during their interactions with patient personas. For example, if the AI patient is not following the context from uploaded documents or something else went wrong during the session.
- **Debrief Feedback:** Students can share whether the debrief was helpful, along with an optional comment.

<img width="954" height="408" alt="image" src="media/admin-issues-reports.png" />

<img width="954" height="408" alt="image" src="media/admin-debrief-feedback.png" />

### Managing Prompts

From the **Manage Prompts** tab in the sidebar, admins can edit both the system prompt and the debrief prompt for the simulation group. Prompt history is maintained so admins can roll back to a previous version if needed.

**System Prompt:**

<img width="954" height="408" alt="image" src="media/admin-manage-prompts-system.png" />

**Debrief Prompt:**

<img width="954" height="408" alt="image" src="media/admin-manage-prompts-debrief.png" />

Each prompt also has a **Prompt Playground** where admins can test out changes before applying them:

**System Prompt Playground:**

<img width="954" height="408" alt="image" src="media/admin-manage-prompts-sys-playground.png" />

**Debrief Prompt Playground:**

<img width="954" height="408" alt="image" src="media/admin-manage-prompts-debrief-playground.png" />

---

## FAQ

### General

**Q: Which browsers are supported?**
A: GenRx works best in modern browsers including Chrome, Safari, and Edge. Ensure your browser is up to date for the best experience. **Voice chat does not work in Firefox.** Use Chromium-based browsers for voice interactions.

**Q: I forgot my password. How do I reset it?**
A: Click the **Forgot Password** link on the login page. Enter your email address and follow the instructions in the reset email.

**Q: Can I change my role?**
A: Roles are assigned by your institution's administrator. Contact your admin if you need a role change.

### Students

**Q: My access code isn't working. What should I do?**
A: Verify the code with your instructor. Access codes are case-sensitive. If the group has been archived or closed, the code may no longer be valid.

**Q: Can I redo a conversation with a patient?**
A: Yes. You can start a new chat session with the same patient at any time. Each session is tracked independently.

**Q: How is my debrief score calculated?**
A: As you chat with the AI patient, the system compares the meaning of what you say against the key questions, DTPs, and recommendations configured by your instructor, even if you don't use the exact same wording. If what you ask or recommend is close enough in meaning to a bank item, it counts as addressed. Your debrief score reflects how many of these items you successfully covered, compared against the gold-standard answers set by your instructor or admin.

**Q: Is voice chat available for all patients?**
A: Voice chat availability depends on your instructor's configuration. If the voice option is not visible, it has not been enabled for that patient.

### Instructors

**Q: How many patients can I add to a simulation group?**
A: There is no hard limit on the number of patients per group. Add as many scenarios as needed for your curriculum.

**Q: Can I edit a patient after students have started interacting?**
A: Yes, you can update patient prompts and case materials at any time. Changes apply to new sessions; existing conversations are not affected.

**Q: How do I upload case materials?**
A: When creating or editing a patient, use the file upload area to attach PDF documents. The system processes these documents and makes them available to the AI during conversations.

### Admins

**Q: Can I remove an instructor from an organization?**
A: Yes. Navigate to the organization page and manage instructor assignments from there. Removing an instructor does not delete their simulation groups.

**Q: How do question banks relate to individual patients?**
A: Bank items (key questions, DTPs, recommendations) are created at the organization level by admins, giving all simulation groups in that organization access to a shared pool. Within a simulation group, instructors or admins can then include or exclude any of these items at two levels: global (applies to all patients in that sim group) or patient-specific (applies only to a particular patient). This means you define items once at the organization level and selectively apply them where needed: globally for broad coverage, or per-patient for scenario-specific evaluations. During a student interaction, only the items that have been included (either globally or for that specific patient) are used to evaluate the student's performance.

---

## Related Documentation

For deployment and infrastructure details, see the [Deployment Guide](./DEPLOYMENT_GUIDE.md).
