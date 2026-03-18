import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BookAppointment from "@/pages/BookAppointment";
import ClinicianSchedule from "@/pages/ClinicianSchedule";
import AdminDashboard from "@/pages/AdminDashboard";
import { CalendarPlus, Calendar, Shield, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { setRole, getRole, type Role } from "@/lib/api";

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, _setRole] = useState<Role>(getRole());

  function handleRoleChange(newRole: Role) {
    setRole(newRole);
    _setRole(newRole);
  }

  const currentTab =
    location.pathname === "/schedule"
      ? "schedule"
      : location.pathname === "/admin"
        ? "admin"
        : "book";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">L</span>
            </div>
            <span className="font-bold text-lg">Lyrebird Clinic</span>
          </NavLink>

          <div className="flex items-center gap-3">
            <Tabs
              value={currentTab}
              onValueChange={(v) =>
                navigate(v === "book" ? "/" : v === "schedule" ? "/schedule" : "/admin")
              }
            >
              <TabsList>
                <TabsTrigger value="book" className="gap-1.5">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Book</span>
                </TabsTrigger>
                <TabsTrigger value="schedule" className="gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Schedule</span>
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={role} onValueChange={(v) => handleRoleChange(v as Role)}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <User className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="patient">Patient</SelectItem>
                <SelectItem value="clinician">Clinician</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<BookAppointment />} />
          <Route path="/schedule" element={<ClinicianSchedule />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
