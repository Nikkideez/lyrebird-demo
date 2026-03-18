import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type Clinician, type Appointment } from "@/lib/api";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";

export default function ClinicianSchedule() {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [clinicianId, setClinicianId] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getClinicians().then(setClinicians).catch(console.error);
  }, []);

  const fetchAppointments = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const params: { from?: string; to?: string } = {};
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(`${to}T23:59:59`).toISOString();
      const data = await api.getClinicianAppointments(clinicianId, params);
      setAppointments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [clinicianId, from, to]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const clinician = clinicians.find((c) => c.id === clinicianId);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent rounded-lg">
          <Calendar className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Clinician Schedule</h1>
          <p className="text-muted-foreground text-sm">
            View upcoming appointments for a clinician
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Clinician</Label>
            <Select value={clinicianId} onValueChange={setClinicianId}>
              <SelectTrigger>
                <SelectValue placeholder="Select clinician" />
              </SelectTrigger>
              <SelectContent>
                {clinicians.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {clinicianId && (
        <div className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No upcoming appointments found</p>
              {clinician && (
                <p className="text-sm mt-1">
                  {clinician.name}'s schedule is clear
                </p>
              )}
            </div>
          ) : (
            appointments.map((apt) => (
              <div
                key={apt.id}
                className="bg-card rounded-lg border border-border p-4 flex items-start gap-4 hover:border-primary/30 transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {apt.patientName || apt.patientId}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date(apt.start), "MMM d, yyyy")} &middot;{" "}
                    {format(new Date(apt.start), "h:mm a")} —{" "}
                    {format(new Date(apt.end), "h:mm a")}
                  </div>
                </div>
              </div>
            ))
          )}
          {!loading && appointments.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              {appointments.length} appointment{appointments.length !== 1 && "s"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
