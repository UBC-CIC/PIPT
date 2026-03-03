import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/components/UserAvatar';
import { mockDataService } from '@/services/studentService';
import { ArrowLeft, CheckCircle, Loader, Circle } from 'lucide-react';
import { SIMULATION_GROUP_COLOR_PALETTE, UI_COLORS } from '@/lib/colors';

/**
 * PatientsPage Component
 * 
 * Displays a list of patients for a specific simulation group.
 * Shows patient name, avatar placeholder, completion status, and review button.
 */
function PatientsPage() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  
  // Load user data from mock data service
  const user = mockDataService.getCurrentUser();
  
  // Load patients from mock data service
  const patients = mockDataService.getPatients();

  /**
   * Handle sign out event
   */
  const handleSignOut = () => {
    navigate('/login');
  };

  /**
   * Handle back to home navigation
   */
  const handleBackToHome = () => {
    navigate('/');
  };

  /**
   * Handle review button click
   */
  const handleReview = (patientId: string) => {
    navigate(`/patients/${groupId}/${patientId}`);
  };

  /**
   * Get debrief status badge
   */
  const getDebriefStatusBadge = (status: 'not_started' | 'in_progress' | 'debrief_reached') => {
    const statusConfig = {
      'debrief_reached': {
        icon: CheckCircle,
        text: 'Debrief Reached',
        bgColor: SIMULATION_GROUP_COLOR_PALETTE[6], // Green
        textColor: UI_COLORS.button.text
      },
      'in_progress': {
        icon: Loader,
        text: 'In Progress',
        bgColor: SIMULATION_GROUP_COLOR_PALETTE[2], // Blue
        textColor: UI_COLORS.button.text
      },
      'not_started': {
        icon: Circle,
        text: 'Not Started',
        bgColor: UI_COLORS.border.light, // Gray
        textColor: UI_COLORS.text.body
      }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
        style={{
          backgroundColor: config.bgColor,
          color: config.textColor
        }}
      >
        <Icon className="w-4 h-4" style={{ color: UI_COLORS.text.black }} />
        <span className="font-medium text-sm">{config.text}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: UI_COLORS.background.white }}>
      {/* Header */}
      <header className="flex border-b border-border items-center justify-between py-6 px-8" style={{ backgroundColor: UI_COLORS.header.background }}>
        <div className="flex items-center gap-4">
          <UserAvatar
            name={user.name}
            imageUrl={user.avatarUrl}
            size="medium"
          />
          <div className="flex flex-col items-start gap-0.5">
            <h1 className="font-bold tracking-tight leading-tight text-2xl" style={{ color: UI_COLORS.text.heading }}>
              Patients
            </h1>
            <button
              onClick={handleBackToHome}
              className="font-normal text-sm flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
              style={{ color: UI_COLORS.text.body }}
              onMouseEnter={(e) => e.currentTarget.style.color = UI_COLORS.text.heading}
              onMouseLeave={(e) => e.currentTarget.style.color = UI_COLORS.text.body}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home Page
            </button>
          </div>
        </div>

        <div className="flex items-center">
          <Button
            variant="default"
            onClick={handleSignOut}
            className="px-6 transition-colors"
            style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-8 py-6">
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: UI_COLORS.background.white, borderWidth: '1px', borderStyle: 'solid', borderColor: UI_COLORS.border.default }}>
          <table className="w-full">
            <thead style={{ backgroundColor: UI_COLORS.background.tableHeader, borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.default }}>
              <tr>
                <th className="px-6 py-4 text-center font-semibold" style={{ color: UI_COLORS.text.heading }}>Patient</th>
                <th className="px-6 py-4 text-center font-semibold" style={{ color: UI_COLORS.text.heading }}>Status</th>
                <th className="px-6 py-4 text-center font-semibold" style={{ color: UI_COLORS.text.heading }}>Review</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="last:border-b-0"
                  style={{ borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: UI_COLORS.border.light }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-center">
                      <UserAvatar
                        name={patient.name}
                        imageUrl={patient.avatarUrl}
                        size="small"
                      />
                      <span style={{ color: UI_COLORS.text.heading }}>{patient.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getDebriefStatusBadge(patient.debriefStatus)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button
                      onClick={() => handleReview(patient.id)}
                      variant="default"
                      className="px-6 transition-colors"
                      style={{ backgroundColor: UI_COLORS.button.secondary, color: UI_COLORS.button.text }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondaryHover}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.secondary}
                    >
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default PatientsPage;
