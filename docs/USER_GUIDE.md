# GenRx User Guide

> **Type:** User Guide
> **Last updated:** 2026-05-30

## Table of Contents

- [Getting Started](#getting-started)
- [Student Workflow](#student-workflow)
- [Instructor Workflow](#instructor-workflow)
- [Admin Workflow](#admin-workflow)
- [FAQ](#faq)

# User Guidee

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
| **Student** | Join simulation groups, chat with AI patients, view debriefs |
| **Instructor** | Create and manage simulation groups, configure patients, review analytics |
| **Admin** | Manage organizations, assign instructors, manage question banks |

Your role determines which dashboard you see after logging in. If you have questions about your assigned role, contact your institution's administrator.

---

## Student Workflow

As a student, you practice clinical assessment skills by interacting with AI-powered patient personas in a safe, simulated environment.

### Joining a Simulation Group

Use the access code provided by your instructor (shared in class or via your institution’s Learning Management System) to join a group from your **Student Dashboard** by clicking **Join Group**, entering the code, and confirming. Once completed, the simulation group will appear on your dashboard with its available patient personas.

<img width="1883" height="817" alt="Screenshot 2026-06-08 115437" src="https://github.com/user-attachments/assets/a62953fc-483f-45d5-862f-40a78c60a331" />

### Viewing Available Patients

Select a simulation group from your dashboard to view its available patient personas, then browse the list where each patient card displays the patient’s name, age, and gender to help you identify the scenario.

<img width="1883" height="611" alt="Screenshot 2026-06-08 123616" src="https://github.com/user-attachments/assets/2191bdad-6414-4de0-9a0c-d441540e9ae3" />

### Starting a Chat Session

Click on a patient persona to open the patient dashboard, then select **Start Chat** to begin a new conversation where you can enter your clinical questions and assessments in the message field. This enables simulated pharmacist–patient interactions, allowing you to practice clinical questioning and apply clinical reasoning, with the AI patient responding based on its configured case materials and persona.

<img width="956" height="410" alt="Screenshot 2026-06-08 12583" src="https://github.com/user-attachments/assets/2fb6b4a3-fbad-4931-8c70-d9478a51b58d" />

### Using Voice Chat

If voice is enabled for the patient, a **Voice** option appears in the chat interface. Users can click the voice button to start a voice session, where they can speak naturally with the AI patient and receive responses through synthesized speech. Users can also switch between text and voice at any point within the same session.

<img width="955" height="407" alt="image" src="https://github.com/user-attachments/assets/9cd25392-b6a7-41a3-a15d-8a86bd33c010" />

### Concluding an Interaction

After gathering all necessary information, click **Conclude Interaction**. Enter your clinical diagnosis, recommendations, and rationale in the provided form, then submit to complete the session. A debrief will be generated to evaluate your interaction.

<img width="956" height="399" alt="Screenshot 2026-06-09 png" src="https://github.com/user-attachments/assets/c5cabc4c-3ebc-4fbd-8f5c-11c8d87a3b58" />

### Viewing Your Debrief

The debrief includes an AI-generated summary and evaluation of the user’s clinical interview, including identifying gaps in clinical reasoning, highlighting missed opportunities, and evaluating student assessments. A notice is included indicating that this content is AI-generated and should be used as guidance alongside your own clinical judgment, with any questions directed to your instructor.
  
     <img width="481" height="361" alt="image" src="https://github.com/user-attachments/assets/66a28474-d7a6-4e5c-89a3-6436ea0b9591" />

### Reviewing Chat History

1. From your dashboard, click **Chat History**.
2. Browse past sessions organized by simulation group and patient.
3. Select any session to review the full conversation transcript and debrief.

---

## Instructor Workflow

As an instructor, you design clinical simulation scenarios, manage student enrollment, and review performance analytics.

### Creating a Simulation Group

1. From your **Instructor Dashboard**, click **Create Simulation Group**.
2. Provide a name and description for the group.
3. Configure the system prompt that guides AI behavior for all patients in this group.
4. Set an access code that students use to join.
5. Save the group to make it available.

### Adding Patient Personas

1. Open an existing simulation group from your dashboard.
2. Click **Add Patient** to create a new persona.
3. Configure the patient details:
   - **Name, Age, Gender**: Basic demographics for the scenario
   - **Patient Prompt**: Instructions that define the patient's condition, personality, and responses
   - **Case Materials**: Upload PDF documents (lab results, medical history) that the AI uses for context
4. Save the patient persona.

### Configuring Key Questions

1. Within a patient persona, navigate to the **Key Questions** section.
2. Add questions that students should ask during the interaction.
3. These questions are used for semantic matching — the system detects when students address each topic.
4. Optionally, provide an answer key for debrief scoring.

### Managing Enrollments

1. Share the access code with your students.
2. View enrolled students from the simulation group page.
3. Monitor which students have joined and their interaction status.

### Configuring Debrief Settings

1. Open the simulation group settings.
2. Customize the debrief prompt to control how AI evaluates student performance.
3. Set message limits if you want to constrain interaction length.
4. Enable or disable voice chat for specific patients.

### Reviewing Analytics

1. From your simulation group page, access the **Analytics** section.
2. View engagement metrics including:
   - Student completion rates
   - Average scores against key questions
   - Time spent per interaction
   - Question coverage across students
3. Use these insights to identify areas where students need additional guidance.

---

## Admin Workflow

As an administrator, you manage the organizational structure, assign roles, and maintain shared resources like question banks.

### Managing Organizations

1. From the **Admin Home**, select **Organizations**.
2. Create a new organization or select an existing one.
3. Configure organization details:
   - Organization name and description
   - Contact information
   - Associated instructors

### Assigning Instructors

1. Navigate to the organization management page.
2. Click **Assign Instructor** to add an instructor to the organization.
3. Search for the instructor by email.
4. Confirm the assignment — the instructor can now create simulation groups under this organization.

### Managing Question Banks

1. From the Admin Home, select **Question Banks**.
2. Create organization-level question banks that instructors can reference.
3. Add questions with tags for categorization.
4. Questions in the bank are available for semantic matching across all simulation groups in the organization.

### Managing DTP Recommendation Banks

1. Navigate to **Recommendation Banks** from the Admin Home.
2. Create and organize drug therapy problem (DTP) recommendations.
3. These recommendations serve as reference material for debrief evaluations.

### Viewing Simulation Groups

1. As an admin, you have visibility into all simulation groups across your organization.
2. Navigate to any group to review its configuration, enrolled students, and analytics.
3. Use this access for quality assurance and support purposes.

---

## FAQ

### General

**Q: Which browsers are supported?**
A: GenRx works best in modern browsers including Chrome, Firefox, Safari, and Edge. Ensure your browser is up to date for the best experience.

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
A: The AI evaluates your conversation against the key questions configured by your instructor. It checks whether you addressed each clinical topic and compares your recommendation against the answer key.

**Q: Is voice chat available for all patients?**
A: Voice chat availability depends on your instructor's configuration. If the voice option is not visible, it has not been enabled for that patient.

### Instructors

**Q: How many patients can I add to a simulation group?**
A: There is no hard limit on the number of patients per group. Add as many scenarios as needed for your curriculum.

**Q: Can I edit a patient after students have started interacting?**
A: Yes, you can update patient prompts and case materials at any time. Changes apply to new sessions — existing conversations are not affected.

**Q: How do I upload case materials?**
A: When creating or editing a patient, use the file upload area to attach PDF documents. The system processes these documents and makes them available to the AI during conversations.

### Admins

**Q: Can I remove an instructor from an organization?**
A: Yes. Navigate to the organization page and manage instructor assignments from there. Removing an instructor does not delete their simulation groups.

**Q: How do question banks relate to individual patients?**
A: Organization-level question banks provide a shared pool of questions. Instructors can also add patient-specific questions. Both are used for semantic matching during student interactions.

---

## Related Documentation

For deployment and infrastructure details, see the [Deployment Guide](./DEPLOYMENT_GUIDE.md).
